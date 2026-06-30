import type { RenderStat } from '../../core/types';

/** React Profiler `onRender` phases. */
export type RenderPhase = 'mount' | 'update' | 'nested-update';

/** Tuning + hooks for {@link RenderTracker}. */
export interface RenderTrackerOptions {
  /** Commit `actualDuration` (ms) above which a commit counts as slow. Default 16. */
  slowThresholdMs?: number;
  /** Called whenever the aggregated stats change. */
  onChange?: (stats: RenderStat[]) => void;
  /** Called for every individual commit (e.g. to feed the timeline). */
  onCommit?: (id: string, phase: RenderPhase, actualDurationMs: number) => void;
}

const round = (ms: number): number => Math.round(ms * 10) / 10;

/**
 * Aggregates React commit timings per component id — render counts, durations,
 * and slow-render flags — to surface re-render hotspots and wasted renders.
 *
 * Fed by {@link InspectorProfiler} (which wraps React's `<Profiler>`), but the
 * `record` method mirrors the Profiler `onRender` signature so it is unit-tested
 * without React.
 */
export class RenderTracker {
  private readonly stats = new Map<string, RenderStat>();
  private readonly slowThresholdMs: number;
  private readonly onChange?: (stats: RenderStat[]) => void;
  private readonly onCommit?: (
    id: string,
    phase: RenderPhase,
    actualDurationMs: number,
  ) => void;

  constructor(options: RenderTrackerOptions = {}) {
    this.slowThresholdMs = options.slowThresholdMs ?? 16;
    this.onChange = options.onChange;
    this.onCommit = options.onCommit;
  }

  /** Record a commit. Signature matches React Profiler's `onRender`. */
  record(id: string, phase: RenderPhase, actualDurationMs: number): void {
    const ms = round(actualDurationMs);
    this.onCommit?.(id, phase, actualDurationMs);
    const prev = this.stats.get(id);
    const isMount = phase === 'mount';

    const next: RenderStat = prev
      ? {
          id,
          commits: prev.commits + 1,
          mounts: prev.mounts + (isMount ? 1 : 0),
          updates: prev.updates + (isMount ? 0 : 1),
          totalMs: round(prev.totalMs + ms),
          maxMs: Math.max(prev.maxMs, ms),
          lastMs: ms,
          slowCommits: prev.slowCommits + (ms > this.slowThresholdMs ? 1 : 0),
        }
      : {
          id,
          commits: 1,
          mounts: isMount ? 1 : 0,
          updates: isMount ? 0 : 1,
          totalMs: ms,
          maxMs: ms,
          lastMs: ms,
          slowCommits: ms > this.slowThresholdMs ? 1 : 0,
        };

    this.stats.set(id, next);
    this.onChange?.(this.snapshot());
  }

  /** Current stats, sorted by total time spent (worst offenders first). */
  snapshot(): RenderStat[] {
    return [...this.stats.values()]
      .map((stat) => ({ ...stat }))
      .sort((a, b) => b.totalMs - a.totalMs);
  }

  clear(): void {
    this.stats.clear();
    this.onChange?.(this.snapshot());
  }
}
