import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { InspectorState } from '../../core';
import type { NetworkLogEntry } from '../../core/types';
import { Row } from './Row';
import { CopyButton } from './CopyButton';
import { usePanelStyles } from './styles';
import type { Theme } from '../theme';

function statusColor(status: number | undefined, theme: Theme): string {
  if (status === undefined) {
    return theme.muted;
  }
  if (status >= 400) {
    return theme.bad;
  }
  if (status >= 300) {
    return theme.warn;
  }
  return theme.good;
}

function body(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function asCurl(entry: NetworkLogEntry): string {
  const parts = [`curl -X ${entry.method} '${entry.url}'`];
  const req = body(entry.requestBody);
  if (req) {
    parts.push(`  -d '${req}'`);
  }
  return parts.join(' \\\n');
}

function NetworkDetail({
  entry,
  onBack,
}: {
  entry: NetworkLogEntry;
  onBack: () => void;
}): ReactElement {
  const { styles, theme } = usePanelStyles();
  const req = body(entry.requestBody);
  const res = body(entry.responseBody);
  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onBack}
        style={styles.back}
      >
        <Text style={styles.backText}>‹ Back to network</Text>
      </TouchableOpacity>
      <Row label="method" value={entry.method} />
      <Row label="url" value={entry.url} />
      <Row
        label="status"
        value={entry.status !== undefined ? String(entry.status) : 'pending'}
      />
      {entry.durationMs !== undefined ? (
        <Row label="duration" value={`${entry.durationMs} ms`} />
      ) : null}

      <Text style={styles.sectionTitle}>cURL</Text>
      <View style={styles.codeBlock}>
        <Text style={styles.codeText} selectable>
          {asCurl(entry)}
        </Text>
      </View>
      <CopyButton label="Copy cURL" getText={() => asCurl(entry)} />

      {req ? (
        <>
          <Text style={styles.sectionTitle}>Request body</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText} selectable>
              {req}
            </Text>
          </View>
        </>
      ) : null}

      {res ? (
        <>
          <Text style={styles.sectionTitle}>Response body</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText} selectable>
              {res}
            </Text>
          </View>
        </>
      ) : (
        <Text style={[styles.empty, { color: theme.faint }]}>
          No response body captured.
        </Text>
      )}
    </View>
  );
}

function NetworkRow({
  entry,
  onPress,
}: {
  entry: NetworkLogEntry;
  onPress: () => void;
}): ReactElement {
  const { styles, theme } = usePanelStyles();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={styles.netRow}
    >
      <View style={styles.methodChip}>
        <Text style={styles.methodText}>{entry.method}</Text>
      </View>
      <Text style={styles.netUrl} numberOfLines={1}>
        {entry.url}
      </Text>
      {entry.durationMs !== undefined ? (
        <Text style={styles.netMeta}>{entry.durationMs}ms</Text>
      ) : null}
      <Text
        style={[styles.netStatus, { color: statusColor(entry.status, theme) }]}
      >
        {entry.status ?? '···'}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Captured HTTP requests: virtualized list with method, status and timing;
 * tap for request/response bodies. Owns its scrolling.
 */
export function NetworkTab({
  state,
  search = '',
}: {
  state: InspectorState;
  search?: string;
}): ReactElement {
  const { styles } = usePanelStyles();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId
    ? state.network.find((e) => e.id === selectedId)
    : undefined;
  if (selected) {
    return (
      <ScrollView
        style={[styles.body, styles.bodyFill]}
        contentContainerStyle={styles.bodyInner}
      >
        <NetworkDetail entry={selected} onBack={() => setSelectedId(null)} />
      </ScrollView>
    );
  }

  const query = search.trim().toLowerCase();
  const rows = state.network
    .filter(
      (e) =>
        query === '' ||
        e.url.toLowerCase().includes(query) ||
        e.method.toLowerCase().includes(query),
    )
    .reverse();

  return (
    <FlatList
      style={[styles.body, styles.bodyFill]}
      contentContainerStyle={styles.bodyInner}
      data={rows}
      keyExtractor={(entry) => entry.id}
      renderItem={({ item }) => (
        <NetworkRow entry={item} onPress={() => setSelectedId(item.id)} />
      )}
      initialNumToRender={20}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <Text style={styles.empty}>
          {state.network.length === 0
            ? 'No requests captured yet. `fetch` and XMLHttpRequest are logged automatically.'
            : 'No requests match this search.'}
        </Text>
      }
    />
  );
}
