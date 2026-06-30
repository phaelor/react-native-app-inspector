import type { StartupMark, StartupTimings } from '../../core/types';

/** Tuning + hooks for {@link StartupTracker}. */
export interface StartupTrackerOptions {
  /** Wall clock (epoch ms). Defaults to `Date.now`. */
  now?: () => number;
  /** Called whenever timings change. */
  onChange?: (timings: StartupTimings) => void;
}

/**
 * Records startup and navigation timings as named marks relative to a baseline.
 *
 * The baseline defaults to construction time (≈ JS bundle start). A native
 * module can later supply the real process-start timestamp via
 * {@link StartupTracker.setBaseline} for a true time-to-interactive.
 */
export class StartupTracker {
  private readonly now: () => number;
  private readonly onChange?: (timings: StartupTimings) => void;
  private startedAt: number;
  private marks: StartupMark[] = [];
  private tti: number | undefined;

  constructor(options: StartupTrackerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.onChange = options.onChange;
    this.startedAt = this.now();
  }

  /** Override the baseline (e.g. with a native process-start timestamp). */
  setBaseline(epochMs: number): void {
    this.startedAt = epochMs;
    this.emit();
  }

  /** Record a named mark (a startup phase or a screen transition). */
  mark(name: string): StartupMark {
    const at = this.now();
    const mark: StartupMark = {
      name,
      at,
      sinceStartMs: Math.max(0, Math.round(at - this.startedAt)),
    };
    this.marks.push(mark);
    if (name === 'interactive' && this.tti === undefined) {
      this.tti = mark.sinceStartMs;
    }
    this.emit();
    return mark;
  }

  /** Convenience: mark the app interactive (sets time-to-interactive). */
  markInteractive(): void {
    this.mark('interactive');
  }

  getTimings(): StartupTimings {
    return {
      startedAt: this.startedAt,
      timeToInteractiveMs: this.tti,
      marks: this.marks.map((mark) => ({ ...mark })),
    };
  }

  clear(): void {
    this.marks = [];
    this.tti = undefined;
    this.emit();
  }

  private emit(): void {
    this.onChange?.(this.getTimings());
  }
}
