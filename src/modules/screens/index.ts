import type { ScreenProblem, ScreenProfile } from '../../core/types';
import { INTERACTION_ERROR_MS, INTERACTION_WARN_MS } from '../interactions';

export interface ScreenMonitorOptions {
  /** Called whenever the per-screen profiles change. */
  onChange?: (profiles: ScreenProfile[]) => void;
  /** Wall clock (epoch ms). Defaults to `Date.now`. */
  now?: () => number;
  /** Load time (ms) above which a screen loses points. Default 1000. */
  slowLoadMs?: number;
  /** Average FPS below which a screen loses points. Default 45. */
  lowFps?: number;
  /** A render (ms) at/above this counts as a slow render. Default 50. */
  slowRenderMs?: number;
  /** A render (ms) above this is a heavy render (bigger penalty). Default 300. */
  heavyRenderMs?: number;
  /** Memory growth (MB) above which a screen loses points. Default 100. */
  memoryGrowthMb?: number;
  /** A request (ms) at/above this counts as slow. Default 1000. */
  slowNetworkMs?: number;
}

interface Accum {
  screen: string;
  visits: number;
  enteredAt: number;
  firstRenderSeen: boolean;
  loadTimeMs?: number;
  firstRenderMs?: number;
  commits: number;
  renderTotalMs: number;
  slowRenders: number;
  worstRenderMs: number;
  worstRenderId?: string;
  fpsSum: number;
  fpsCount: number;
  fpsDrops: number;
  jank: number;
  awaitingStartMem: boolean;
  startMemMb?: number;
  peakMemMb?: number;
  netRequests: number;
  netSlow: number;
  worstNetMs: number;
  worstNetUrl?: string;
  interactions: number;
  slowInteractions: number;
  worstInteractionMs: number;
  worstInteractionLabel?: string;
}

/** One performance sample's screen-relevant fields. */
export interface ScreenSampleInput {
  /** Representative FPS (UI thread if available, else JS). */
  fps: number;
  /** Janky frames this sample. */
  jank: number;
  /** Resident memory (MB), if known. */
  memoryMb?: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Builds a per-screen performance profile from the navigation, render, FPS,
 * memory and network signals the inspector already collects, scores each screen
 * 0–100, and lists what's wrong. Fed by the controller — no extra setup needed.
 */
export class ScreenMonitor {
  private readonly screens = new Map<string, Accum>();
  private readonly o: Required<ScreenMonitorOptions>;
  private current: string | undefined;

  constructor(options: ScreenMonitorOptions = {}) {
    this.o = {
      onChange: options.onChange ?? (() => {}),
      now: options.now ?? Date.now,
      slowLoadMs: options.slowLoadMs ?? 1000,
      lowFps: options.lowFps ?? 45,
      slowRenderMs: options.slowRenderMs ?? 50,
      heavyRenderMs: options.heavyRenderMs ?? 300,
      memoryGrowthMb: options.memoryGrowthMb ?? 100,
      slowNetworkMs: options.slowNetworkMs ?? 1000,
    };
  }

  /** Record entering a screen (starts a new visit/session). */
  enter(screen: string): void {
    this.current = screen;
    const a = this.accum(screen);
    a.visits += 1;
    a.enteredAt = this.o.now();
    a.firstRenderSeen = false;
    a.awaitingStartMem = true;
    this.emit();
  }

  /** Record a render commit on the active screen. */
  recordRender(id: string, durationMs: number): void {
    const a = this.activeAccum();
    if (!a) {
      return;
    }
    a.commits += 1;
    a.renderTotalMs += durationMs;
    if (durationMs >= this.o.slowRenderMs) {
      a.slowRenders += 1;
    }
    if (durationMs > a.worstRenderMs) {
      a.worstRenderMs = Math.round(durationMs);
      a.worstRenderId = id;
    }
    if (!a.firstRenderSeen) {
      a.firstRenderSeen = true;
      const elapsed = this.o.now() - a.enteredAt;
      a.firstRenderMs = Math.max(a.firstRenderMs ?? 0, Math.round(elapsed));
    }
    this.emit();
  }

  /** Record a performance sample (FPS, jank, memory) on the active screen. */
  recordSample(sample: ScreenSampleInput): void {
    const a = this.activeAccum();
    if (!a) {
      return;
    }
    if (sample.fps > 0) {
      a.fpsSum += sample.fps;
      a.fpsCount += 1;
    }
    a.jank += sample.jank;
    if (sample.memoryMb !== undefined) {
      if (a.awaitingStartMem) {
        a.startMemMb = sample.memoryMb;
        a.awaitingStartMem = false;
      }
      a.peakMemMb = Math.max(a.peakMemMb ?? sample.memoryMb, sample.memoryMb);
    }
    this.emit();
  }

  /** Record an FPS drop on the active screen. */
  recordFpsDrop(): void {
    const a = this.activeAccum();
    if (a) {
      a.fpsDrops += 1;
      this.emit();
    }
  }

  /** Record a completed network request on the active screen. */
  recordNetwork(url: string, durationMs: number): void {
    const a = this.activeAccum();
    if (!a) {
      return;
    }
    a.netRequests += 1;
    if (durationMs >= this.o.slowNetworkMs) {
      a.netSlow += 1;
    }
    if (durationMs > a.worstNetMs) {
      a.worstNetMs = Math.round(durationMs);
      a.worstNetUrl = url;
    }
    this.emit();
  }

  /** Record a measured tap-to-response interaction on the active screen. */
  recordInteraction(label: string, latencyMs: number): void {
    const a = this.activeAccum();
    if (!a) {
      return;
    }
    a.interactions += 1;
    if (latencyMs >= INTERACTION_WARN_MS) {
      a.slowInteractions += 1;
    }
    if (latencyMs > a.worstInteractionMs) {
      a.worstInteractionMs = Math.round(latencyMs);
      a.worstInteractionLabel = label;
    }
    this.emit();
  }

  /** Mark the active screen interactive (completes its load timing). */
  markInteractive(): void {
    const a = this.activeAccum();
    if (a) {
      const elapsed = this.o.now() - a.enteredAt;
      a.loadTimeMs = Math.max(a.loadTimeMs ?? 0, Math.round(elapsed));
      this.emit();
    }
  }

  /** Current profiles, worst score first. */
  getProfiles(): ScreenProfile[] {
    const profiles = [...this.screens.values()].map((a) => this.profile(a));
    return profiles.sort((x, y) => x.score - y.score);
  }

  clear(): void {
    this.screens.clear();
    this.current = undefined;
    this.emit();
  }

  private profile(a: Accum): ScreenProfile {
    const avgFps = a.fpsCount ? Math.round(a.fpsSum / a.fpsCount) : 0;
    const increaseMb =
      a.peakMemMb !== undefined && a.startMemMb !== undefined
        ? round1(a.peakMemMb - a.startMemMb)
        : undefined;
    const load = a.loadTimeMs ?? a.firstRenderMs;

    const problems: ScreenProblem[] = [];
    let score = 100;

    if (load !== undefined && load > this.o.slowLoadMs) {
      score -= 20;
      problems.push({
        kind: 'load',
        severity: 'error',
        label: `Slow to open — ${load}ms`,
      });
    }
    if (a.fpsCount > 0 && avgFps < this.o.lowFps) {
      score -= 20;
      problems.push({
        kind: 'fps',
        severity: 'error',
        label: `Low FPS — avg ${avgFps}${a.fpsDrops ? `, ${a.fpsDrops} drop(s)` : ''}`,
      });
    } else if (a.fpsDrops > 0) {
      score -= 10;
      problems.push({
        kind: 'fps',
        severity: 'warn',
        label: `${a.fpsDrops} FPS drop(s)`,
      });
    }
    if (a.worstRenderMs > this.o.heavyRenderMs) {
      score -= 15;
      problems.push({
        kind: 'render',
        severity: 'error',
        label: `Slow render — ${a.worstRenderId ?? '?'} ${a.worstRenderMs}ms`,
      });
    } else if (a.slowRenders > 0) {
      score -= 5;
      problems.push({
        kind: 'render',
        severity: 'warn',
        label: `${a.slowRenders} slow render(s)`,
      });
    }
    if (increaseMb !== undefined && increaseMb > this.o.memoryGrowthMb) {
      score -= 20;
      problems.push({
        kind: 'memory',
        severity: 'warn',
        label: `Memory growth +${increaseMb}MB`,
      });
    }
    if (a.netSlow > 0) {
      score -= 10;
      problems.push({
        kind: 'network',
        severity: 'warn',
        label: `${a.netSlow} slow request(s)${a.worstNetUrl ? ` — ${a.worstNetUrl} ${a.worstNetMs}ms` : ''}`,
      });
    }
    if (a.worstInteractionMs >= INTERACTION_ERROR_MS) {
      score -= 15;
      problems.push({
        kind: 'interaction',
        severity: 'error',
        label: `Slow to respond — ${a.worstInteractionLabel ?? '?'} ${a.worstInteractionMs}ms`,
      });
    } else if (a.slowInteractions > 0) {
      score -= 5;
      problems.push({
        kind: 'interaction',
        severity: 'warn',
        label: `${a.slowInteractions} slow interaction(s)`,
      });
    }

    return {
      screen: a.screen,
      visits: a.visits,
      score: Math.max(0, score),
      loadTimeMs: a.loadTimeMs,
      firstRenderMs: a.firstRenderMs,
      render: {
        commits: a.commits,
        avgMs: a.commits ? Math.round(a.renderTotalMs / a.commits) : 0,
        slowRenders: a.slowRenders,
        worstMs: a.worstRenderMs,
        worstId: a.worstRenderId,
      },
      fps: { average: avgFps, drops: a.fpsDrops, jank: a.jank },
      memory: { startMb: a.startMemMb, peakMb: a.peakMemMb, increaseMb },
      network: {
        requests: a.netRequests,
        slowRequests: a.netSlow,
        worstMs: a.worstNetMs,
        worstUrl: a.worstNetUrl,
      },
      interactions: {
        count: a.interactions,
        slowCount: a.slowInteractions,
        worstMs: a.worstInteractionMs,
        worstLabel: a.worstInteractionLabel,
      },
      problems,
    };
  }

  private activeAccum(): Accum | undefined {
    return this.current ? this.accum(this.current) : undefined;
  }

  private accum(screen: string): Accum {
    let a = this.screens.get(screen);
    if (!a) {
      a = {
        screen,
        visits: 0,
        enteredAt: 0,
        firstRenderSeen: false,
        commits: 0,
        renderTotalMs: 0,
        slowRenders: 0,
        worstRenderMs: 0,
        fpsSum: 0,
        fpsCount: 0,
        fpsDrops: 0,
        jank: 0,
        awaitingStartMem: false,
        netRequests: 0,
        netSlow: 0,
        worstNetMs: 0,
        interactions: 0,
        slowInteractions: 0,
        worstInteractionMs: 0,
      };
      this.screens.set(screen, a);
    }
    return a;
  }

  private emit(): void {
    this.o.onChange(this.getProfiles());
  }
}
