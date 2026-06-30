import { Share } from 'react-native';
import { exportLogs, type ExportFormat } from './index';

/**
 * Open the native share sheet with the exported snapshot so a tester can attach
 * it to a ticket. Returns `true` if the user completed the share.
 *
 * Kept in its own module so the `react-native` import stays out of the
 * serialization core (which runs in pure-JS test environments).
 */
export async function shareLogs(
  format: ExportFormat = 'json',
): Promise<boolean> {
  const result = await Share.share({
    title: 'App Inspector session',
    message: exportLogs(format),
  });
  return result.action === Share.sharedAction;
}
