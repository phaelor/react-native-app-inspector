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
import { useSelection, type SelectionProps } from './useSelection';
import type { Theme } from '../theme';

/** Entries are recorded on completion, so a missing status means no response. */
export function isFailedRequest(entry: NetworkLogEntry): boolean {
  return entry.status === undefined || entry.status >= 400;
}

function statusColor(status: number | undefined, theme: Theme): string {
  if (status === undefined || status >= 400) {
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

export function splitUrl(url: string): { host: string; path: string } {
  const match = /^[a-z][a-z\d+.-]*:\/\/([^/?#]*)(.*)$/i.exec(url);
  if (!match) {
    return { host: '', path: url };
  }
  return { host: match[1] ?? '', path: match[2] || '/' };
}

const shellQuote = (text: string): string => `'${text.replace(/'/g, `'\\''`)}'`;

function headerLines(
  headers: Record<string, string> | undefined,
): string | null {
  if (!headers) {
    return null;
  }
  const lines = Object.entries(headers).map(
    ([name, value]) => `${name}: ${value}`,
  );
  return lines.length > 0 ? lines.join('\n') : null;
}

function asCurl(entry: NetworkLogEntry): string {
  const parts = [`curl -X ${entry.method} ${shellQuote(entry.url)}`];
  for (const [name, value] of Object.entries(entry.requestHeaders ?? {})) {
    parts.push(`  -H ${shellQuote(`${name}: ${value}`)}`);
  }
  const req = body(entry.requestBody);
  if (req) {
    parts.push(`  -d ${shellQuote(req)}`);
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
  const reqHeaders = headerLines(entry.requestHeaders);
  const resHeaders = headerLines(entry.responseHeaders);
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
        value={
          entry.status !== undefined ? String(entry.status) : 'no response'
        }
      />
      {entry.durationMs !== undefined ? (
        <Row label="duration" value={`${Math.round(entry.durationMs)} ms`} />
      ) : null}

      <Text style={styles.sectionTitle}>cURL</Text>
      <View style={styles.codeBlock}>
        <Text style={styles.codeText} selectable>
          {asCurl(entry)}
        </Text>
      </View>
      <CopyButton label="Copy cURL" getText={() => asCurl(entry)} />

      {reqHeaders ? (
        <>
          <Text style={styles.sectionTitle}>Request headers</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText} selectable>
              {reqHeaders}
            </Text>
          </View>
        </>
      ) : null}

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

      {resHeaders ? (
        <>
          <Text style={styles.sectionTitle}>Response headers</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText} selectable>
              {resHeaders}
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
  const { host, path } = splitUrl(entry.url);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={styles.netRow}
    >
      <View style={styles.methodChip}>
        <Text style={styles.methodText}>{entry.method}</Text>
      </View>
      <View style={styles.netUrlCol}>
        <Text style={styles.netUrl} numberOfLines={1} ellipsizeMode="middle">
          {path}
        </Text>
        {host ? (
          <Text style={styles.netHost} numberOfLines={1}>
            {host}
          </Text>
        ) : null}
      </View>
      {entry.durationMs !== undefined ? (
        <Text style={styles.netMeta}>{Math.round(entry.durationMs)}ms</Text>
      ) : null}
      <Text
        style={[styles.netStatus, { color: statusColor(entry.status, theme) }]}
      >
        {entry.status ?? 'ERR'}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Captured HTTP requests: virtualized list with method, status and timing;
 * tap for request/response bodies. Owns its scrolling.
 */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'failed', label: 'Failed' },
] as const;

export function NetworkTab({
  state,
  search = '',
  ...selection
}: {
  state: InspectorState;
  search?: string;
} & SelectionProps): ReactElement {
  const { styles } = usePanelStyles();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [selectedId, setSelectedId] = useSelection(selection, (id) =>
    state.network.some((e) => e.id === id),
  );

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
    .filter((e) => filter === 'all' || isFailedRequest(e))
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
      ListHeaderComponent={
        state.network.length === 0 ? undefined : (
          <View style={styles.filterRow}>
            {FILTERS.map((option) => (
              <TouchableOpacity
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === option.key }}
                onPress={() => setFilter(option.key)}
                style={[
                  styles.chip,
                  filter === option.key && styles.chipActive,
                ]}
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
        )
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {state.network.length === 0
            ? 'No requests captured yet. `fetch` and XMLHttpRequest are logged automatically.'
            : filter === 'failed' && query === ''
              ? 'No failed requests.'
              : 'No requests match this search.'}
        </Text>
      }
    />
  );
}
