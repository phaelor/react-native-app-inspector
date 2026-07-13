import type {
  ActionLogEntry,
  DeviceInfoSnapshot,
  NetworkLogEntry,
  PerformanceSample,
  RenderStat,
  ScreenProfile,
  StartupTimings,
  TimelineEvent,
} from './types';

/** Live, in-memory state shared between capture modules and the UI. */
export interface InspectorState {
  network: NetworkLogEntry[];
  actions: ActionLogEntry[];
  device: DeviceInfoSnapshot | null;
  performance: PerformanceSample[];
  renders: RenderStat[];
  startup: StartupTimings;
  timeline: TimelineEvent[];
  screens: ScreenProfile[];
}

type Listener = (state: InspectorState) => void;

function emptyState(): InspectorState {
  return {
    network: [],
    actions: [],
    device: null,
    performance: [],
    renders: [],
    startup: { marks: [] },
    timeline: [],
    screens: [],
  };
}

/**
 * Minimal observable store. Capture modules push into it; the UI subscribes.
 * State is treated as immutable (replaced, not mutated) so React can diff it.
 */
export class InspectorStore {
  private state: InspectorState = emptyState();
  private readonly listeners = new Set<Listener>();
  private maxEntries: number;
  private emitting = false;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  setMaxEntries(maxEntries: number): void {
    this.maxEntries = maxEntries;
  }

  getState(): Readonly<InspectorState> {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  pushNetwork(entry: NetworkLogEntry): void {
    this.state = {
      ...this.state,
      network: this.appended(this.state.network, entry),
    };
    this.emit();
  }

  pushAction(entry: ActionLogEntry): void {
    this.state = {
      ...this.state,
      actions: this.appended(this.state.actions, entry),
    };
    this.emit();
  }

  pushPerformance(sample: PerformanceSample): void {
    this.state = {
      ...this.state,
      performance: this.appended(this.state.performance, sample),
    };
    this.emit();
  }

  setRenders(renders: RenderStat[]): void {
    this.state = { ...this.state, renders };
    this.emit();
  }

  setStartup(startup: StartupTimings): void {
    this.state = { ...this.state, startup };
    this.emit();
  }

  setTimeline(timeline: TimelineEvent[]): void {
    this.state = { ...this.state, timeline };
    this.emit();
  }

  setScreens(screens: ScreenProfile[]): void {
    this.state = { ...this.state, screens };
    this.emit();
  }

  setDevice(device: DeviceInfoSnapshot | null): void {
    this.state = { ...this.state, device };
    this.emit();
  }

  clear(): void {
    this.state = emptyState();
    this.emit();
  }

  private appended<T>(arr: readonly T[], item: T): T[] {
    const next = arr.length >= this.maxEntries ? arr.slice(1) : arr.slice();
    next.push(item);
    return next;
  }

  private emit(): void {
    if (this.emitting) {
      return;
    }
    this.emitting = true;
    try {
      for (const listener of this.listeners) {
        listener(this.state);
      }
    } finally {
      this.emitting = false;
    }
  }
}
