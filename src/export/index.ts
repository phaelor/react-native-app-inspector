import type { InspectorSnapshot } from '../core/types';
import { AppInspector } from '../core';

/** Supported serialization formats for an exported snapshot. */
export type ExportFormat = 'json';

/** Build an aggregated snapshot from the controller's live module buffers. */
export function buildSnapshot(): InspectorSnapshot {
  return AppInspector.getSnapshot();
}

/**
 * Serialize the current snapshot to a string. JSON is the only format today.
 * To open the native share sheet with the result, use {@link shareLogs} from
 * `./share`.
 */
export function exportLogs(format: ExportFormat = 'json'): string {
  const snapshot = buildSnapshot();
  switch (format) {
    case 'json':
    default:
      return JSON.stringify(snapshot, null, 2);
  }
}
