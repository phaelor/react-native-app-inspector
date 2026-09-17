import { NativeEventEmitter } from 'react-native';
import type { NativeMetricsProvider } from '../core';
import type {
  NativeMetrics,
  NativeNetworkEvent,
  NetworkCaptureOptions,
} from '../core/types';
import { DEFAULT_MAX_BODY_BYTES } from '../modules/network/redact';
import NativeAppInspector, { type Spec } from './NativeAppInspector';

const EVENT_NAME = 'AppInspectorMetrics';
const NETWORK_EVENT_NAME = 'AppInspectorNetwork';

const LINKING_HINT =
  '[react-native-app-inspector] native module not linked — rebuild the app ' +
  '(pod install / gradle) to enable UI-thread FPS and native memory. JS-thread ' +
  'FPS and heap still work without it.';

const nativeModule: Spec | null = NativeAppInspector;

/**
 * Bridges the native module's metric stream into the inspector. Works on both
 * the old and new architecture. If the native module isn't linked (e.g. before
 * a rebuild, or in JS-only tests) it becomes a no-op and warns once.
 */
class NativeMetricsBridge implements NativeMetricsProvider {
  private latest: NativeMetrics = { uiFps: 0, usedMemoryMb: 0, cpuPercent: 0 };
  private emitter: NativeEventEmitter | null = null;
  private subscription: { remove(): void } | null = null;
  private networkSubscription: { remove(): void } | null = null;
  private warned = false;

  isAvailable(): boolean {
    return nativeModule != null;
  }

  private getEmitter(): NativeEventEmitter {
    if (!this.emitter) {
      // iOS requires the module for RCTEventEmitter's listener bookkeeping.
      this.emitter = new NativeEventEmitter(nativeModule ?? undefined);
    }
    return this.emitter;
  }

  start(intervalMs: number): void {
    if (!nativeModule) {
      this.warnMissing();
      return;
    }
    this.subscription = this.getEmitter().addListener(
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

  supportsNetworkCapture(): boolean {
    if (typeof nativeModule?.startNetworkCapture !== 'function') {
      return false;
    }
    // Legacy modules expose constants as properties, TurboModules only via
    // getConstants(); older native builds ship neither.
    const constants =
      typeof nativeModule.getConstants === 'function'
        ? nativeModule.getConstants()
        : (nativeModule as unknown as { networkCaptureAvailable?: boolean });
    return constants?.networkCaptureAvailable !== false;
  }

  startNetworkCapture(
    onEntry: (event: NativeNetworkEvent) => void,
    options: NetworkCaptureOptions = {},
  ): void {
    if (!this.supportsNetworkCapture()) {
      return;
    }
    this.networkSubscription?.remove();
    this.networkSubscription = this.getEmitter().addListener(
      NETWORK_EVENT_NAME,
      onEntry,
    );
    nativeModule?.startNetworkCapture?.(
      options.captureBodies ?? true,
      options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
      options.captureHeaders ?? true,
    );
  }

  stopNetworkCapture(): void {
    this.networkSubscription?.remove();
    this.networkSubscription = null;
    nativeModule?.stopNetworkCapture?.();
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
