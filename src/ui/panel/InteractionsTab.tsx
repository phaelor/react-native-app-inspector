import type { ReactElement } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { InspectorState } from '../../core';
import type { TimelineEvent } from '../../core/types';
import { Row } from './Row';
import { usePanelStyles } from './styles';
import type { Theme } from '../theme';

function latencyColor(
  theme: Theme,
  severity: TimelineEvent['severity'],
): string {
  if (severity === 'error') {
    return theme.bad;
  }
  if (severity === 'warn') {
    return theme.warn;
  }
  return theme.good;
}

function InteractionRow({ event }: { event: TimelineEvent }): ReactElement {
  const { styles, theme } = usePanelStyles();
  return (
    <View style={styles.eventRow}>
      <View
        style={[
          styles.dot,
          { backgroundColor: latencyColor(theme, event.severity) },
        ]}
      />
      <Text style={styles.eventLabel} numberOfLines={1}>
        {event.label}
      </Text>
      {event.screen ? (
        <Text style={styles.eventMeta}>{event.screen}</Text>
      ) : null}
      <Text
        style={[
          styles.rowValue,
          { color: latencyColor(theme, event.severity), marginLeft: 8 },
        ]}
      >
        {event.durationMs ?? 0}ms
      </Text>
    </View>
  );
}

/**
 * Tap-to-response latency: RAIL-scored summary plus the recent measured
 * interactions (auto-captured taps / `beginInteraction`). Owns its scrolling.
 */
export function InteractionsTab({
  state,
  search = '',
}: {
  state: InspectorState;
  search?: string;
}): ReactElement {
  const { styles } = usePanelStyles();
  const query = search.trim().toLowerCase();
  const all = state.timeline.filter((e) => e.type === 'interaction');
  const rows = all
    .filter((e) => query === '' || e.label.toLowerCase().includes(query))
    .reverse();

  const latencies = all.map((e) => e.durationMs ?? 0);
  const avg = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;
  const worst = latencies.length ? Math.max(...latencies) : 0;
  const slow = all.filter((e) => e.severity !== 'info').length;

  return (
    <FlatList
      style={[styles.body, styles.bodyFill]}
      contentContainerStyle={styles.bodyInner}
      data={rows}
      keyExtractor={(event) => event.id}
      renderItem={({ item }) => <InteractionRow event={item} />}
      initialNumToRender={20}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        all.length === 0 ? null : (
          <>
            <Row label="taps measured" value={String(all.length)} />
            <Row label="avg / worst" value={`${avg}ms / ${worst}ms`} />
            <Row label="slow (≥100ms)" value={String(slow)} />
            <Text style={styles.sectionTitle}>Recent taps</Text>
          </>
        )
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {all.length === 0
            ? 'No taps measured yet. Tap any button in the app, or call AppInspector.beginInteraction(label).'
            : 'No taps match this search.'}
        </Text>
      }
    />
  );
}
