import { Platform } from 'react-native';
import type { DeviceInfoSnapshot } from '../../core/types';

const UNKNOWN = 'unknown';

interface AndroidConstants {
  Brand?: string;
  Model?: string;
  Manufacturer?: string;
  Fingerprint?: string;
  Release?: string;
}

interface IosConstants {
  systemName?: string;
  osVersion?: string;
  interfaceIdiom?: string;
  isTesting?: boolean;
}

/** Heuristic emulator/simulator detection from the platform fingerprint. */
function detectEmulator(): boolean {
  if (Platform.OS === 'android') {
    const c = Platform.constants as AndroidConstants;
    const haystack = `${c.Brand ?? ''} ${c.Model ?? ''} ${
      c.Manufacturer ?? ''
    } ${c.Fingerprint ?? ''}`.toLowerCase();
    return /generic|emulator|sdk_gphone|sdk built for|genymotion/.test(
      haystack,
    );
  }
  // iOS: the simulator defines these env vars in the native process.
  return (
    typeof process !== 'undefined' &&
    process.env?.SIMULATOR_DEVICE_NAME !== undefined
  );
}

function deviceModel(): string {
  if (Platform.OS === 'android') {
    const c = Platform.constants as AndroidConstants;
    const brand = c.Brand ?? c.Manufacturer;
    return [brand, c.Model].filter(Boolean).join(' ') || UNKNOWN;
  }
  if (Platform.OS === 'ios') {
    const c = Platform.constants as IosConstants;
    return c.systemName ?? 'iOS';
  }
  return UNKNOWN;
}

/**
 * Collects host device + OS metadata from React Native's `Platform`.
 *
 * App version / build number require a native source (e.g. a host build
 * constant); when absent they stay `"unknown"` rather than guessing.
 */
export function getDeviceInfo(): DeviceInfoSnapshot {
  return {
    os: Platform.OS,
    osVersion: String(Platform.Version),
    appVersion: UNKNOWN,
    buildNumber: UNKNOWN,
    deviceModel: deviceModel(),
    isEmulator: detectEmulator(),
  };
}
