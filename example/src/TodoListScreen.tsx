import React, {useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {InspectorProfiler} from 'react-native-app-inspector';
import type {Todo} from './todoApi';
import type {UseTodos} from './useTodos';

function TodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.rowMain} onPress={onToggle}>
        <View style={[styles.checkbox, todo.done && styles.checkboxDone]}>
          {todo.done ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <Text style={[styles.title, todo.done && styles.titleDone]}>
          {todo.title}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} hitSlop={8}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export function TodoListScreen({
  todos,
  loading,
  saving,
  add,
  toggle,
  remove,
}: UseTodos): React.JSX.Element {
  const [draft, setDraft] = useState('');

  const onAdd = (): void => {
    add(draft);
    setDraft('');
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} color="#2563eb" />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a task…"
          placeholderTextColor="#9ca3af"
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addButton, saving && styles.addButtonBusy]}
          onPress={onAdd}
          disabled={saving}>
          <Text style={styles.addButtonText}>{saving ? '…' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      <InspectorProfiler id="TodoList">
        <FlatList
          data={todos}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <TodoRow
              todo={item}
              onToggle={() => toggle(item)}
              onDelete={() => remove(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No tasks yet — add one above.</Text>
          }
        />
      </InspectorProfiler>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, padding: 16},
  inputRow: {flexDirection: 'row', gap: 8, marginBottom: 12},
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addButtonBusy: {opacity: 0.6},
  addButtonText: {color: '#ffffff', fontWeight: '700', fontSize: 15},
  loader: {marginTop: 32},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowMain: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12},
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {backgroundColor: '#22c55e', borderColor: '#22c55e'},
  check: {color: '#ffffff', fontSize: 14, fontWeight: '800'},
  title: {fontSize: 15, color: '#111827', flexShrink: 1},
  titleDone: {textDecorationLine: 'line-through', color: '#9ca3af'},
  delete: {color: '#ef4444', fontSize: 16, fontWeight: '700', paddingLeft: 8},
  empty: {color: '#9ca3af', textAlign: 'center', marginTop: 32},
});
