import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import type { InspectorState } from '../../core';
import type { PerformanceSample } from '../../core/types';
import { Row } from './Row';
import { usePanelStyles } from './styles';

function mb(value: number | undefined): string {
  return value !== undefined ? `${value} MB` : 'n/a';
}

/** Live JS/UI FPS, jank and memory from the latest performance sample. */
export function PerformanceTab({
  state,
}: {
  state: InspectorState;
}): ReactElement {
  const { styles } = usePanelStyles();
  const samples = state.performance;
  const latest: PerformanceSample | undefined = samples[samples.length - 1];
  const fpsValues = samples.map((s) => s.jsFps).filter((f) => f > 0);
  const minFps = fpsValues.length ? Math.min(...fpsValues) : 0;
  const avgFps = fpsValues.length
    ? Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length)
    : 0;

  if (!latest) {
    return <Text style={styles.empty}>Waiting for samples…</Text>;
  }

  return (
    <View>
      <Row label="JS FPS" value={String(latest.jsFps)} />
      <Row
        label="UI FPS"
        value={latest.uiFps > 0 ? String(latest.uiFps) : 'n/a'}
      />
      <Row label="FPS min / avg" value={`${minFps} / ${avgFps}`} />
      <Row label="janky frames" value={String(latest.jankyFrames)} />
      <Row label="longest frame" value={`${latest.longestFrameMs} ms`} />
      <Row
        label="CPU"
        value={
          latest.cpuPercent !== undefined ? `${latest.cpuPercent}%` : 'n/a'
        }
      />
      <Row label="JS heap" value={mb(latest.jsHeapUsedMb)} />
      <Row label="RSS" value={mb(latest.usedMemoryMb)} />
    </View>
  );
}
