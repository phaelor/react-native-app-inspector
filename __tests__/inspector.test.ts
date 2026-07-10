// These intentionally import the pure-TS modules (no react-native runtime) so
// the suite stays fast and dependency-light.
import { AppInspector } from '../src/core';
import { buildSnapshot, exportLogs } from '../src/export';
import { PerformanceMonitor } from '../src/modules/performance';
import { RenderTracker } from '../src/modules/render';
import { StartupTracker } from '../src/modules/startup';
import type { NativeNetworkEvent, PerformanceSample } from '../src/core/types';
import type { NativeMetricsProvider } from '../src/core';

const sampleFixture = (jsFps: number): PerformanceSample => ({
  timestamp: 1,
  jsFps,
  uiFps: 0,
  jankyFrames: 0,
  longestFrameMs: 16,
});

describe('AppInspector controller', () => {
  beforeEach(() => {
    AppInspector.configure();
    AppInspector.stop();
    AppInspector.clear();
  });

  it('is not running before start()', () => {
    expect(AppInspector.isRunning()).toBe(false);
  });

  it('reflects running state across start()/stop()', () => {
    AppInspector.start();
    expect(AppInspector.isRunning()).toBe(true);
    AppInspector.stop();
    expect(AppInspector.isRunning()).toBe(false);
  });

  it('stays inert when disabled', () => {
    AppInspector.configure({ enabled: false });
    AppInspector.start();
    expect(AppInspector.isRunning()).toBe(false);
  });

  it('merges module flags over the defaults', () => {
    AppInspector.configure({ modules: { network: false } });
    const { modules } = AppInspector.getConfig();
    expect(modules.network).toBe(false);
    expect(modules.actions).toBe(true);
    expect(modules.performance).toBe(true);
  });

  it('notifies subscribers when a module pushes state', () => {
    const seen: number[] = [];
    const unsubscribe = AppInspector.subscribe((state) => {
      seen.push(state.performance.length);
    });
    AppInspector.getStore().pushPerformance(sampleFixture(60));
    AppInspector.getStore().pushPerformance(sampleFixture(58));
    unsubscribe();
    AppInspector.getStore().pushPerformance(sampleFixture(59));

    expect(seen).toEqual([1, 2]); // listener not called after unsubscribe
    expect(AppInspector.getState().performance).toHaveLength(3); // data still stored
  });
});

describe('native network capture', () => {
  function makeProvider(): NativeMetricsProvider & {
    emit: (event: NativeNetworkEvent) => void;
    startNetworkCapture: jest.Mock;
    stopNetworkCapture: jest.Mock;
  } {
    let handler: ((event: NativeNetworkEvent) => void) | null = null;
    return {
      isAvailable: () => false,
      start: jest.fn(),
      stop: jest.fn(),
      getLatest: () => ({ uiFps: 0, usedMemoryMb: 0, cpuPercent: 0 }),
      getProcessStartTime: () => Promise.resolve(undefined),
      watchNextFrame: () => Promise.resolve(null),
      supportsNetworkCapture: () => true,
      startNetworkCapture: jest.fn((onEntry) => {
        handler = onEntry;
      }),
      stopNetworkCapture: jest.fn(),
      emit: (event) => handler?.(event),
    };
  }

  afterEach(() => {
    AppInspector.stop();
    AppInspector.setNativeMetricsProvider(null);
    AppInspector.clear();
  });

  it('prefers the native interceptor and feeds entries into the store', () => {
    const provider = makeProvider();
    AppInspector.setNativeMetricsProvider(provider);
    AppInspector.configure();
    AppInspector.start();
    expect(provider.startNetworkCapture).toHaveBeenCalledTimes(1);

    provider.emit({
      method: 'GET',
      url: 'https://api.example.com/todos',
      status: 200,
      startedAt: Date.now(),
      durationMs: 120,
    });
    const [entry] = AppInspector.getState().network;
    expect(entry?.method).toBe('GET');
    expect(entry?.url).toBe('https://api.example.com/todos');
    expect(entry?.status).toBe(200);
    expect(entry?.durationMs).toBe(120);

    AppInspector.stop();
    expect(provider.stopNetworkCapture).toHaveBeenCalled();
  });

  it('maps status 0 (transport failure) to undefined', () => {
    const provider = makeProvider();
    AppInspector.setNativeMetricsProvider(provider);
    AppInspector.configure();
    AppInspector.start();
    provider.emit({
      method: 'POST',
      url: 'https://api.example.com/orders',
      status: 0,
      startedAt: Date.now(),
      durationMs: 30,
    });
    expect(AppInspector.getState().network[0]?.status).toBeUndefined();
  });

  it('does not use native capture when the network module is off', () => {
    const provider = makeProvider();
    AppInspector.setNativeMetricsProvider(provider);
    AppInspector.configure({ modules: { network: false } });
    AppInspector.start();
    expect(provider.startNetworkCapture).not.toHaveBeenCalled();
  });
});

describe('export snapshot', () => {
  beforeEach(() => {
    AppInspector.configure();
    AppInspector.clear();
  });

  it('builds an empty snapshot with all sections', () => {
    const snapshot = buildSnapshot();
    expect(snapshot.network).toEqual([]);
    expect(snapshot.actions).toEqual([]);
    expect(snapshot.device).toBeNull();
    expect(snapshot.performance).toEqual([]);
    expect(snapshot.renders).toEqual([]);
    expect(snapshot.startup.marks).toEqual([]);
  });

  it('includes pushed performance samples', () => {
    AppInspector.getStore().pushPerformance(sampleFixture(60));
    expect(buildSnapshot().performance).toHaveLength(1);
  });

  it('serialises a snapshot to valid JSON', () => {
    const json = exportLogs('json');
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('PerformanceMonitor (JS FPS + jank)', () => {
  // Drive the rAF loop manually so FPS is deterministic and RN-free.
  function makeHarness() {
    let pending: ((ts: number) => void) | null = null;
    const monitor = new PerformanceMonitor({
      sampleIntervalMs: 100,
      jankThresholdMs: 50,
      now: () => 1_000,
      scheduleFrame: (cb) => {
        pending = cb;
        return 1;
      },
      cancelFrame: () => {
        pending = null;
      },
      readMemory: () => ({ jsHeapUsedMb: 12.5, jsHeapTotalMb: 64 }),
    });
    const frame = (ts: number) => {
      const cb = pending;
      pending = null;
      cb?.(ts);
    };
    return { monitor, frame };
  }

  it('starts empty and tracks running state', () => {
    const { monitor } = makeHarness();
    expect(monitor.getSamples()).toEqual([]);
    expect(monitor.getCurrent()).toBeUndefined();
    expect(monitor.isRunning()).toBe(false);
    monitor.start();
    expect(monitor.isRunning()).toBe(true);
    monitor.stop();
    expect(monitor.isRunning()).toBe(false);
  });

  it('computes ~steady FPS from evenly spaced frames', () => {
    const { monitor, frame } = makeHarness();
    monitor.start();
    // 11 frames every 10ms => 10 intervals over 100ms => 100 fps.
    for (let ts = 0; ts <= 100; ts += 10) {
      frame(ts);
    }
    const sample = monitor.getCurrent();
    expect(sample?.jsFps).toBe(100);
    expect(sample?.jankyFrames).toBe(0);
    expect(sample?.jsHeapUsedMb).toBe(12.5);
    expect(sample?.timestamp).toBe(1_000);
  });

  it('flags janky frames and the longest frame', () => {
    const { monitor, frame } = makeHarness();
    monitor.start();
    // A 90ms stall between frames crosses the 50ms jank threshold.
    frame(0);
    frame(10);
    frame(100);
    const sample = monitor.getCurrent();
    expect(sample?.jankyFrames).toBe(1);
    expect(sample?.longestFrameMs).toBe(90);
  });

  it('stops scheduling new frames after stop()', () => {
    const { monitor, frame } = makeHarness();
    monitor.start();
    monitor.stop();
    frame(0); // no pending callback -> no-op, no throw
    expect(monitor.getSamples()).toEqual([]);
  });
});

describe('RenderTracker', () => {
  it('aggregates commits per id (mounts vs updates)', () => {
    const tracker = new RenderTracker({ slowThresholdMs: 16 });
    tracker.record('List', 'mount', 8);
    tracker.record('List', 'update', 4);
    tracker.record('List', 'update', 20); // slow

    const [stat] = tracker.snapshot();
    expect(stat).toMatchObject({
      id: 'List',
      commits: 3,
      mounts: 1,
      updates: 2,
      maxMs: 20,
      lastMs: 20,
      slowCommits: 1,
    });
    expect(stat?.totalMs).toBeCloseTo(32);
  });

  it('sorts hotspots by total time and notifies onChange', () => {
    const changes: number[] = [];
    const tracker = new RenderTracker({
      onChange: (s) => changes.push(s.length),
    });
    tracker.record('Cheap', 'mount', 1);
    tracker.record('Expensive', 'mount', 50);

    expect(tracker.snapshot().map((s) => s.id)).toEqual(['Expensive', 'Cheap']);
    expect(changes).toEqual([1, 2]);
  });
});

describe('StartupTracker', () => {
  it('records marks relative to the baseline', () => {
    let clock = 1_000;
    const tracker = new StartupTracker({ now: () => clock });
    clock = 1_120;
    tracker.mark('first-render');
    clock = 1_400;
    tracker.markInteractive();

    const timings = tracker.getTimings();
    expect(timings.startedAt).toBe(1_000);
    expect(timings.timeToInteractiveMs).toBe(400);
    expect(timings.marks.map((m) => [m.name, m.sinceStartMs])).toEqual([
      ['first-render', 120],
      ['interactive', 400],
    ]);
  });

  it('setBaseline shifts the reference point', () => {
    let clock = 5_000;
    const tracker = new StartupTracker({ now: () => clock });
    tracker.setBaseline(4_000);
    clock = 4_300;
    tracker.mark('ready');
    expect(tracker.getTimings().marks[0]?.sinceStartMs).toBe(300);
  });
});
