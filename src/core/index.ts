import type {
  AppInspectorConfig,
  DeviceInfoSnapshot,
  InspectorSnapshot,
  NativeMetrics,
  NetworkLogEntry,
  PerformanceSample,
  TimelineCorrelation,
  TimelineEvent,
} from './types';
import { InspectorStore, type InspectorState } from './store';
import { PerformanceMonitor } from '../modules/performance';
import { RenderTracker } from '../modules/render';
import { StartupTracker } from '../modules/startup';
import { Timeline, type NetworkEventInput } from '../modules/timeline';
import { NetworkLogger } from '../modules/network';
import { ActionLogger } from '../modules/actions';
import { ErrorTracker } from '../modules/errors';
import {
  SessionPersistence,
  type PersistedSession,
} from '../modules/persistence';
import { ScreenMonitor } from '../modules/screens';
import { InteractionTracker } from '../modules/interactions';
import { uid } from './uid';

export * from './types';
export type { InspectorState } from './store';

/** FPS at/below which a drop is recorded on the timeline. */
const FPS_DROP_THRESHOLD = 45;
/** FPS at/above which a thread is considered healthy (baseline). */
const FPS_HEALTHY = 50;
/** Memory jump (MB) that lands on the timeline. */
const MEMORY_JUMP_MB = 50;

/** Detect an FPS drop on either the JS or UI thread between two samples. */
function detectFpsDrop(
  prev: PerformanceSample,
  next: PerformanceSample,
): { from: number; to: number } | null {
  const dropped = (prevFps: number, nextFps: number): boolean =>
    prevFps >= FPS_HEALTHY && nextFps > 0 && nextFps <= FPS_DROP_THRESHOLD;

  if (dropped(prev.jsFps, next.jsFps)) {
    return { from: prev.jsFps, to: next.jsFps };
  }
  if (dropped(prev.uiFps, next.uiFps)) {
    return { from: prev.uiFps, to: next.uiFps };
  }
  return null;
}

/**
 * Bridge to the native module (UI-thread FPS, resident memory, process start).
 * Implemented by `src/native` and registered from the package entry point so
 * that `core` stays free of any `react-native` import.
 */
export interface NativeMetricsProvider {
  isAvailable(): boolean;
  start(intervalMs: number): void;
  stop(): void;
  getLatest(): NativeMetrics;
  getProcessStartTime(): Promise<number | undefined>;
  /** Next presented frame's timestamp (ms, OS monotonic clock), or `null`. */
  watchNextFrame(): Promise<number | null>;
}

/** Config with all module flags resolved; `storage` is held separately. */
type ResolvedConfig = Required<Omit<AppInspectorConfig, 'storage'>>;

const DEFAULT_CONFIG: ResolvedConfig = {
  enabled: true,
  maxEntries: 500,
  modules: {
    network: true,
    actions: true,
    deviceInfo: true,
    performance: true,
    errors: true,
    slowScreens: true,
  },
};

/**
 * Central controller for the in-app debug panel.
 *
 * Owns the shared {@link InspectorStore}, orchestrates the capture modules
 * based on config, and exposes a snapshot for export. The UI subscribes via
 * {@link AppInspectorController.subscribe}.
 */
class AppInspectorController {
  private config: ResolvedConfig = DEFAULT_CONFIG;
  private persistence: SessionPersistence | null = null;
  private previousSession: PersistedSession | null = null;
  private running = false;
  private readonly store = new InspectorStore(DEFAULT_CONFIG.maxEntries);
  private perf: PerformanceMonitor | null = null;
  private readonly timeline = new Timeline({
    onChange: (events) => this.store.setTimeline(events),
  });
  private readonly screenMonitor = new ScreenMonitor({
    onChange: (reports) => this.store.setScreens(reports),
  });
  private readonly renderTracker = new RenderTracker({
    onChange: (stats) => this.store.setRenders(stats),
    onCommit: (id, phase, ms) => {
      this.timeline.trackRender(id, ms, phase);
      if (this.config.modules.slowScreens) {
        this.screenMonitor.recordRender(id, ms);
      }
      this.interactionTracker.notifyCommit();
    },
  });
  private readonly interactionTracker = new InteractionTracker({
    watchFramePresentation: () =>
      this.nativeMetrics?.watchNextFrame() ?? Promise.resolve(null),
    onComplete: ({ label, latencyMs }) => {
      this.timeline.trackInteraction(label, latencyMs);
      if (this.config.modules.slowScreens) {
        this.screenMonitor.recordInteraction(label, latencyMs);
      }
    },
  });
  private readonly startupTracker = new StartupTracker({
    onChange: (timings) => this.store.setStartup(timings),
  });
  private nativeMetrics: NativeMetricsProvider | null = null;
  private deviceInfoProvider: (() => DeviceInfoSnapshot) | null = null;
  private lastSample: PerformanceSample | null = null;
  private readonly networkLogger = new NetworkLogger({
    onEntry: (entry) => this.recordNetwork(entry),
  });
  private readonly actionLogger = new ActionLogger({
    onEntry: (entry) => {
      this.store.pushAction(entry);
      this.timeline.trackAction(entry.type, { payload: entry.payload });
    },
  });
  private readonly errorTracker = new ErrorTracker({
    onEntry: (entry) => {
      this.timeline.trackError(entry.message, entry.severity, {
        source: entry.source,
        fatal: entry.fatal,
      });
      // Persist before a fatal error takes the process down, so the session is
      // inspectable after relaunch.
      if (entry.fatal) {
        void this.persist();
      }
    },
  });

  /** Register the native metrics bridge (called from the package entry point). */
  setNativeMetricsProvider(provider: NativeMetricsProvider | null): void {
    this.nativeMetrics = provider;
  }

  /**
   * Register the device-info source (called from the package entry point so
   * that `core` stays free of any `react-native` import).
   */
  setDeviceInfoProvider(provider: (() => DeviceInfoSnapshot) | null): void {
    this.deviceInfoProvider = provider;
  }

  /**
   * Merge user options over the defaults. Call once, early in app startup.
   * Changing module flags after `start()` only takes effect on the next
   * `start()`.
   */
  configure(config: AppInspectorConfig = {}): void {
    const { storage, ...rest } = config;
    this.config = {
      ...DEFAULT_CONFIG,
      ...rest,
      modules: { ...DEFAULT_CONFIG.modules, ...config.modules },
    };
    this.store.setMaxEntries(this.config.maxEntries);
    this.persistence = storage ? new SessionPersistence(storage) : null;
    this.previousSession = null;
  }

  /** Start the enabled capture modules. No-op while disabled or running. */
  start(): void {
    if (!this.config.enabled || this.running) {
      return;
    }
    this.running = true;
    this.lastSample = null;

    if (this.persistence) {
      void this.persistence.loadPrevious().then((session) => {
        this.previousSession = session;
      });
    }

    if (this.config.modules.deviceInfo && this.deviceInfoProvider) {
      this.store.setDevice(this.deviceInfoProvider());
    }

    if (this.config.modules.network) {
      this.networkLogger.start();
    }

    if (this.config.modules.errors) {
      this.errorTracker.start();
    }

    if (this.config.modules.performance) {
      const native = this.nativeMetrics;
      const useNative = native?.isAvailable() ?? false;

      if (useNative && native) {
        native.start(1000);
        native
          .getProcessStartTime()
          .then((startedAt) => {
            if (startedAt !== undefined) {
              this.startupTracker.setBaseline(startedAt);
            }
          })
          .catch(() => {
            /* native start time is best-effort */
          });
      }

      this.perf = new PerformanceMonitor({
        maxSamples: this.config.maxEntries,
        readNative: useNative && native ? () => native.getLatest() : undefined,
        onSample: (sample) => this.handlePerfSample(sample),
      });
      this.perf.start();
    }
  }

  /** Store a sample and raise timeline events for FPS drops / memory jumps. */
  private handlePerfSample(sample: PerformanceSample): void {
    this.store.pushPerformance(sample);

    if (this.config.modules.slowScreens) {
      this.screenMonitor.recordSample({
        fps: sample.uiFps > 0 ? sample.uiFps : sample.jsFps,
        jank: sample.jankyFrames,
        memoryMb: sample.usedMemoryMb,
      });
    }

    const prev = this.lastSample;
    if (prev) {
      // A drop on either thread is notable: the JS thread catches blocking
      // work / heavy renders, the UI thread catches native-side jank.
      const drop = detectFpsDrop(prev, sample);
      if (drop) {
        this.timeline.trackFpsDrop(drop.from, drop.to);
        if (this.config.modules.slowScreens) {
          this.screenMonitor.recordFpsDrop();
        }
      }

      if (
        sample.usedMemoryMb !== undefined &&
        prev.usedMemoryMb !== undefined &&
        Math.abs(sample.usedMemoryMb - prev.usedMemoryMb) >= MEMORY_JUMP_MB
      ) {
        this.timeline.trackMemory(prev.usedMemoryMb, sample.usedMemoryMb);
      }
    }
    this.lastSample = sample;
  }

  /** Stop all capture modules. Retains captured data (use {@link clear}). */
  stop(): void {
    this.perf?.stop();
    this.perf = null;
    this.nativeMetrics?.stop();
    this.networkLogger.stop();
    this.errorTracker.stop();
    void this.persist();
    this.running = false;
  }

  /** The session persisted before the last crash/relaunch, if any. */
  getPreviousSession(): PersistedSession | null {
    return this.previousSession;
  }

  /** Save the current session now (best-effort; no-op without `storage`). */
  async persist(): Promise<void> {
    if (this.persistence) {
      await this.persistence.save(this.timeline.export());
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Current, resolved configuration (read-only). */
  getConfig(): Readonly<ResolvedConfig> {
    return this.config;
  }

  /** Subscribe to live state changes. Returns an unsubscribe function. */
  subscribe(listener: (state: InspectorState) => void): () => void {
    return this.store.subscribe(listener);
  }

  /** The current live state (read-only). */
  getState(): Readonly<InspectorState> {
    return this.store.getState();
  }

  /** The shared store — capture modules push into it. */
  getStore(): InspectorStore {
    return this.store;
  }

  /** The render tracker — used by {@link InspectorProfiler}. */
  getRenderTracker(): RenderTracker {
    return this.renderTracker;
  }

  /** The interaction tracker — used by {@link InspectorPressable}. */
  getInteractionTracker(): InteractionTracker {
    return this.interactionTracker;
  }

  /**
   * Start measuring a tap-to-response interaction manually; call the returned
   * function when the UI has visibly responded. Pass the triggering touch's
   * `e.nativeEvent.timestamp` for native-accurate timing.
   */
  beginInteraction(label: string, nativeTimestampMs?: number): () => void {
    return this.interactionTracker.begin(label, { nativeTimestampMs });
  }

  /** The unified performance timeline. */
  getTimeline(): Timeline {
    return this.timeline;
  }

  /** The action logger — exposes a Redux middleware via `.middleware()`. */
  getActionLogger(): ActionLogger {
    return this.actionLogger;
  }

  /** Record a user action (lands in the action log and on the timeline). */
  trackAction(name: string, data?: Record<string, unknown>): void {
    this.store.pushAction({
      id: uid('act'),
      type: name,
      payload: data,
      timestamp: Date.now(),
    });
    this.timeline.trackAction(name, data);
  }

  /** Record a screen transition and set the active screen for later events. */
  trackNavigation(to: string, transitionMs?: number): void {
    this.timeline.trackNavigation(to, transitionMs);
    if (this.config.modules.slowScreens) {
      this.screenMonitor.enter(to);
    }
  }

  /** Manually record an error on the timeline. */
  trackError(message: string, data?: Record<string, unknown>): void {
    this.timeline.trackError(message, 'error', data);
  }

  /** Record a completed network request (manual; auto-capture also uses this). */
  trackNetwork(input: NetworkEventInput): void {
    this.recordNetwork({
      id: uid('net'),
      method: input.method,
      url: input.url,
      status: input.status,
      startedAt: Date.now() - input.durationMs,
      durationMs: input.durationMs,
    });
  }

  /** Push a network entry into both the store buffer and the timeline. */
  private recordNetwork(entry: NetworkLogEntry): void {
    this.store.pushNetwork(entry);
    this.timeline.trackNetwork({
      method: entry.method,
      url: entry.url,
      status: entry.status,
      durationMs: entry.durationMs ?? 0,
    });
    if (this.config.modules.slowScreens) {
      this.screenMonitor.recordNetwork(entry.url, entry.durationMs ?? 0);
    }
  }

  /** Explain a problem event (defaults to the latest) via its likely causes. */
  correlate(event?: TimelineEvent): TimelineCorrelation | null {
    return this.timeline.correlate(event);
  }

  /** Export the timeline session as a portable object. */
  exportTimeline(): ReturnType<Timeline['export']> {
    return this.timeline.export();
  }

  /** Record a startup / navigation timing mark (also lands on the timeline). */
  mark(name: string): void {
    this.startupTracker.mark(name);
    this.timeline.trackLifecycle(name);
  }

  /** Mark the app interactive (records time-to-interactive). */
  markInteractive(): void {
    this.startupTracker.markInteractive();
    if (this.config.modules.slowScreens) {
      this.screenMonitor.markInteractive();
    }
  }

  /** Set the startup baseline (e.g. native process-start timestamp). */
  setStartupBaseline(epochMs: number): void {
    this.startupTracker.setBaseline(epochMs);
  }

  /** Build an export-ready snapshot of the current state. */
  getSnapshot(): InspectorSnapshot {
    const state = this.store.getState();
    return {
      network: [...state.network],
      actions: [...state.actions],
      device: state.device,
      performance: [...state.performance],
      renders: [...state.renders],
      startup: { ...state.startup, marks: [...state.startup.marks] },
      timeline: [...state.timeline],
      screens: [...state.screens],
      exportedAt: Date.now(),
    };
  }

  /** Clear all captured buffers. */
  clear(): void {
    this.timeline.clear();
    this.screenMonitor.clear();
    this.interactionTracker.clear();
    this.store.clear();
  }
}

/** Singleton entry point for the inspector. */
export const AppInspector = new AppInspectorController();

export type { AppInspectorController };
