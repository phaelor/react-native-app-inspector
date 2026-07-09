import { Timeline } from '../src/modules/timeline';

function makeTimeline(start = 0) {
  let clock = start;
  let n = 0;
  const timeline = new Timeline({
    now: () => clock,
    idFactory: () => `id${n++}`,
    correlationWindowMs: 2000,
    slowRenderMs: 50,
    slowNetworkMs: 1000,
  });
  return { timeline, at: (t: number) => (clock = t) };
}

describe('Timeline', () => {
  it('keeps only the last N events (ring buffer)', () => {
    const timeline = new Timeline({ maxEvents: 3, now: () => 0 });
    for (let i = 0; i < 5; i++) {
      timeline.trackAction(`a${i}`);
    }
    expect(timeline.getEvents().map((e) => e.label)).toEqual([
      'a2',
      'a3',
      'a4',
    ]);
  });

  it('only records slow renders', () => {
    const { timeline } = makeTimeline();
    expect(timeline.trackRender('Fast', 10, 'update')).toBeNull();
    expect(timeline.trackRender('Slow', 80, 'update')).not.toBeNull();
    expect(timeline.getEvents()).toHaveLength(1);
    expect(timeline.getEvents()[0]?.severity).toBe('warn');
  });

  it('tracks navigation and tags later events with the active screen', () => {
    const { timeline } = makeTimeline();
    timeline.trackNavigation('Home');
    expect(timeline.getCurrentScreen()).toBe('Home');
    expect(timeline.trackAction('tap').screen).toBe('Home');
  });

  it('grades interaction severity by RAIL thresholds', () => {
    const { timeline } = makeTimeline();
    expect(timeline.trackInteraction('instant', 99).severity).toBe('info');
    expect(timeline.trackInteraction('noticeable', 100).severity).toBe('warn');
    expect(timeline.trackInteraction('sluggish', 300).severity).toBe('error');
    expect(timeline.trackInteraction('rounded', 99.6).severity).toBe('warn');
  });

  it('correlates a slow interaction with the events before it', () => {
    const { timeline, at } = makeTimeline(1000);
    at(1000);
    timeline.trackRender('CheckoutList', 400, 'update');
    at(1200);
    const slow = timeline.trackInteraction('Place order', 450);

    const correlation = timeline.correlate()!;
    expect(correlation.event.id).toBe(slow.id);
    expect(correlation.causes.map((c) => c.label)).toEqual(['CheckoutList']);
  });

  it('grades network severity by duration', () => {
    const { timeline } = makeTimeline();
    expect(
      timeline.trackNetwork({ method: 'GET', url: '/a', durationMs: 200 })
        .severity,
    ).toBe('info');
    expect(
      timeline.trackNetwork({ method: 'GET', url: '/b', durationMs: 1500 })
        .severity,
    ).toBe('warn');
    expect(
      timeline.trackNetwork({ method: 'GET', url: '/c', durationMs: 4000 })
        .severity,
    ).toBe('error');
  });

  it('correlates an FPS drop with the notable events before it', () => {
    const { timeline, at } = makeTimeline(1000);
    at(1000);
    timeline.trackNavigation('Checkout', 420);
    at(1200);
    timeline.trackNetwork({
      method: 'POST',
      url: 'https://api.example.com/orders',
      durationMs: 1450,
    });
    at(1800);
    timeline.trackRender('CheckoutScreen', 620, 'update');
    at(2000);
    const drop = timeline.trackFpsDrop(60, 28);

    const correlation = timeline.correlate(drop);
    expect(correlation?.causes.map((c) => c.type)).toEqual([
      'navigation',
      'network',
      'render',
    ]);
    expect(correlation?.summary).toContain('Possible cause');
    expect(correlation?.summary).toContain('CheckoutScreen render (620ms)');
    expect(correlation?.summary).toContain('POST /orders (1450ms)');
  });

  it('defaults correlate() to the most recent problem event', () => {
    const { timeline, at } = makeTimeline(0);
    at(100);
    timeline.trackAction('noise');
    at(200);
    timeline.trackFpsDrop(60, 25);
    expect(timeline.correlate()?.event.type).toBe('fps');
  });

  it('returns a null summary when nothing notable preceded the problem', () => {
    const { timeline, at } = makeTimeline(0);
    at(5000);
    const drop = timeline.trackFpsDrop(60, 40);
    const correlation = timeline.correlate(drop);
    expect(correlation?.causes).toEqual([]);
    expect(correlation?.summary).toBeNull();
  });

  it('exports a session with events', () => {
    const { timeline } = makeTimeline();
    timeline.trackAction('open');
    const exported = timeline.export();
    expect(typeof exported.session).toBe('string');
    expect(exported.events).toHaveLength(1);
  });
});
