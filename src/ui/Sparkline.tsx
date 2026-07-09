import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

export interface SparklineProps {
  /** Series to plot, oldest first. */
  values: readonly number[];
  color: string;
  /** Bar area height in px. */
  height?: number;
  /** Fixed full-height ceiling; values above it clamp. Defaults to the peak. */
  max?: number;
}

/** Dependency-free bar sparkline: one bar per sample, height ∝ value. */
export function Sparkline({
  values,
  color,
  height = 24,
  max,
}: SparklineProps): ReactElement {
  const peak = Math.max(max ?? Math.max(...values), 1);
  return (
    <View style={[styles.row, { height }]}>
      {values.map((value, i) => {
        const ratio = Math.min(1, Math.max(0, value) / peak);
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(1, ratio * height),
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
});
