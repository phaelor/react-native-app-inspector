import { ScreenMonitor } from '../src/modules/screens';
import { AppInspector } from '../src/core';

/** A monitor driven by a controllable clock. */
function makeMonitor(extra = {}) {
  let clock = 0;
  const monitor = new ScreenMonitor({ now: () => clock, ...extra });
  return {
    monitor,
    set(ms: number) {
      clock = ms;
    },
    advance(ms: number) {
      clock += ms;
    },
  };
}

const profileOf = (m: ScreenMonitor, screen: string) =>
  m.getProfiles().find((p) => p.screen === screen);

describe('ScreenMonitor — scoring', () => {
  it('a healthy screen scores 100 with no problems', () => {
    const { monitor } = makeMonitor();
    monitor.enter('Home');
    monitor.recordRender('Home', 12);
    monitor.recordSample({ fps: 60, jank: 0, memoryMb: 100 });

    const home = profileOf(monitor, 'Home')!;
    expect(home.score).toBe(100);
    expect(home.problems).toHaveLength(0);
  });

  it('an all-bad screen takes every penalty (100 → 15)', () => {
    const { monitor, set } = makeMonitor();
    monitor.enter('Bad');
    monitor.recordRender('BadList', 500); // heavy render  -15
    monitor.recordSample({ fps: 20, jank: 5, memoryMb: 100 });
    monitor.recordSample({ fps: 25, jank: 5, memoryMb: 350 }); // fps<45 -20, mem +250 -20
    monitor.recordFpsDrop();
    monitor.recordNetwork('/x', 2000); // slow request  -10
    set(2000);
    monitor.markInteractive(); // load 2000ms  -20

    const bad = profileOf(monitor, 'Bad')!;
    expect(bad.score).toBe(15);
    expect(bad.problems.map((p) => p.kind).sort()).toEqual([
      'fps',
      'load',
      'memory',
      'network',
      'render',
    ]);
  });

  it('an empty (entered, no data) screen is healthy', () => {
    const { monitor } = makeMonitor();
    monitor.enter('Blank');
    const p = profileOf(monitor, 'Blank')!;
    expect(p.score).toBe(100);
    expect(p.problems).toHaveLength(0);
    expect(p.render.commits).toBe(0);
    expect(p.fps.average).toBe(0);
    expect(p.loadTimeMs).toBeUndefined();
    expect(p.firstRenderMs).toBeUndefined();
  });

  it('sorts worst score first', () => {
    const { monitor } = makeMonitor();
    monitor.enter('Good');
    monitor.recordRender('Good', 10);
    monitor.enter('Mid');
    monitor.recordRender('Mid', 120); // slow render -5
    monitor.enter('Worst');
    monitor.recordRender('Worst', 900); // heavy -15
    monitor.recordNetwork('/a', 3000); // -10

    const order = monitor.getProfiles().map((p) => p.screen);
    expect(order).toEqual(['Worst', 'Mid', 'Good']);
  });
});

describe('ScreenMonitor — threshold boundaries', () => {
  it('load: 1000ms is fine, 1001ms is penalised', () => {
    const a = makeMonitor();
    a.monitor.enter('A');
    a.set(1000);
    a.monitor.markInteractive();
    expect(profileOf(a.monitor, 'A')!.score).toBe(100);

    const b = makeMonitor();
    b.monitor.enter('B');
    b.set(1001);
    b.monitor.markInteractive();
    const pb = profileOf(b.monitor, 'B')!;
    expect(pb.score).toBe(80);
    expect(pb.problems[0]?.kind).toBe('load');
  });

  it('fps: a drop with healthy avg is a warning (-10), low avg is an error (-20)', () => {
    const warn = makeMonitor().monitor;
    warn.enter('W');
    warn.recordSample({ fps: 50, jank: 0 });
    warn.recordFpsDrop();
    const pw = profileOf(warn, 'W')!;
    expect(pw.score).toBe(90);
    expect(pw.problems[0]).toMatchObject({ kind: 'fps', severity: 'warn' });

    const err = makeMonitor().monitor;
    err.enter('E');
    err.recordSample({ fps: 40, jank: 0 });
    err.recordSample({ fps: 38, jank: 0 });
    const pe = profileOf(err, 'E')!;
    expect(pe.score).toBe(80);
    expect(pe.problems[0]).toMatchObject({ kind: 'fps', severity: 'error' });
  });

  it('render: 50–300ms is a warning (-5), >300ms is an error (-15)', () => {
    const slow = makeMonitor().monitor;
    slow.enter('S');
    slow.recordRender('S', 200);
    const ps = profileOf(slow, 'S')!;
    expect(ps.score).toBe(95);
    expect(ps.problems[0]).toMatchObject({ kind: 'render', severity: 'warn' });

    const heavy = makeMonitor().monitor;
    heavy.enter('H');
    heavy.recordRender('HList', 400);
    const ph = profileOf(heavy, 'H')!;
    expect(ph.score).toBe(85);
    expect(ph.problems[0]).toMatchObject({ kind: 'render', severity: 'error' });
    expect(ph.render.worstId).toBe('HList');
  });

  it('memory: +100MB is fine, +101MB is penalised', () => {
    const ok = makeMonitor().monitor;
    ok.enter('Ok');
    ok.recordSample({ fps: 60, jank: 0, memoryMb: 100 });
    ok.recordSample({ fps: 60, jank: 0, memoryMb: 200 });
    expect(profileOf(ok, 'Ok')!.score).toBe(100);

    const grow = makeMonitor().monitor;
    grow.enter('Grow');
    grow.recordSample({ fps: 60, jank: 0, memoryMb: 100 });
    grow.recordSample({ fps: 60, jank: 0, memoryMb: 201 });
    const pg = profileOf(grow, 'Grow')!;
    expect(pg.score).toBe(80);
    expect(pg.memory.increaseMb).toBe(101);
  });

  it('interaction: <100ms is fine, 100–300ms warns (-5), ≥300ms errors (-15)', () => {
    const ok = makeMonitor().monitor;
    ok.enter('Ok');
    ok.recordInteraction('Tap', 99);
    expect(profileOf(ok, 'Ok')!.score).toBe(100);

    const slow = makeMonitor().monitor;
    slow.enter('Slow');
    slow.recordInteraction('Tap', 150);
    const ps = profileOf(slow, 'Slow')!;
    expect(ps.score).toBe(95);
    expect(ps.problems[0]).toMatchObject({
      kind: 'interaction',
      severity: 'warn',
    });

    const bad = makeMonitor().monitor;
    bad.enter('Bad');
    bad.recordInteraction('Checkout', 620);
    const pb = profileOf(bad, 'Bad')!;
    expect(pb.score).toBe(85);
    expect(pb.problems[0]).toMatchObject({
      kind: 'interaction',
      severity: 'error',
    });
    expect(pb.interactions.worstLabel).toBe('Checkout');
    expect(pb.interactions.worstMs).toBe(620);
  });

  it('network: 999ms is fine, 1000ms is slow', () => {
    const ok = makeMonitor().monitor;
    ok.enter('Ok');
    ok.recordNetwork('/fast', 999);
    expect(profileOf(ok, 'Ok')!.score).toBe(100);

    const slow = makeMonitor().monitor;
    slow.enter('Slow');
    slow.recordNetwork('/slow', 1000);
    const p = profileOf(slow, 'Slow')!;
    expect(p.score).toBe(90);
    expect(p.network.slowRequests).toBe(1);
    expect(p.network.worstUrl).toBe('/slow');
  });
});

describe('ScreenMonitor — attribution & lifecycle', () => {
  it('records first-render and interactive load time', () => {
    const { monitor, set } = makeMonitor();
    monitor.enter('Feed');
    set(430);
    monitor.recordRender('Feed', 80);
    set(780);
    monitor.markInteractive();

    const feed = profileOf(monitor, 'Feed')!;
    expect(feed.firstRenderMs).toBe(430);
    expect(feed.loadTimeMs).toBe(780);
  });

  it('attributes renders & network to the active screen only', () => {
    const { monitor } = makeMonitor();
    monitor.enter('A');
    monitor.recordRender('A', 10);
    monitor.enter('B');
    monitor.recordNetwork('/b', 100);

    expect(profileOf(monitor, 'A')!.render.commits).toBe(1);
    expect(profileOf(monitor, 'A')!.network.requests).toBe(0);
    expect(profileOf(monitor, 'B')!.render.commits).toBe(0);
    expect(profileOf(monitor, 'B')!.network.requests).toBe(1);
  });

  it('keeps the worst render id, not the most recent', () => {
    const { monitor } = makeMonitor();
    monitor.enter('Screen');
    monitor.recordRender('Heavy', 600);
    monitor.recordRender('Light', 60);
    const p = profileOf(monitor, 'Screen')!;
    expect(p.render.worstId).toBe('Heavy');
    expect(p.render.worstMs).toBe(600);
    expect(p.render.commits).toBe(2);
  });

  it('accumulates across visits and keeps the worst load time', () => {
    const { monitor, set } = makeMonitor();
    monitor.enter('M');
    monitor.recordRender('M', 10);
    set(500);
    monitor.markInteractive();

    set(1000);
    monitor.enter('M');
    monitor.recordRender('M', 10);
    set(2500);
    monitor.markInteractive();

    const p = profileOf(monitor, 'M')!;
    expect(p.visits).toBe(2);
    expect(p.render.commits).toBe(2);
    expect(p.loadTimeMs).toBe(1500); // worst of 500 / 1500
  });

  it('averages FPS across samples and sums jank', () => {
    const { monitor } = makeMonitor();
    monitor.enter('F');
    monitor.recordSample({ fps: 60, jank: 1 });
    monitor.recordSample({ fps: 40, jank: 3 });
    const p = profileOf(monitor, 'F')!;
    expect(p.fps.average).toBe(50);
    expect(p.fps.jank).toBe(4);
  });
});

describe('ScreenMonitor — reactivity', () => {
  it('emits on every record and resets on clear', () => {
    let emissions = 0;
    let last: unknown[] = [];
    const monitor = new ScreenMonitor({
      onChange: (p) => {
        emissions += 1;
        last = p;
      },
    });
    monitor.enter('X');
    monitor.recordRender('X', 10);
    expect(emissions).toBe(2);

    monitor.clear();
    expect(last).toEqual([]);
    expect(monitor.getProfiles()).toEqual([]);
  });
});

describe('ScreenMonitor — integration via AppInspector', () => {
  beforeEach(() => {
    AppInspector.configure();
    AppInspector.clear();
  });

  it('profiles a screen from navigation + render + network signals', () => {
    AppInspector.trackNavigation('Checkout');
    AppInspector.getRenderTracker().record('CheckoutList', 'update', 620);
    AppInspector.trackNetwork({
      method: 'POST',
      url: 'https://api.example.com/orders',
      durationMs: 1800,
    });

    const checkout = AppInspector.getState().screens.find(
      (s) => s.screen === 'Checkout',
    )!;
    expect(checkout).toBeDefined();
    expect(checkout.render.worstMs).toBe(620);
    expect(checkout.render.worstId).toBe('CheckoutList');
    expect(checkout.network.slowRequests).toBe(1);
    expect(checkout.score).toBe(75); // -15 render, -10 network
    expect(checkout.problems.map((p) => p.kind).sort()).toEqual([
      'network',
      'render',
    ]);
  });

  it('is disabled when modules.slowScreens is false', () => {
    AppInspector.configure({ modules: { slowScreens: false } });
    AppInspector.clear();
    AppInspector.trackNavigation('Home');
    AppInspector.getRenderTracker().record('Home', 'mount', 500);
    expect(AppInspector.getState().screens).toEqual([]);
  });
});
