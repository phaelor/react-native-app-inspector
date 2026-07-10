import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import type { InspectorState } from '../../core';
import type { PerformanceSample } from '../../core/types';
import { Row } from './Row';
import { Sparkline } from '../Sparkline';
import { usePerfSeries } from '../usePerfSeries';
import { fpsColor } from '../theme';
import { usePanelStyles } from './styles';

function mb(value: number | undefined): string {
  return value !== undefined ? `${value} MB` : 'n/a';
}

function Chart({
  label,
  value,
  values,
  color,
  max,
}: {
  label: string;
  value: string;
  values: number[];
  color: string;
  max?: number;
}): ReactElement {
  const { styles } = usePanelStyles();
  return (
    <View style={styles.chartRow}>
      <View style={styles.chartHead}>
        <Text style={styles.chartLabel}>{label}</Text>
        <Text style={styles.chartValue}>{value}</Text>
      </View>
      <Sparkline values={values} color={color} height={28} max={max} />
    </View>
  );
}

/** Live JS/UI FPS, jank and memory with sparklines over recent samples. */
export function PerformanceTab({
  state,
}: {
  state: InspectorState;
}): ReactElement {
  const { styles, theme } = usePanelStyles();
  const samples = state.performance;
  const series = usePerfSeries(samples);
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
      <Chart
        label="JS FPS"
        value={String(latest.jsFps)}
        values={series.jsFps}
        color={fpsColor(theme, latest.jsFps)}
        max={60}
      />
      {series.cpuPercent.some((v) => v > 0) ? (
        <Chart
          label="CPU %"
          value={
            latest.cpuPercent !== undefined ? `${latest.cpuPercent}%` : 'n/a'
          }
          values={series.cpuPercent}
          color={theme.accent}
        />
      ) : null}
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
