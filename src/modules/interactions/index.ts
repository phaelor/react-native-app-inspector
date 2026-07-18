/** RAIL thresholds: ≥100ms is noticeable, ≥300ms feels sluggish. */
export const INTERACTION_WARN_MS = 100;
export const INTERACTION_ERROR_MS = 300;

export interface CompletedInteraction {
  label: string;
  latencyMs: number;
  endedBy: 'commit' | 'manual';
  clock: 'native' | 'js';
  /** Value returned by `captureContext` when the interaction began. */
  context?: unknown;
}

export interface InteractionTrackerOptions {
  onComplete: (interaction: CompletedInteraction) => void;
  /**
   * Next presented frame's timestamp — ms on the OS monotonic clock, the same
   * clock touch-event timestamps use. `null` when native timing is unavailable.
   */
  watchFramePresentation?: () => Promise<number | null>;
  /** Captured at begin and echoed on completion (e.g. the active screen). */
  captureContext?: () => unknown;
  now?: () => number;
  requestFrame?: (callback: () => void) => void;
  timeoutMs?: number;
}

export interface BeginInteractionOptions {
  /** Touch time from `e.nativeEvent.timestamp` (ms, OS monotonic clock). */
  nativeTimestampMs?: number;
  completeOnCommit?: boolean;
  /**
   * Marks an auto-captured tap. When an auto and an explicit begin carry
   * near-identical touch timestamps they are the same physical tap: the auto
   * one is dropped and the explicit label wins.
   */
  auto?: boolean;
  /** Per-interaction override of the tracker's discard timeout. */
  timeoutMs?: number;
}

const DEDUP_WINDOW_MS = 32;

interface PendingInteraction {
  label: string;
  jsStartMs: number;
  nativeStartMs?: number;
  completeOnCommit: boolean;
  auto: boolean;
  context?: unknown;
  timeout: ReturnType<typeof setTimeout>;
}

const defaultRequestFrame = (callback: () => void): void => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => callback());
  } else {
    setTimeout(callback, 16);
  }
};

/**
 * Measures tap-to-response latency: native touch timestamp → presentation of
 * the first frame after the first React commit that follows. Falls back to a
 * pure-JS measurement (Date.now → rAF after commit) without the native module.
 * Interactions with no response are silently dropped after `timeoutMs`.
 */
export class InteractionTracker {
  private readonly onComplete: (interaction: CompletedInteraction) => void;
  private readonly watchFramePresentation?: () => Promise<number | null>;
  private readonly captureContext?: () => unknown;
  private readonly now: () => number;
  private readonly requestFrame: (callback: () => void) => void;
  private readonly timeoutMs: number;
  private pending: PendingInteraction[] = [];
  private epoch = 0;

  constructor(options: InteractionTrackerOptions) {
    this.onComplete = options.onComplete;
    this.watchFramePresentation = options.watchFramePresentation;
    this.captureContext = options.captureContext;
    this.now = options.now ?? Date.now;
    this.requestFrame = options.requestFrame ?? defaultRequestFrame;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  begin(label: string, options: BeginInteractionOptions = {}): () => void {
    const auto = options.auto ?? false;
    const startMs = options.nativeTimestampMs;
    let adopted: PendingInteraction | null = null;
    if (startMs !== undefined) {
      const dup = this.pending.find(
        (p) =>
          p.auto !== auto &&
          p.nativeStartMs !== undefined &&
          Math.abs(p.nativeStartMs - startMs) <= DEDUP_WINDOW_MS,
      );
      if (dup) {
        if (auto) {
          return () => {};
        }
        this.take(dup);
      }
    } else if (!auto) {
      // An explicit begin with no touch timestamp (e.g. called after an await
      // inside a press handler) belongs to the tap that is still pending as an
      // auto capture: adopt its start clocks so one tap yields one measurement
      // anchored at the actual touch.
      adopted = this.takeLatestPendingAuto();
    }
    const entry: PendingInteraction = {
      label,
      jsStartMs: adopted?.jsStartMs ?? this.now(),
      nativeStartMs: adopted?.nativeStartMs ?? startMs,
      completeOnCommit: options.completeOnCommit ?? false,
      auto,
      context: adopted ? adopted.context : this.captureContext?.(),
      timeout: setTimeout(
        () => this.take(entry),
        options.timeoutMs ?? this.timeoutMs,
      ),
    };
    this.pending.push(entry);
    return () => {
      if (this.take(entry)) {
        this.finish(entry, 'manual');
      }
    };
  }

  notifyCommit(): void {
    if (this.pending.length === 0) {
      return;
    }
    const ready = this.pending.filter((entry) => entry.completeOnCommit);
    for (const entry of ready) {
      if (this.take(entry)) {
        this.finish(entry, 'commit');
      }
    }
  }

  /** Drops in-flight measurements and invalidates completions already racing. */
  clear(): void {
    for (const entry of this.pending) {
      clearTimeout(entry.timeout);
    }
    this.pending = [];
    this.epoch += 1;
  }

  private takeLatestPendingAuto(): PendingInteraction | null {
    let latest: PendingInteraction | null = null;
    for (const entry of this.pending) {
      if (entry.auto && (!latest || entry.jsStartMs >= latest.jsStartMs)) {
        latest = entry;
      }
    }
    if (latest) {
      this.take(latest);
    }
    return latest;
  }

  private take(entry: PendingInteraction): boolean {
    const index = this.pending.indexOf(entry);
    if (index === -1) {
      return false;
    }
    this.pending.splice(index, 1);
    clearTimeout(entry.timeout);
    return true;
  }

  private finish(
    entry: PendingInteraction,
    endedBy: CompletedInteraction['endedBy'],
  ): void {
    const epoch = this.epoch;
    const jsLatencyMs = this.now() - entry.jsStartMs;

    if (this.watchFramePresentation && entry.nativeStartMs !== undefined) {
      const nativeStartMs = entry.nativeStartMs;
      // Measured in parallel so the fallback is frame-timed too, matching the
      // pure-JS path below.
      let jsFrameLatencyMs: number | null = null;
      this.requestFrame(() => {
        jsFrameLatencyMs = this.now() - entry.jsStartMs;
      });
      this.watchFramePresentation()
        .then((presentedAtMs) => {
          const latencyMs =
            presentedAtMs !== null ? presentedAtMs - nativeStartMs : NaN;
          // A latency outside [0, timeout] means the two timestamps are not on
          // the same clock (e.g. epoch vs monotonic) — trust JS instead.
          if (
            Number.isFinite(latencyMs) &&
            latencyMs >= 0 &&
            latencyMs <= this.timeoutMs
          ) {
            this.emit(entry, latencyMs, endedBy, 'native', epoch);
          } else {
            this.emit(
              entry,
              jsFrameLatencyMs ?? jsLatencyMs,
              endedBy,
              'js',
              epoch,
            );
          }
        })
        .catch(() => {
          this.emit(
            entry,
            jsFrameLatencyMs ?? jsLatencyMs,
            endedBy,
            'js',
            epoch,
          );
        });
      return;
    }

    this.requestFrame(() => {
      this.emit(entry, this.now() - entry.jsStartMs, endedBy, 'js', epoch);
    });
  }

  private emit(
    entry: PendingInteraction,
    latencyMs: number,
    endedBy: CompletedInteraction['endedBy'],
    clock: CompletedInteraction['clock'],
    epoch: number,
  ): void {
    if (epoch !== this.epoch) {
      return;
    }
    this.onComplete({
      label: entry.label,
      latencyMs: Math.max(0, Math.round(latencyMs)),
      endedBy,
      clock,
      context: entry.context,
    });
  }
}
