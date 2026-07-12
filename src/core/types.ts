/**
 * Shared types for the public API surface of react-native-app-inspector.
 */

/**
 * Minimal async key/value storage — structurally compatible with
 * `@react-native-async-storage/async-storage` and most file/MMKV wrappers, so
 * the library stays dependency-free and the host plugs in whatever it has.
 */
export interface PersistenceAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Minimal clipboard — structurally compatible with
 * `@react-native-clipboard/clipboard` and React Native's core `Clipboard`, so
 * the library stays dependency-free and the host plugs in whatever it has.
 */
export interface ClipboardAdapter {
  setString(text: string): void;
}

/** Toggle individual capture modules on or off. */
export interface ModuleFlags {
  network?: boolean;
  actions?: boolean;
  deviceInfo?: boolean;
  performance?: boolean;
  /** Capture uncaught JS errors and `console.error` / `console.warn`. */
  errors?: boolean;
  /** Build per-screen performance profiles (the slow-screen detector). */
  slowScreens?: boolean;
}

export interface StorageInspectorAdapter {
  /** Name shown in the tab's switcher, e.g. "AsyncStorage", "MMKV (user)". */
  name: string;
  getAllKeys(): Promise<string[]>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear?(): Promise<void>;
}

/** Options passed to {@link AppInspector.configure}. */
export interface AppInspectorConfig {
  /** Master switch. When `false` the inspector is fully inert. */
  enabled?: boolean;
  /** Maximum number of entries kept per ring buffer. */
  maxEntries?: number;
  /** Per-module enable flags. */
  modules?: ModuleFlags;
  /**
   * Optional key/value store (e.g. AsyncStorage) used to persist the last
   * session so it survives a crash/relaunch. When set, the previous session is
   * loaded on `start()` and the current one is saved on `stop()` and on a fatal
   * error. Read it back via {@link AppInspector.getPreviousSession}.
   */
  storage?: PersistenceAdapter;
  /**
   * Optional clipboard (e.g. `@react-native-clipboard/clipboard`) enabling
   * the Copy buttons in the inspector UI. Without it the UI falls back to
   * React Native's core `Clipboard` when available.
   */
  clipboard?: ClipboardAdapter;
  /**
   * Stores to browse in the Storage tab (see `asyncStorageAdapter` /
   * `mmkvAdapter`). When omitted and `storage` exposes `getAllKeys` (as
   * AsyncStorage does), a tab for it is derived automatically.
   */
  storages?: StorageInspectorAdapter[];
}

/** A single captured network request/response pair. */
export interface NetworkLogEntry {
  id: string;
  method: string;
  url: string;
  status?: number;
  /** Epoch milliseconds when the request started. */
  startedAt: number;
  durationMs?: number;
  requestBody?: unknown;
  responseBody?: unknown;
}

/** A single captured app/state action (Redux, navigation, custom, …). */
export interface ActionLogEntry {
  id: string;
  type: string;
  payload?: unknown;
  /** Epoch milliseconds when the action was dispatched. */
  timestamp: number;
}

/** A point-in-time snapshot of host device + app metadata. */
export interface DeviceInfoSnapshot {
  os: string;
  osVersion: string;
  appVersion: string;
  buildNumber: string;
  deviceModel: string;
  isEmulator: boolean;
}

/** A single performance sample (one tick of the performance monitor). */
export interface PerformanceSample {
  /** Epoch milliseconds when the sample was taken. */
  timestamp: number;
  /** JS thread frame rate, in frames per second. */
  jsFps: number;
  /**
   * UI / native thread frame rate, in frames per second.
   * `0` until native UI-thread sampling is wired up.
   */
  uiFps: number;
  /** Frames in the window slower than the jank threshold. */
  jankyFrames: number;
  /** Longest single frame duration observed in the window, in ms. */
  longestFrameMs: number;
  /** JS heap currently used, in megabytes (when the runtime exposes it). */
  jsHeapUsedMb?: number;
  /** JS heap limit, in megabytes (when the runtime exposes it). */
  jsHeapTotalMb?: number;
  /** App resident memory (RSS), in megabytes (when available natively). */
  usedMemoryMb?: number;
  /**
   * App CPU usage as a percentage of one core (can exceed 100% on multi-core),
   * sampled natively. `undefined` until the native module provides it.
   */
  cpuPercent?: number;
}

/** A completed request reported by the native network interceptor. */
export interface NativeNetworkEvent {
  method: string;
  url: string;
  /** HTTP status; `0` when the request failed before any response. */
  status: number;
  /** Epoch milliseconds when the request started. */
  startedAt: number;
  durationMs: number;
}

/** Live metrics read from the native module. */
export interface NativeMetrics {
  /** UI / native thread frame rate. */
  uiFps: number;
  /** Resident memory (RSS), in megabytes. */
  usedMemoryMb: number;
  /** App CPU usage as a percentage of one core (may exceed 100% multi-core). */
  cpuPercent: number;
}

/** Aggregated render stats for one tracked component id (via React Profiler). */
export interface RenderStat {
  id: string;
  /** Number of commits (renders) recorded. */
  commits: number;
  /** Commits caused by an initial mount. */
  mounts: number;
  /** Commits caused by an update (re-render). */
  updates: number;
  /** Sum of `actualDuration` across commits, in ms. */
  totalMs: number;
  /** Worst single commit `actualDuration`, in ms. */
  maxMs: number;
  /** Most recent commit `actualDuration`, in ms. */
  lastMs: number;
  /** Commits slower than the slow-render threshold (see RenderTracker). */
  slowCommits: number;
}

/** A single named startup / navigation timing mark. */
export interface StartupMark {
  name: string;
  /** Epoch milliseconds when the mark was recorded. */
  at: number;
  /** Milliseconds since the startup baseline. */
  sinceStartMs: number;
}

/** Aggregated startup + navigation timings. */
export interface StartupTimings {
  /**
   * Epoch milliseconds baseline — JS bundle start, or native process start
   * once the native module provides it.
   */
  startedAt?: number;
  /** Milliseconds from baseline to the first `interactive` mark. */
  timeToInteractiveMs?: number;
  /** Ordered timing marks (startup + screen transitions). */
  marks: StartupMark[];
}

/** One detected performance problem on a screen. */
export interface ScreenProblem {
  kind: 'load' | 'fps' | 'render' | 'memory' | 'network' | 'interaction';
  severity: 'warn' | 'error';
  /** Human-readable description, e.g. "Slow render — CheckoutList 620ms". */
  label: string;
}

/**
 * A performance profile for one screen: load timing, render, FPS, memory and
 * network rolled up into a 0–100 `score` and a list of `problems`.
 */
export interface ScreenProfile {
  screen: string;
  /** Times this screen was entered. */
  visits: number;
  /** Quality score, 0–100 (100 = healthy). */
  score: number;
  /** Worst navigation→interactive time across visits, in ms. */
  loadTimeMs?: number;
  /** Worst navigation→first-render time across visits, in ms. */
  firstRenderMs?: number;
  render: {
    commits: number;
    avgMs: number;
    slowRenders: number;
    worstMs: number;
    worstId?: string;
  };
  fps: {
    average: number;
    drops: number;
    jank: number;
  };
  memory: {
    startMb?: number;
    peakMb?: number;
    increaseMb?: number;
  };
  network: {
    requests: number;
    slowRequests: number;
    worstMs: number;
    worstUrl?: string;
  };
  interactions: {
    count: number;
    /** Interactions above the noticeable threshold (100ms, RAIL). */
    slowCount: number;
    worstMs: number;
    worstLabel?: string;
  };
  /** Concrete issues, worst first. */
  problems: ScreenProblem[];
}

/** Kind of a timeline event. */
export type TimelineEventType =
  | 'lifecycle'
  | 'action'
  | 'navigation'
  | 'render'
  | 'network'
  | 'fps'
  | 'memory'
  | 'error'
  | 'interaction';

/** Visual severity used to colour timeline events. */
export type TimelineSeverity = 'info' | 'warn' | 'error';

/**
 * A single entry on the unified performance timeline. Span-like events
 * (navigation / network / render) carry a `durationMs`; instantaneous ones
 * (action / fps / memory) do not.
 */
export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  /** Short human label, e.g. "POST /orders" or "FPS drop". */
  label: string;
  /** Epoch milliseconds when the event occurred. */
  timestamp: number;
  /** Milliseconds since the timeline session start. */
  sinceStartMs: number;
  /** Screen active when the event happened, if known. */
  screen?: string;
  /** Duration in ms for span-like events. */
  durationMs?: number;
  severity: TimelineSeverity;
  /** Structured details (fps before/after, body size, memory delta, …). */
  data?: Record<string, unknown>;
}

/** Result of correlating a problem event with likely contributing events. */
export interface TimelineCorrelation {
  /** The event being explained (e.g. an FPS drop). */
  event: TimelineEvent;
  /** Notable events shortly before it that may have caused it. */
  causes: TimelineEvent[];
  /** One-line human summary, or null when nothing notable was found. */
  summary: string | null;
}

/** Aggregated state suitable for export/sharing. */
export interface InspectorSnapshot {
  network: NetworkLogEntry[];
  actions: ActionLogEntry[];
  device: DeviceInfoSnapshot | null;
  performance: PerformanceSample[];
  renders: RenderStat[];
  startup: StartupTimings;
  timeline: TimelineEvent[];
  screens: ScreenProfile[];
  /** Epoch milliseconds when the snapshot was produced. */
  exportedAt: number;
}
