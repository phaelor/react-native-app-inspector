/**
 * Pure frame-timing math, independent of any scheduler or the RN runtime.
 *
 * Feed it the timestamp of every rendered frame; it derives the frame rate,
 * jank count and worst frame duration for the current window. Keeping this
 * free of `requestAnimationFrame` makes the FPS logic fully unit-testable.
 */
export class FrameWindow {
  private frames = 0;
  private janky = 0;
  private maxFrameMs = 0;
  private firstTs: number | null = null;
  private lastTs: number | null = null;

  /**
   * @param jankThresholdMs Frame durations longer than this count as janky.
   *   ~50ms ≈ 3 dropped frames at 60Hz.
   */
  constructor(private readonly jankThresholdMs: number) {}

  /** Record a frame rendered at `ts` (a monotonic clock, in ms). */
  record(ts: number): void {
    if (this.firstTs === null) {
      this.firstTs = ts;
    }
    if (this.lastTs !== null) {
      const delta = ts - this.lastTs;
      if (delta > this.maxFrameMs) {
        this.maxFrameMs = delta;
      }
      if (delta > this.jankThresholdMs) {
        this.janky += 1;
      }
    }
    this.lastTs = ts;
    this.frames += 1;
  }

  /**
   * Frames per second over the elapsed window (0 until ≥2 frames seen).
   * Uses frame *intervals* (frames − 1) so evenly spaced frames yield the
   * true refresh rate rather than an off-by-one overestimate.
   */
  fps(nowTs: number): number {
    if (this.firstTs === null || this.frames < 2) {
      return 0;
    }
    const elapsedSec = (nowTs - this.firstTs) / 1000;
    return elapsedSec > 0 ? Math.round((this.frames - 1) / elapsedSec) : 0;
  }

  /** Number of frames slower than the jank threshold this window. */
  get jankyFrames(): number {
    return this.janky;
  }

  /** Longest single frame duration this window, rounded to ms. */
  get longestFrameMs(): number {
    return Math.round(this.maxFrameMs);
  }

  /** Reset all counters for the next sampling window. */
  reset(): void {
    this.frames = 0;
    this.janky = 0;
    this.maxFrameMs = 0;
    this.firstTs = null;
    this.lastTs = null;
  }
}
