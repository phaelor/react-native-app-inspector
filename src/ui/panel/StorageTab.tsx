import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppInspector } from '../../core';
import type { StorageInspectorAdapter } from '../../core/types';
import {
  formatSize,
  formatStorageValue,
  listEntries,
  type StorageEntrySummary,
} from '../../modules/storage';
import { Row } from './Row';
import { CopyButton } from './CopyButton';
import { usePanelStyles } from './styles';

function confirmDestructive(
  title: string,
  message: string,
  actionLabel: string,
  onConfirm: () => void,
): void {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

function StorageDetail({
  adapter,
  entry,
  onBack,
  onChanged,
}: {
  adapter: StorageInspectorAdapter;
  entry: StorageEntrySummary;
  onBack: () => void;
  onChanged: () => void;
}): ReactElement {
  const { styles } = usePanelStyles();
  const [value, setValue] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void adapter
      .get(entry.key)
      .catch(() => null)
      .then((raw) => {
        if (alive) {
          setValue(raw);
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [adapter, entry.key]);

  const save = (): void => {
    if (draft === null) {
      return;
    }
    void adapter
      .set(entry.key, draft)
      .catch(() => undefined)
      .then(() => {
        setValue(draft);
        setDraft(null);
        onChanged();
      });
  };

  const removeKey = (): void => {
    confirmDestructive('Delete key?', entry.key, 'Delete', () => {
      void adapter
        .remove(entry.key)
        .catch(() => undefined)
        .then(() => {
          onChanged();
          onBack();
        });
    });
  };

  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onBack}
        style={styles.back}
      >
        <Text style={styles.backText}>‹ Back to storage</Text>
      </TouchableOpacity>
      <Row label="key" value={entry.key} />
      <Row label="size" value={formatSize(value?.length ?? 0)} />

      <Text style={styles.sectionTitle}>Value</Text>
      {draft !== null ? (
        <>
          <TextInput
            style={styles.valueEditor}
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Storage value editor"
          />
          <View style={styles.actionsRow}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={save}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setDraft(null)}
              style={styles.neutralBtn}
            >
              <Text style={styles.neutralBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText} selectable>
              {!loaded
                ? 'Loading…'
                : value === null
                  ? '(missing)'
                  : formatStorageValue(value)}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            {value !== null ? (
              <CopyButton label="Copy value" getText={() => value} />
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setDraft(value ?? '')}
              style={styles.neutralBtn}
            >
              <Text style={styles.neutralBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={removeKey}
              style={styles.dangerBtn}
            >
              <Text style={styles.dangerBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Browses the configured key/value stores: keys with sizes and previews, a
 * JSON-aware value view, edit/delete per key and a confirmed clear-all. Owns
 * its scrolling.
 */
export function StorageTab({ search = '' }: { search?: string }): ReactElement {
  const { styles, theme } = usePanelStyles();
  const storages = AppInspector.getStorages();
  const [index, setIndex] = useState(0);
  const [entries, setEntries] = useState<StorageEntrySummary[] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const adapter = storages[Math.min(index, storages.length - 1)];

  const reload = useCallback((): void => {
    if (!adapter) {
      return;
    }
    void listEntries(adapter).then(setEntries);
  }, [adapter]);

  useEffect(() => {
    setEntries(null);
    setSelectedKey(null);
    reload();
  }, [reload]);

  const clearAll = (): void => {
    if (!adapter?.clear || !entries) {
      return;
    }
    confirmDestructive(
      `Clear ${adapter.name}?`,
      `All ${entries.length} keys will be removed.`,
      'Clear all',
      () => {
        void adapter.clear!()
          .catch(() => undefined)
          .then(reload);
      },
    );
  };

  if (!adapter) {
    return (
      <View style={[styles.body, styles.bodyFill]}>
        <Text style={styles.empty}>
          No storage connected. Pass your store to InspectorRoot, e.g. storages=
          {'{[asyncStorageAdapter(AsyncStorage)]}'} — or just storage=
          {'{AsyncStorage}'}.
        </Text>
      </View>
    );
  }

  const selected = entries?.find((entry) => entry.key === selectedKey);
  if (selected) {
    return (
      <ScrollView
        style={[styles.body, styles.bodyFill]}
        contentContainerStyle={styles.bodyInner}
        keyboardShouldPersistTaps="handled"
      >
        <StorageDetail
          adapter={adapter}
          entry={selected}
          onBack={() => setSelectedKey(null)}
          onChanged={reload}
        />
      </ScrollView>
    );
  }

  const query = search.trim().toLowerCase();
  const rows =
    entries?.filter(
      (entry) => query === '' || entry.key.toLowerCase().includes(query),
    ) ?? [];
  const totalSize = entries?.reduce((sum, entry) => sum + entry.size, 0) ?? 0;

  return (
    <FlatList
      style={[styles.body, styles.bodyFill]}
      contentContainerStyle={styles.bodyInner}
      data={rows}
      keyExtractor={(entry) => entry.key}
      initialNumToRender={20}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        const dimmed = item.key.startsWith('@app-inspector/');
        return (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setSelectedKey(item.key)}
            style={styles.storageRow}
          >
            <View style={styles.bodyFill}>
              <Text
                style={[styles.storageKey, dimmed && { color: theme.faint }]}
                numberOfLines={1}
              >
                {item.key}
              </Text>
              {item.preview !== '' ? (
                <Text style={styles.storagePreview} numberOfLines={1}>
                  {item.preview}
                </Text>
              ) : null}
            </View>
            <Text style={styles.netMeta}>{formatSize(item.size)}</Text>
          </TouchableOpacity>
        );
      }}
      ListHeaderComponent={
        <>
          {storages.length > 1 ? (
            <View style={styles.filterRow}>
              {storages.map((store, i) => (
                <TouchableOpacity
                  key={store.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === index }}
                  onPress={() => setIndex(i)}
                  style={[styles.chip, i === index && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      i === index && styles.chipTextActive,
                    ]}
                  >
                    {store.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {entries !== null && entries.length > 0 ? (
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {`${entries.length} ${entries.length === 1 ? 'key' : 'keys'} · ${formatSize(totalSize)}`}
              </Text>
              {adapter.clear ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={clearAll}
                  hitSlop={8}
                >
                  <Text style={styles.inlineDanger}>Clear all</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {entries === null
            ? 'Loading…'
            : entries.length === 0
              ? 'This store is empty.'
              : 'No keys match this search.'}
        </Text>
      }
    />
  );
}
