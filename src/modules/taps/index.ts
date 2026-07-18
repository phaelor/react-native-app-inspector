export interface TouchSample {
  pageX: number;
  pageY: number;
  /** `nativeEvent.timestamp` — ms on the OS monotonic clock. */
  timestampMs?: number;
  touchCount?: number;
  /** `nativeEvent.identifier` — matches a touch end to its start pointer. */
  identifier?: number | string;
}

export interface DetectedTap {
  nativeTimestampMs?: number;
  durationMs: number;
  /** Opaque value passed to `touchStart` (the touched fiber). */
  target?: unknown;
}

export interface TapDetectorOptions {
  onTap: (tap: DetectedTap) => void;
  maxDurationMs?: number;
  maxMovementDp?: number;
  now?: () => number;
}

interface PendingTouch {
  x: number;
  y: number;
  nativeStartMs?: number;
  jsStartMs: number;
  target?: unknown;
}

/** Fallback map key when the platform provides no touch identifier. */
const NO_IDENTIFIER = Symbol('no-identifier');
const MAX_TRACKED_TOUCHES = 10;

/**
 * Classifies touch starts/ends into taps: pointers that neither moved past
 * `maxMovementDp` nor stayed down past `maxDurationMs`. Pointers are tracked
 * per `identifier`, so simultaneous taps (two fingers, two buttons) each
 * resolve independently; without identifiers only one pointer is tracked and
 * concurrent touches are dropped.
 */
export class TapDetector {
  private readonly onTap: (tap: DetectedTap) => void;
  private readonly maxDurationMs: number;
  private readonly maxMovementDp: number;
  private readonly now: () => number;
  private readonly pending = new Map<
    number | string | typeof NO_IDENTIFIER,
    PendingTouch
  >();

  constructor(options: TapDetectorOptions) {
    this.onTap = options.onTap;
    this.maxDurationMs = options.maxDurationMs ?? 500;
    this.maxMovementDp = options.maxMovementDp ?? 10;
    this.now = options.now ?? Date.now;
  }

  touchStart(sample: TouchSample, target?: unknown): void {
    if (sample.identifier === undefined) {
      // No way to match this pointer's end to its start: keep the legacy
      // single-slot behavior and drop overlapping touches entirely.
      if ((sample.touchCount ?? 1) > 1 || this.pending.size > 0) {
        this.pending.clear();
        return;
      }
    }
    if (this.pending.size >= MAX_TRACKED_TOUCHES) {
      this.pending.clear();
    }
    this.pending.set(sample.identifier ?? NO_IDENTIFIER, {
      x: sample.pageX,
      y: sample.pageY,
      nativeStartMs: sample.timestampMs,
      jsStartMs: this.now(),
      target,
    });
  }

  touchEnd(sample: TouchSample): void {
    const key = sample.identifier ?? NO_IDENTIFIER;
    const pending = this.pending.get(key);
    this.pending.delete(key);
    if (!pending) {
      return;
    }
    const dx = sample.pageX - pending.x;
    const dy = sample.pageY - pending.y;
    if (dx * dx + dy * dy > this.maxMovementDp * this.maxMovementDp) {
      return;
    }
    const durationMs =
      pending.nativeStartMs !== undefined && sample.timestampMs !== undefined
        ? sample.timestampMs - pending.nativeStartMs
        : this.now() - pending.jsStartMs;
    if (durationMs < 0 || durationMs > this.maxDurationMs) {
      return;
    }
    this.onTap({
      nativeTimestampMs: sample.timestampMs,
      durationMs: Math.round(durationMs),
      target: pending.target,
    });
  }

  cancel(): void {
    this.pending.clear();
  }
}

/**
 * The subset of a React fiber this module reads. Fibers are React internals,
 * so everything is optional and the walk is defensive.
 */
export interface FiberLike {
  memoizedProps?: unknown;
  return?: FiberLike | null;
  child?: FiberLike | null;
  sibling?: FiberLike | null;
  type?: unknown;
}

export interface TapTargetInfo {
  label: string | null;
}

const MAX_WALK_UP = 64;
const TEXT_SEARCH_BUDGET = 24;
const MAX_LABEL_LENGTH = 48;

function propsOf(fiber: FiberLike): Record<string, unknown> | null {
  const props = fiber.memoizedProps;
  return typeof props === 'object' && props !== null
    ? (props as Record<string, unknown>)
    : null;
}

/**
 * Requires a user-facing press handler; responder handlers are deliberately
 * not enough — ScrollView and TextInput attach those too.
 */
function isPressable(props: Record<string, unknown>): boolean {
  return (
    (typeof props.onPress === 'function' ||
      typeof props.onLongPress === 'function') &&
    props.disabled !== true
  );
}

function isComposite(fiber: FiberLike): boolean {
  return (
    typeof fiber.type === 'function' ||
    (typeof fiber.type === 'object' && fiber.type !== null)
  );
}

function componentName(fiber: FiberLike): string | null {
  const type = fiber.type as
    | { displayName?: string; name?: string; render?: { name?: string } }
    | null
    | undefined;
  if (typeof type === 'function' || (typeof type === 'object' && type)) {
    const name = type.displayName ?? type.name ?? type.render?.name;
    if (typeof name === 'string' && name.length > 0) {
      return name;
    }
  }
  return null;
}

function cleanLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length === 0) {
    return null;
  }
  return text.length > MAX_LABEL_LENGTH
    ? `${text.slice(0, MAX_LABEL_LENGTH - 1)}…`
    : text;
}

function textIn(root: FiberLike): string | null {
  const queue: FiberLike[] = root.child ? [root.child] : [];
  let budget = TEXT_SEARCH_BUDGET;
  while (queue.length > 0 && budget > 0) {
    budget -= 1;
    const fiber = queue.shift()!;
    const children = propsOf(fiber)?.children;
    const text = Array.isArray(children)
      ? cleanLabel(children.filter((c) => typeof c === 'string').join(''))
      : cleanLabel(children);
    if (text) {
      return text;
    }
    if (fiber.child) queue.push(fiber.child);
    if (fiber.sibling) queue.push(fiber.sibling);
  }
  return null;
}

/**
 * Finds the nearest enabled pressable above the touched fiber and derives its
 * label (`testID` → `accessibilityLabel` → rendered text → wrapper component
 * name). Returns `null` when the tap hit nothing pressable — such taps must
 * not be tracked. Any unexpected fiber shape also aborts to `null`.
 */
export function describeTapTarget(target: unknown): TapTargetInfo | null {
  try {
    let fiber = target as FiberLike | null | undefined;
    let steps = MAX_WALK_UP;
    while (fiber && typeof fiber === 'object' && steps > 0) {
      const props = propsOf(fiber);
      if (props && isPressable(props)) {
        return { label: labelFor(fiber) };
      }
      fiber = fiber.return;
      steps -= 1;
    }
    return null;
  } catch {
    return null;
  }
}

function labelFor(pressFiber: FiberLike): string | null {
  // Composite wrappers directly above the pressable (no host view in between)
  // render the same visual element, so their props may label it; anything past
  // a host fiber is a container and would mislabel.
  const scope: FiberLike[] = [pressFiber];
  let fiber = pressFiber.return;
  while (fiber && isComposite(fiber) && scope.length < 8) {
    scope.push(fiber);
    fiber = fiber.return;
  }

  for (const key of ['testID', 'accessibilityLabel'] as const) {
    for (const candidate of scope) {
      const label = cleanLabel(propsOf(candidate)?.[key]);
      if (label) {
        return label;
      }
    }
  }
  const text = textIn(pressFiber);
  if (text) {
    return text;
  }
  // Outermost first: the user's component name beats plain "Pressable".
  for (let i = scope.length - 1; i >= 0; i -= 1) {
    const name = componentName(scope[i]!);
    if (name) {
      return name;
    }
  }
  return null;
}
