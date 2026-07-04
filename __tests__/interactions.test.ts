import {
  InteractionTracker,
  type CompletedInteraction,
} from '../src/modules/interactions';
import { AppInspector } from '../src/core';

function makeTracker(options: {
  watchFramePresentation?: () => Promise<number | null>;
  timeoutMs?: number;
}) {
  let clock = 0;
  const completed: CompletedInteraction[] = [];
  const frames: Array<() => void> = [];
  const tracker = new InteractionTracker({
    onComplete: (interaction) => completed.push(interaction),
    now: () => clock,
    requestFrame: (cb) => frames.push(cb),
    watchFramePresentation: options.watchFramePresentation,
    timeoutMs: options.timeoutMs,
  });
  return {
    tracker,
    completed,
    set(ms: number) {
      clock = ms;
    },
    flushFrames() {
      frames.splice(0).forEach((cb) => cb());
    },
  };
}

const flushMicrotasks = () => new Promise(process.nextTick);

describe('InteractionTracker — native path', () => {
  it('measures touch → presented frame on the native clock', async () => {
    const { tracker, completed } = makeTracker({
      watchFramePresentation: () => Promise.resolve(10_250),
    });
    tracker.begin('Add to cart', {
      nativeTimestampMs: 10_000,
      completeOnCommit: true,
    });
    tracker.notifyCommit();
    await flushMicrotasks();

    expect(completed).toEqual([
      {
        label: 'Add to cart',
        latencyMs: 250,
        endedBy: 'commit',
        clock: 'native',
      },
    ]);
  });

  it('falls back to the JS clock when no frame is presented', async () => {
    const { tracker, completed, set } = makeTracker({
      watchFramePresentation: () => Promise.resolve(null),
    });
    set(1000);
    tracker.begin('Tap', { nativeTimestampMs: 500, completeOnCommit: true });
    set(1120);
    tracker.notifyCommit();
    await flushMicrotasks();

    expect(completed).toEqual([
      { label: 'Tap', latencyMs: 120, endedBy: 'commit', clock: 'js' },
    ]);
  });

  it('prefers the frame-timed JS fallback when a frame fired first', async () => {
    const { tracker, completed, set, flushFrames } = makeTracker({
      watchFramePresentation: () => Promise.resolve(null),
    });
    set(1000);
    tracker.begin('Tap', { nativeTimestampMs: 500, completeOnCommit: true });
    set(1120);
    tracker.notifyCommit();
    set(1136);
    flushFrames();
    await flushMicrotasks();

    expect(completed).toEqual([
      { label: 'Tap', latencyMs: 136, endedBy: 'commit', clock: 'js' },
    ]);
  });

  it('rejects clock-domain garbage (negative / absurd latency)', async () => {
    const { tracker, completed, set } = makeTracker({
      watchFramePresentation: () => Promise.resolve(100),
    });
    set(2000);
    tracker.begin('Tap', {
      nativeTimestampMs: 5_000_000,
      completeOnCommit: true,
    });
    set(2080);
    tracker.notifyCommit();
    await flushMicrotasks();

    expect(completed).toEqual([
      { label: 'Tap', latencyMs: 80, endedBy: 'commit', clock: 'js' },
    ]);
  });

  it('falls back to JS when the frame watcher rejects', async () => {
    const { tracker, completed, set } = makeTracker({
      watchFramePresentation: () => Promise.reject(new Error('boom')),
    });
    set(100);
    tracker.begin('Tap', { nativeTimestampMs: 90, completeOnCommit: true });
    set(160);
    tracker.notifyCommit();
    await flushMicrotasks();

    expect(completed).toEqual([
      { label: 'Tap', latencyMs: 60, endedBy: 'commit', clock: 'js' },
    ]);
  });
});

describe('InteractionTracker — JS fallback path', () => {
  it('measures begin → frame-after-commit without a native timestamp', () => {
    const { tracker, completed, set, flushFrames } = makeTracker({});
    set(1000);
    tracker.begin('Tap', { completeOnCommit: true });
    set(1090);
    tracker.notifyCommit();
    set(1106);
    flushFrames();

    expect(completed).toEqual([
      { label: 'Tap', latencyMs: 106, endedBy: 'commit', clock: 'js' },
    ]);
  });

  it('one commit completes every pending auto interaction', () => {
    const { tracker, completed, set, flushFrames } = makeTracker({});
    set(0);
    tracker.begin('First', { completeOnCommit: true });
    set(50);
    tracker.begin('Second', { completeOnCommit: true });
    set(100);
    tracker.notifyCommit();
    flushFrames();

    expect(completed.map((c) => [c.label, c.latencyMs])).toEqual([
      ['First', 100],
      ['Second', 50],
    ]);
  });

  it('a commit with nothing pending is a no-op', () => {
    const { tracker, completed } = makeTracker({});
    tracker.notifyCommit();
    expect(completed).toEqual([]);
  });
});

describe('InteractionTracker — manual mode', () => {
  it('completes on done(), not on commits', () => {
    const { tracker, completed, set, flushFrames } = makeTracker({});
    set(0);
    const done = tracker.begin('Checkout');
    set(40);
    tracker.notifyCommit();
    flushFrames();
    expect(completed).toEqual([]);

    set(450);
    done();
    set(466);
    flushFrames();
    expect(completed).toEqual([
      { label: 'Checkout', latencyMs: 466, endedBy: 'manual', clock: 'js' },
    ]);
  });

  it('done() twice reports once', () => {
    const { tracker, completed, flushFrames } = makeTracker({});
    const done = tracker.begin('Once');
    done();
    done();
    flushFrames();
    expect(completed).toHaveLength(1);
  });
});

describe('InteractionTracker — timeout & clear', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('silently discards interactions with no response', () => {
    const { tracker, completed, flushFrames } = makeTracker({
      timeoutMs: 5000,
    });
    tracker.begin('Dead tap', { completeOnCommit: true });
    jest.advanceTimersByTime(5001);
    tracker.notifyCommit();
    flushFrames();
    expect(completed).toEqual([]);
  });

  it('clear() drops all in-flight measurements', () => {
    const { tracker, completed, flushFrames } = makeTracker({});
    const done = tracker.begin('A');
    tracker.begin('B', { completeOnCommit: true });
    tracker.clear();
    done();
    tracker.notifyCommit();
    flushFrames();
    expect(completed).toEqual([]);
  });

  it('clear() between commit and frame suppresses the late emit', () => {
    const { tracker, completed, flushFrames } = makeTracker({});
    tracker.begin('Tap', { completeOnCommit: true });
    tracker.notifyCommit();
    tracker.clear();
    flushFrames();
    expect(completed).toEqual([]);
  });

  it('echoes the context captured at begin, not at completion', () => {
    let screen = 'Checkout';
    const completed: CompletedInteraction[] = [];
    const frames: Array<() => void> = [];
    const tracker = new InteractionTracker({
      onComplete: (interaction) => completed.push(interaction),
      now: () => 0,
      requestFrame: (cb) => frames.push(cb),
      captureContext: () => screen,
    });
    tracker.begin('Tap', { completeOnCommit: true });
    screen = 'Home';
    tracker.notifyCommit();
    frames.splice(0).forEach((cb) => cb());

    expect(completed[0]?.context).toBe('Checkout');
  });
});

describe('Interactions — integration via AppInspector', () => {
  beforeEach(() => {
    AppInspector.configure();
    AppInspector.clear();
  });

  it('a slow manual interaction lands on the timeline and the screen profile', async () => {
    AppInspector.trackNavigation('Checkout');
    const done = AppInspector.beginInteraction('Place order');
    await new Promise((resolve) => setTimeout(resolve, 120));
    done();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const event = AppInspector.getState().timeline.find(
      (e) => e.type === 'interaction',
    )!;
    expect(event).toBeDefined();
    expect(event.label).toBe('Place order');
    expect(event.durationMs).toBeGreaterThanOrEqual(100);
    expect(event.severity).not.toBe('info');
    expect(event.screen).toBe('Checkout');

    const checkout = AppInspector.getState().screens.find(
      (s) => s.screen === 'Checkout',
    )!;
    expect(checkout.interactions.count).toBe(1);
    expect(checkout.interactions.slowCount).toBe(1);
    expect(checkout.interactions.worstLabel).toBe('Place order');
  });
});
