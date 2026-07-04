import { NativeEventEmitter, NativeModules } from 'react-native';
import type { NativeMetricsProvider } from '../core';
import type { NativeMetrics } from '../core/types';

interface AppInspectorNativeModule {
  startMonitoring(intervalMs: number): void;
  stopMonitoring(): void;
  getProcessStartTime(): Promise<number>;
  watchNextFrame(): Promise<number>;
}

const EVENT_NAME = 'AppInspectorMetrics';

const LINKING_HINT =
  '[react-native-app-inspector] native module not linked — rebuild the app ' +
  '(pod install / gradle) to enable UI-thread FPS and native memory. JS-thread ' +
  'FPS and heap still work without it.';

const nativeModule = NativeModules.AppInspector as
  | AppInspectorNativeModule
  | undefined;

/**
 * Bridges the native module's metric stream into the inspector. Works on both
 * the old and new architecture. If the native module isn't linked (e.g. before
 * a rebuild, or in JS-only tests) it becomes a no-op and warns once.
 */
class NativeMetricsBridge implements NativeMetricsProvider {
  private latest: NativeMetrics = { uiFps: 0, usedMemoryMb: 0, cpuPercent: 0 };
  private emitter: NativeEventEmitter | null = null;
  private subscription: { remove(): void } | null = null;
  private warned = false;

  isAvailable(): boolean {
    return nativeModule != null;
  }

  start(intervalMs: number): void {
    if (!nativeModule) {
      this.warnMissing();
      return;
    }
    if (!this.emitter) {
      this.emitter = new NativeEventEmitter(NativeModules.AppInspector);
    }
    this.subscription = this.emitter.addListener(
      EVENT_NAME,
      (metrics: NativeMetrics) => {
        this.latest = metrics;
      },
    );
    nativeModule.startMonitoring(intervalMs);
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    nativeModule?.stopMonitoring();
    this.latest = { uiFps: 0, usedMemoryMb: 0, cpuPercent: 0 };
  }

  getLatest(): NativeMetrics {
    return this.latest;
  }

  async getProcessStartTime(): Promise<number | undefined> {
    if (!nativeModule) {
      return undefined;
    }
    try {
      return await nativeModule.getProcessStartTime();
    } catch {
      return undefined;
    }
  }

  async watchNextFrame(): Promise<number | null> {
    if (!nativeModule?.watchNextFrame) {
      return null;
    }
    try {
      const presentedAtMs = await nativeModule.watchNextFrame();
      return presentedAtMs > 0 ? presentedAtMs : null;
    } catch {
      return null;
    }
  }

  private warnMissing(): void {
    if (!this.warned) {
      this.warned = true;
      console.warn(LINKING_HINT);
    }
  }
}

/** Singleton native metrics bridge, registered with the controller on import. */
export const NativeMetricsModule = new NativeMetricsBridge();
