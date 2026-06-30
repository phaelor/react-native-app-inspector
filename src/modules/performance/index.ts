import type { NativeMetrics, PerformanceSample } from '../../core/types';
import { FrameWindow } from './frameStats';

/** Tuning + injection points for {@link PerformanceMonitor}. */
export interface PerformanceMonitorOptions {
  /** How often (ms) an aggregated sample is emitted. Default 1000. */
  sampleIntervalMs?: number;
  /** Max samples retained (ring buffer). Default 120. */
  maxSamples?: number;
  /** Frame durations (ms) above this count as janky. Default 50. */
  jankThresholdMs?: number;
  /** Schedule a frame callback. Defaults to `requestAnimationFrame`. */
  scheduleFrame?: (cb: (ts: number) => void) => number;
  /** Cancel a scheduled frame. Defaults to `cancelAnimationFrame`. */
  cancelFrame?: (handle: number) => void;
  /** Wall clock (epoch ms) for sample timestamps. Defaults to `Date.now`. */
  now?: () => number;
  /** Read JS heap usage. Defaults to `performance.memory` when present. */
  readMemory?: () => Pick<PerformanceSample, 'jsHeapUsedMb' | 'jsHeapTotalMb'>;
  /**
   * Read native metrics (UI-thread FPS, resident memory) from the native
   * module. Defaults to none (`uiFps` stays 0, `usedMemoryMb` undefined).
   */
  readNative?: () => Partial<NativeMetrics>;
  /** Called with each emitted sample (e.g. to push into the inspector store). */
  onSample?: (sample: PerformanceSample) => void;
}

type FrameCallback = (ts: number) => void;

/** The subset of host globals we touch, accessed without a DOM/Node lib dep. */
interface PerfGlobals {
  requestAnimationFrame?: (cb: FrameCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  setTimeout?: (cb: () => void, ms: number) => number;
  clearTimeout?: (handle: number) => void;
  performance?: {
    now?: () => number;
    memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
  };
}

const g = globalThis as unknown as PerfGlobals;

const BYTES_PER_MB = 1024 * 1024;
const roundMb = (bytes: number): number =>
  Math.round((bytes / BYTES_PER_MB) * 10) / 10;

function monotonicNow(): number {
  const perf = g.performance;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
}

function defaultScheduleFrame(cb: FrameCallback): number {
  if (g.requestAnimationFrame) {
    return g.requestAnimationFrame(cb);
  }
  // Fallback ~60Hz for environments without rAF (e.g. plain Node).
  return g.setTimeout ? g.setTimeout(() => cb(monotonicNow()), 16) : 0;
}

function defaultCancelFrame(handle: number): void {
  if (g.cancelAnimationFrame) {
    g.cancelAnimationFrame(handle);
  } else {
    // Matches the setTimeout fallback in defaultScheduleFrame.
    g.clearTimeout?.(handle);
  }
}

function defaultReadMemory(): Pick<
  PerformanceSample,
  'jsHeapUsedMb' | 'jsHeapTotalMb'
> {
  const mem = g.performance?.memory;
  if (mem && typeof mem.usedJSHeapSize === 'number') {
    return {
      jsHeapUsedMb: roundMb(mem.usedJSHeapSize),
      jsHeapTotalMb:
        typeof mem.totalJSHeapSize === 'number'
          ? roundMb(mem.totalJSHeapSize)
          : undefined,
    };
  }
  return {};
}

/**
 * Samples runtime performance. Drives a `requestAnimationFrame` loop to measure
 * JS-thread FPS and jank ({@link FrameWindow}), reads JS heap, and merges in the
 * native metrics (UI-thread FPS, CPU, RSS) when a `readNative` hook is provided.
 * Emits a {@link PerformanceSample} every `sampleIntervalMs`.
 *
 * The scheduler, clock and memory readers are injectable so the FPS math can be
 * tested without the RN runtime.
 */
export class PerformanceMonitor {
  private readonly samples: PerformanceSample[] = [];
  private readonly window: FrameWindow;
  private readonly options: Required<PerformanceMonitorOptions>;
  private readonly tick: FrameCallback;
  private frameHandle: number | null = null;
  private windowStart: number | null = null;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.options = {
      sampleIntervalMs: options.sampleIntervalMs ?? 1000,
      maxSamples: options.maxSamples ?? 120,
      jankThresholdMs: options.jankThresholdMs ?? 50,
      scheduleFrame: options.scheduleFrame ?? defaultScheduleFrame,
      cancelFrame: options.cancelFrame ?? defaultCancelFrame,
      now: options.now ?? Date.now,
      readMemory: options.readMemory ?? defaultReadMemory,
      readNative: options.readNative ?? (() => ({})),
      onSample: options.onSample ?? (() => {}),
    };
    this.window = new FrameWindow(this.options.jankThresholdMs);
    this.tick = (ts: number): void => this.onFrame(ts);
  }

  isRunning(): boolean {
    return this.frameHandle !== null;
  }

  /** Begin the frame-rate loop. No-op if already running. */
  start(): void {
    if (this.frameHandle !== null) {
      return;
    }
    this.window.reset();
    this.windowStart = null;
    this.frameHandle = this.options.scheduleFrame(this.tick);
  }

  /** Stop the loop and cancel the pending frame. */
  stop(): void {
    if (this.frameHandle !== null) {
      this.options.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  private onFrame(ts: number): void {
    if (this.windowStart === null) {
      this.windowStart = ts;
    }
    this.window.record(ts);

    if (ts - this.windowStart >= this.options.sampleIntervalMs) {
      this.emitSample(ts);
      this.window.reset();
      this.windowStart = ts;
    }

    if (this.frameHandle !== null) {
      this.frameHandle = this.options.scheduleFrame(this.tick);
    }
  }

  private emitSample(ts: number): void {
    const native = this.options.readNative();
    const sample: PerformanceSample = {
      timestamp: this.options.now(),
      jsFps: this.window.fps(ts),
      uiFps: native.uiFps ?? 0,
      jankyFrames: this.window.jankyFrames,
      longestFrameMs: this.window.longestFrameMs,
      ...this.options.readMemory(),
      ...(native.usedMemoryMb !== undefined
        ? { usedMemoryMb: native.usedMemoryMb }
        : {}),
      ...(native.cpuPercent !== undefined
        ? { cpuPercent: native.cpuPercent }
        : {}),
    };
    this.samples.push(sample);
    if (this.samples.length > this.options.maxSamples) {
      this.samples.shift();
    }
    this.options.onSample(sample);
  }

  /** The most recent sample, if any. */
  getCurrent(): PerformanceSample | undefined {
    return this.samples[this.samples.length - 1];
  }

  getSamples(): readonly PerformanceSample[] {
    return this.samples;
  }

  clear(): void {
    this.samples.length = 0;
  }
}
