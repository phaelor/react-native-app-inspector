import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import type { PerformanceSample } from '../../core/types';
import { fpsColor } from '../theme';
import { usePanelStyles } from './styles';

/** Glanceable live summary: FPS · CPU · MEM. */
export function StatusStrip({
  latest,
}: {
  latest: PerformanceSample | undefined;
}): ReactElement {
  const { styles, theme } = usePanelStyles();
  const fps = latest?.uiFps && latest.uiFps > 0 ? latest.uiFps : latest?.jsFps;
  return (
    <View style={styles.status}>
      <View style={styles.statusItem}>
        <Text
          style={[styles.statusValue, { color: fpsColor(theme, fps ?? 0) }]}
        >
          {fps !== undefined && fps > 0 ? fps : '—'}
        </Text>
        <Text style={styles.statusLabel}>fps</Text>
      </View>
      <View style={styles.statusItem}>
        <Text style={styles.statusValue}>
          {latest?.cpuPercent !== undefined ? `${latest.cpuPercent}%` : '—'}
        </Text>
        <Text style={styles.statusLabel}>cpu</Text>
      </View>
      <View style={styles.statusItem}>
        <Text style={styles.statusValue}>
          {latest?.usedMemoryMb !== undefined
            ? `${Math.round(latest.usedMemoryMb)}`
            : '—'}
        </Text>
        <Text style={styles.statusLabel}>mb</Text>
      </View>
    </View>
  );
}
