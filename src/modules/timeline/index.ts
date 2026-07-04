import type {
  TimelineCorrelation,
  TimelineEvent,
  TimelineEventType,
  TimelineSeverity,
} from '../../core/types';
import { INTERACTION_ERROR_MS, INTERACTION_WARN_MS } from '../interactions';

/** Tuning + hooks for {@link Timeline}. */
export interface TimelineOptions {
  /** Ring-buffer size. Default 500. */
  maxEvents?: number;
  /** Wall clock (epoch ms). Defaults to `Date.now`. */
  now?: () => number;
  /** Called whenever the event list changes. */
  onChange?: (events: TimelineEvent[]) => void;
  /** Network duration (ms) at/above which a request is "slow". Default 1000. */
  slowNetworkMs?: number;
  /** Render duration (ms) at/above which a commit lands on the timeline. Default 50. */
  slowRenderMs?: number;
  /** FPS at/below this is a warning. Default 45. */
  fpsWarn?: number;
  /** FPS at/below this is an error. Default 30. */
  fpsError?: number;
  /** Memory jump (MB) at/above which a change is notable. Default 50. */
  memoryJumpMb?: number;
  /** Window (ms) before a problem event to search for causes. Default 2000. */
  correlationWindowMs?: number;
  /** Short id generator (session + event ids). */
  idFactory?: () => string;
}

const NAVIGATION_WARN_MS = 500;

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function shortUrl(url: string): string {
  const withoutQuery = url.split('?')[0] ?? url;
  return withoutQuery.replace(/^https?:\/\/[^/]+/, '') || withoutQuery;
}

/** Input describing a network request to record. */
export interface NetworkEventInput {
  method: string;
  url: string;
  status?: number;
  durationMs: number;
}

/**
 * A time-ordered log of actions, navigation, slow renders, network calls, FPS
 * drops and memory jumps. The capture modules push into it via the `track*`
 * helpers; `correlate` looks back from a problem event to find what likely
 * caused it.
 */
export class Timeline {
  private readonly events: TimelineEvent[] = [];
  private readonly options: Required<TimelineOptions>;
  private readonly sessionId: string;
  private startedAt: number;
  private currentScreen: string | undefined;
  private seq = 0;

  constructor(options: TimelineOptions = {}) {
    this.options = {
      maxEvents: options.maxEvents ?? 500,
      now: options.now ?? Date.now,
      onChange: options.onChange ?? (() => {}),
      slowNetworkMs: options.slowNetworkMs ?? 1000,
      slowRenderMs: options.slowRenderMs ?? 50,
      fpsWarn: options.fpsWarn ?? 45,
      fpsError: options.fpsError ?? 30,
      memoryJumpMb: options.memoryJumpMb ?? 50,
      correlationWindowMs: options.correlationWindowMs ?? 2000,
      idFactory: options.idFactory ?? randomId,
    };
    this.sessionId = this.options.idFactory();
    this.startedAt = this.options.now();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getCurrentScreen(): string | undefined {
    return this.currentScreen;
  }

  /** Low-level append. Most callers use the `track*` helpers. */
  add(input: {
    type: TimelineEventType;
    label: string;
    durationMs?: number;
    severity?: TimelineSeverity;
    screen?: string;
    data?: Record<string, unknown>;
    timestamp?: number;
  }): TimelineEvent {
    const timestamp = input.timestamp ?? this.options.now();
    const event: TimelineEvent = {
      id: `${this.seq++}-${this.options.idFactory()}`,
      type: input.type,
      label: input.label,
      timestamp,
      sinceStartMs: Math.max(0, Math.round(timestamp - this.startedAt)),
      screen: input.screen ?? this.currentScreen,
      durationMs: input.durationMs,
      severity: input.severity ?? 'info',
      data: input.data,
    };
    this.events.push(event);
    if (this.events.length > this.options.maxEvents) {
      this.events.shift();
    }
    this.options.onChange([...this.events]);
    return event;
  }

  trackLifecycle(label: string, data?: Record<string, unknown>): TimelineEvent {
    return this.add({ type: 'lifecycle', label, severity: 'info', data });
  }

  trackAction(name: string, data?: Record<string, unknown>): TimelineEvent {
    return this.add({ type: 'action', label: name, severity: 'info', data });
  }

  /** Record a screen transition and update the active screen. */
  trackNavigation(to: string, transitionMs?: number): TimelineEvent {
    const event = this.add({
      type: 'navigation',
      label: to,
      durationMs: transitionMs,
      severity:
        transitionMs !== undefined && transitionMs > NAVIGATION_WARN_MS
          ? 'warn'
          : 'info',
      screen: to,
      data: { from: this.currentScreen, to },
    });
    this.currentScreen = to;
    return event;
  }

  /** Record a render commit. Only slow commits land on the timeline. */
  trackRender(
    id: string,
    durationMs: number,
    phase: string,
  ): TimelineEvent | null {
    if (durationMs < this.options.slowRenderMs) {
      return null;
    }
    return this.add({
      type: 'render',
      label: id,
      durationMs: Math.round(durationMs),
      severity: durationMs >= this.options.slowRenderMs * 4 ? 'error' : 'warn',
      data: { phase },
    });
  }

  /** Record a measured tap-to-response interaction. */
  trackInteraction(label: string, latencyMs: number): TimelineEvent {
    const rounded = Math.round(latencyMs);
    return this.add({
      type: 'interaction',
      label,
      durationMs: rounded,
      severity:
        rounded >= INTERACTION_ERROR_MS
          ? 'error'
          : rounded >= INTERACTION_WARN_MS
            ? 'warn'
            : 'info',
    });
  }

  trackNetwork(input: NetworkEventInput): TimelineEvent {
    const severity: TimelineSeverity =
      input.durationMs >= this.options.slowNetworkMs * 3
        ? 'error'
        : input.durationMs >= this.options.slowNetworkMs
          ? 'warn'
          : 'info';
    return this.add({
      type: 'network',
      label: `${input.method} ${shortUrl(input.url)}`,
      durationMs: Math.round(input.durationMs),
      severity,
      data: { url: input.url, status: input.status },
    });
  }

  /** Record a JS error or a console warning/error. */
  trackError(
    label: string,
    severity: TimelineSeverity = 'error',
    data?: Record<string, unknown>,
  ): TimelineEvent {
    return this.add({ type: 'error', label, severity, data });
  }

  trackFpsDrop(from: number, to: number): TimelineEvent {
    return this.add({
      type: 'fps',
      label: `FPS drop ${from} → ${to}`,
      severity: to <= this.options.fpsError ? 'error' : 'warn',
      data: { from, to },
    });
  }

  trackMemory(beforeMb: number, afterMb: number): TimelineEvent {
    const deltaMb = Math.round((afterMb - beforeMb) * 10) / 10;
    return this.add({
      type: 'memory',
      label: `Memory ${deltaMb >= 0 ? '+' : ''}${deltaMb} MB`,
      severity:
        Math.abs(deltaMb) >= this.options.memoryJumpMb ? 'warn' : 'info',
      data: { beforeMb, afterMb, deltaMb },
    });
  }

  getEvents(): readonly TimelineEvent[] {
    return this.events;
  }

  /**
   * Find the notable events in the window just before a problem event (defaults
   * to the most recent one) and treat them as likely causes.
   */
  correlate(target?: TimelineEvent): TimelineCorrelation | null {
    const event = target ?? this.lastProblem();
    if (!event) {
      return null;
    }
    const from = event.timestamp - this.options.correlationWindowMs;
    const causes = this.events
      .filter(
        (candidate) =>
          candidate.id !== event.id &&
          candidate.timestamp <= event.timestamp &&
          candidate.timestamp >= from &&
          (candidate.type === 'render' ||
            candidate.type === 'network' ||
            candidate.type === 'navigation' ||
            candidate.type === 'memory') &&
          (candidate.severity !== 'info' || candidate.durationMs !== undefined),
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      event,
      causes: causes.map((cause) => ({ ...cause })),
      summary: causes.length ? this.describeCauses(causes) : null,
    };
  }

  /** Export the session as a portable object. */
  export(): { session: string; startedAt: number; events: TimelineEvent[] } {
    return {
      session: this.sessionId,
      startedAt: this.startedAt,
      events: this.events.map((event) => ({ ...event })),
    };
  }

  /** Clear events and restart the session clock (keeps the session id). */
  clear(): void {
    this.events.length = 0;
    this.startedAt = this.options.now();
    this.options.onChange([]);
  }

  private lastProblem(): TimelineEvent | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i];
      if (event && (event.type === 'fps' || event.severity !== 'info')) {
        return event;
      }
    }
    return undefined;
  }

  private describeCauses(causes: TimelineEvent[]): string {
    const parts = causes.map((cause) => {
      switch (cause.type) {
        case 'render':
          return `${cause.label} render (${cause.durationMs}ms)`;
        case 'network':
          return `${cause.label} (${cause.durationMs}ms)`;
        case 'navigation':
          return `navigation → ${cause.label}`;
        case 'memory':
          return cause.label;
        default:
          return cause.label;
      }
    });
    return `Possible cause: ${parts.join(' + ')}`;
  }
}
