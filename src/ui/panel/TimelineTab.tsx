import { useState } from 'react';
import type { ReactElement } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { AppInspector } from '../../core';
import type { InspectorState } from '../../core';
import type { TimelineEvent, TimelineSeverity } from '../../core/types';
import { Row } from './Row';
import { usePanelStyles } from './styles';

const TYPE_TAG: Record<TimelineEvent['type'], string> = {
  lifecycle: 'LIFE',
  action: 'ACT',
  navigation: 'NAV',
  render: 'RND',
  network: 'NET',
  fps: 'FPS',
  memory: 'MEM',
  error: 'ERR',
  interaction: 'TAP',
};

const SEVERITY_FILTERS: Array<{
  key: 'all' | TimelineSeverity;
  label: string;
}> = [
  { key: 'all', label: 'All' },
  { key: 'warn', label: 'Warn' },
  { key: 'error', label: 'Error' },
];

function severityColor(severity: TimelineSeverity): string {
  switch (severity) {
    case 'error':
      return '#ef4444';
    case 'warn':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

/**
 * Correlation banner. The leading badge is a styled view, not an emoji —
 * emoji glyphs are missing on some devices and render as "?".
 */
function CauseBanner({ summary }: { summary: string }): ReactElement {
  const { styles } = usePanelStyles();
  return (
    <View style={styles.cause}>
      <View style={styles.causeIcon}>
        <Text style={styles.causeIconText}>!</Text>
      </View>
      <Text style={styles.causeText}>{summary}</Text>
    </View>
  );
}

function TimelineDetail({
  event,
  onBack,
}: {
  event: TimelineEvent;
  onBack: () => void;
}): ReactElement {
  const { styles } = usePanelStyles();
  const correlation = AppInspector.correlate(event);
  const dataEntries = event.data ? Object.entries(event.data) : [];

  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onBack}
        style={styles.back}
      >
        <Text style={styles.backText}>‹ Back to timeline</Text>
      </TouchableOpacity>
      <Row label="type" value={event.type} />
      <Row label="event" value={event.label} />
      <Row label="at" value={seconds(event.sinceStartMs)} />
      {event.durationMs !== undefined ? (
        <Row label="duration" value={`${event.durationMs} ms`} />
      ) : null}
      {event.screen ? <Row label="screen" value={event.screen} /> : null}
      <Row label="severity" value={event.severity} />
      {dataEntries.map(([key, value]) => (
        <Row key={key} label={key} value={formatValue(value)} />
      ))}
      {correlation?.summary ? (
        <CauseBanner summary={correlation.summary} />
      ) : (
        <Text style={styles.empty}>No correlated causes for this event.</Text>
      )}
    </View>
  );
}

function TimelineEventRow({
  event,
  onPress,
}: {
  event: TimelineEvent;
  onPress: () => void;
}): ReactElement {
  const { styles } = usePanelStyles();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={styles.eventRow}
    >
      <View
        style={[styles.dot, { backgroundColor: severityColor(event.severity) }]}
      />
      <Text style={styles.eventTime}>{seconds(event.sinceStartMs)}</Text>
      <Text style={styles.eventType}>{TYPE_TAG[event.type]}</Text>
      <Text style={styles.eventLabel} numberOfLines={1}>
        {event.label}
        {event.durationMs !== undefined ? `  ${event.durationMs}ms` : ''}
      </Text>
    </TouchableOpacity>
  );
}

/** Unified timeline with severity filter, correlation banner and tap-to-detail. */
export function TimelineTab({
  state,
}: {
  state: InspectorState;
}): ReactElement {
  const { styles } = usePanelStyles();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | TimelineSeverity>('all');
  const events = state.timeline;

  if (events.length === 0) {
    return (
      <Text style={styles.empty}>
        No events yet. Track actions / navigation, or trigger a slow render or
        FPS drop.
      </Text>
    );
  }

  const selected = selectedId
    ? events.find((event) => event.id === selectedId)
    : undefined;
  if (selected) {
    return (
      <TimelineDetail event={selected} onBack={() => setSelectedId(null)} />
    );
  }

  const correlation = AppInspector.correlate();
  const recent = events
    .filter((event) => filter === 'all' || event.severity === filter)
    .slice(-40)
    .reverse();

  return (
    <View>
      {correlation?.summary ? (
        <CauseBanner summary={correlation.summary} />
      ) : null}
      <View style={styles.filterRow}>
        {SEVERITY_FILTERS.map((option) => (
          <TouchableOpacity
            key={option.key}
            accessibilityRole="button"
            onPress={() => setFilter(option.key)}
            style={[styles.chip, filter === option.key && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                filter === option.key && styles.chipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {recent.length === 0 ? (
        <Text style={styles.empty}>No events match this filter.</Text>
      ) : (
        recent.map((event) => (
          <TimelineEventRow
            key={event.id}
            event={event}
            onPress={() => setSelectedId(event.id)}
          />
        ))
      )}
    </View>
  );
}
