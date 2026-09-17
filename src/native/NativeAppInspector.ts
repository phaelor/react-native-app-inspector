import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec of the native module. On the New Architecture this file is
 * compiled into the native spec (see `codegenConfig` in package.json); on the
 * legacy bridge `TurboModuleRegistry.get` falls back to `NativeModules`, so
 * the same object serves both.
 */
export interface Spec extends TurboModule {
  startMonitoring(intervalMs: number): void;
  stopMonitoring(): void;
  /** Epoch ms of process start; `0` when unavailable. */
  getProcessStartTime(): Promise<number>;
  /** Next presented frame's timestamp (ms, OS monotonic clock); `-1` on timeout. */
  watchNextFrame(): Promise<number>;
  startNetworkCapture(
    captureBodies: boolean,
    maxBodyBytes: number,
    captureHeaders: boolean,
  ): void;
  stopNetworkCapture(): void;
  getConstants(): {
    /** False when the OkHttp interceptor could not be installed (Android). */
    networkCaptureAvailable: boolean;
  };
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.get<Spec>('AppInspector');
