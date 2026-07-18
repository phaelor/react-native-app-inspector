import {
  TapDetector,
  describeTapTarget,
  type DetectedTap,
  type FiberLike,
} from '../src/modules/taps';

function makeDetector(options: { maxDurationMs?: number } = {}) {
  let clock = 0;
  const taps: DetectedTap[] = [];
  const detector = new TapDetector({
    onTap: (tap) => taps.push(tap),
    now: () => clock,
    ...options,
  });
  return {
    detector,
    taps,
    set(ms: number) {
      clock = ms;
    },
  };
}

describe('TapDetector', () => {
  it('detects a tap and reports the release timestamp', () => {
    const { detector, taps } = makeDetector();
    detector.touchStart({ pageX: 100, pageY: 200, timestampMs: 5000 }, 'fiber');
    detector.touchEnd({ pageX: 103, pageY: 198, timestampMs: 5080 });
    expect(taps).toEqual([
      { nativeTimestampMs: 5080, durationMs: 80, target: 'fiber' },
    ]);
  });

  it('measures duration on the JS clock when timestamps are missing', () => {
    const { detector, taps, set } = makeDetector();
    set(1000);
    detector.touchStart({ pageX: 0, pageY: 0 });
    set(1060);
    detector.touchEnd({ pageX: 0, pageY: 0 });
    expect(taps).toEqual([
      { nativeTimestampMs: undefined, durationMs: 60, target: undefined },
    ]);
  });

  it('rejects a long press', () => {
    const { detector, taps } = makeDetector();
    detector.touchStart({ pageX: 0, pageY: 0, timestampMs: 0 });
    detector.touchEnd({ pageX: 0, pageY: 0, timestampMs: 700 });
    expect(taps).toEqual([]);
  });

  it('rejects a drag/scroll (moved past the slop)', () => {
    const { detector, taps } = makeDetector();
    detector.touchStart({ pageX: 0, pageY: 0, timestampMs: 0 });
    detector.touchEnd({ pageX: 0, pageY: 40, timestampMs: 50 });
    expect(taps).toEqual([]);
  });

  it('rejects multi-touch gestures', () => {
    const { detector, taps } = makeDetector();
    detector.touchStart({ pageX: 0, pageY: 0, timestampMs: 0 });
    // Second finger down: touchCount 2 kills the pending tap.
    detector.touchStart({
      pageX: 50,
      pageY: 0,
      timestampMs: 10,
      touchCount: 2,
    });
    detector.touchEnd({ pageX: 0, pageY: 0, timestampMs: 60 });
    detector.touchEnd({ pageX: 50, pageY: 0, timestampMs: 70 });
    expect(taps).toEqual([]);
  });

  it('tracks simultaneous taps independently when identifiers are present', () => {
    const { detector, taps } = makeDetector();
    detector.touchStart(
      { pageX: 0, pageY: 0, timestampMs: 0, identifier: 0 },
      'left',
    );
    detector.touchStart(
      { pageX: 200, pageY: 0, timestampMs: 8, touchCount: 2, identifier: 1 },
      'right',
    );
    detector.touchEnd({ pageX: 0, pageY: 0, timestampMs: 60, identifier: 0 });
    detector.touchEnd({
      pageX: 200,
      pageY: 0,
      timestampMs: 70,
      identifier: 1,
    });
    expect(taps).toEqual([
      { nativeTimestampMs: 60, durationMs: 60, target: 'left' },
      { nativeTimestampMs: 70, durationMs: 62, target: 'right' },
    ]);
  });

  it('cancel() drops every pending pointer', () => {
    const { detector, taps } = makeDetector();
    detector.touchStart({ pageX: 0, pageY: 0, timestampMs: 0, identifier: 0 });
    detector.touchStart({
      pageX: 100,
      pageY: 0,
      timestampMs: 5,
      touchCount: 2,
      identifier: 1,
    });
    detector.cancel();
    detector.touchEnd({ pageX: 0, pageY: 0, timestampMs: 30, identifier: 0 });
    detector.touchEnd({ pageX: 100, pageY: 0, timestampMs: 40, identifier: 1 });
    expect(taps).toEqual([]);
  });

  it('cancel() drops the pending touch', () => {
    const { detector, taps } = makeDetector();
    detector.touchStart({ pageX: 0, pageY: 0, timestampMs: 0 });
    detector.cancel();
    detector.touchEnd({ pageX: 0, pageY: 0, timestampMs: 30 });
    expect(taps).toEqual([]);
  });

  it('an end without a start is a no-op', () => {
    const { detector, taps } = makeDetector();
    detector.touchEnd({ pageX: 0, pageY: 0, timestampMs: 30 });
    expect(taps).toEqual([]);
  });
});

/** Build a linked fiber chain from the innermost (touched) node outward. */
function chain(...fibers: FiberLike[]): FiberLike {
  for (let i = 0; i < fibers.length - 1; i += 1) {
    fibers[i]!.return = fibers[i + 1];
  }
  return fibers[0]!;
}

const onPress = () => {};

describe('describeTapTarget', () => {
  it('returns null for a missing or malformed target', () => {
    expect(describeTapTarget(undefined)).toBeNull();
    expect(describeTapTarget(null)).toBeNull();
    expect(describeTapTarget(42)).toBeNull();
  });

  it('returns null when nothing pressable is above the touch', () => {
    const target = chain(
      { type: 'RCTText', memoizedProps: { children: 'hello' } },
      { type: 'RCTView', memoizedProps: {} },
    );
    expect(describeTapTarget(target)).toBeNull();
  });

  it('skips disabled pressables', () => {
    const target = chain(
      { type: 'RCTView', memoizedProps: {} },
      { type: () => null, memoizedProps: { onPress, disabled: true } },
    );
    expect(describeTapTarget(target)).toBeNull();
  });

  it('prefers testID over everything else', () => {
    const target = chain(
      { type: 'RCTView', memoizedProps: {} },
      {
        type: () => null,
        memoizedProps: {
          onPress,
          testID: 'add-todo',
          accessibilityLabel: 'Add a todo',
        },
        child: { type: 'RCTText', memoizedProps: { children: 'Add' } },
      },
    );
    expect(describeTapTarget(target)).toEqual({ label: 'add-todo' });
  });

  it('falls back to accessibilityLabel, then rendered text', () => {
    const withA11y = chain(
      { type: 'RCTView', memoizedProps: {} },
      {
        type: () => null,
        memoizedProps: { onPress, accessibilityLabel: 'Add a todo' },
      },
    );
    expect(describeTapTarget(withA11y)).toEqual({ label: 'Add a todo' });

    const withText = chain(
      { type: 'RCTView', memoizedProps: {} },
      {
        type: () => null,
        memoizedProps: { onPress },
        child: {
          type: 'RCTView',
          memoizedProps: {},
          child: { type: 'RCTText', memoizedProps: { children: 'Add task' } },
        },
      },
    );
    expect(describeTapTarget(withText)).toEqual({ label: 'Add task' });
  });

  it('joins string fragments and truncates long text', () => {
    const long = 'x'.repeat(80);
    const target = chain({
      type: () => null,
      memoizedProps: { onPress },
      child: { type: 'RCTText', memoizedProps: { children: [long, '!'] } },
    });
    const label = describeTapTarget(target)!.label!;
    expect(label.length).toBeLessThanOrEqual(48);
    expect(label.endsWith('…')).toBe(true);
  });

  it('reads the label from a composite wrapper above the pressable', () => {
    function AddButton() {
      return null;
    }
    const target = chain(
      { type: 'RCTView', memoizedProps: {} },
      { type: () => null, memoizedProps: { onPress } },
      { type: AddButton, memoizedProps: { testID: 'wrapper-id', onPress } },
    );
    expect(describeTapTarget(target)).toEqual({ label: 'wrapper-id' });
  });

  it('does not take a testID from a host container above the pressable', () => {
    // Array element defeats JS name inference: a truly nameless component.
    const anonymous = [() => null][0]!;
    const target = chain(
      { type: 'RCTView', memoizedProps: {} },
      { type: anonymous, memoizedProps: { onPress } },
      { type: 'RCTView', memoizedProps: { testID: 'screen-root' } },
    );
    expect(describeTapTarget(target)).toEqual({ label: null });
  });

  it('falls back to the outermost wrapper component name', () => {
    function Pressable() {
      return null;
    }
    function AddButton() {
      return null;
    }
    const target = chain(
      { type: 'RCTView', memoizedProps: {} },
      { type: Pressable, memoizedProps: { onPress } },
      { type: AddButton, memoizedProps: {} },
      { type: 'RCTView', memoizedProps: {} },
    );
    expect(describeTapTarget(target)).toEqual({ label: 'AddButton' });
  });

  it('gives up after the walk-up depth cap', () => {
    let fiber: FiberLike = { type: () => null, memoizedProps: { onPress } };
    for (let i = 0; i < 80; i += 1) {
      fiber = { type: 'RCTView', memoizedProps: {}, return: fiber };
    }
    expect(describeTapTarget(fiber)).toBeNull();
  });

  it('swallows exotic fiber shapes instead of throwing', () => {
    const hostile = {
      get memoizedProps(): never {
        throw new Error('detached fiber');
      },
    };
    expect(describeTapTarget(hostile)).toBeNull();
  });
});
