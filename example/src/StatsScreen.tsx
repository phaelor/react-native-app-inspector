import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {InspectorProfiler} from 'react-native-app-inspector';
import type {Todo} from './todoApi';

/** Deliberately expensive computation to demonstrate a slow render + FPS drop. */
function computeStats(todos: Todo[]): {total: number; done: number} {
  const end = Date.now() + 600; // block the JS thread ~600ms
  while (Date.now() < end) {
    /* burn */
  }
  return {
    total: todos.length,
    done: todos.filter(t => t.done).length,
  };
}

function StatCard({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

export function StatsScreen({todos}: {todos: Todo[]}): React.JSX.Element {
  return (
    <InspectorProfiler id="StatsScreen">
      <View style={styles.screen}>
        <Text style={styles.note}>
          Opening this screen runs a heavy synchronous computation — watch the
          Timeline tab correlate the FPS drop with this render.
        </Text>
        <StatsBody todos={todos} />
      </View>
    </InspectorProfiler>
  );
}

function StatsBody({todos}: {todos: Todo[]}): React.JSX.Element {
  const {total, done} = computeStats(todos);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <View style={styles.cards}>
      <StatCard label="total" value={String(total)} />
      <StatCard label="done" value={String(done)} />
      <StatCard label="complete" value={`${pct}%`} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, padding: 16, gap: 16},
  note: {color: '#6b7280', fontSize: 13, lineHeight: 18},
  cards: {flexDirection: 'row', gap: 12},
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  cardValue: {fontSize: 28, fontWeight: '800', color: '#2563eb'},
  cardLabel: {fontSize: 12, color: '#6b7280', marginTop: 4},
});
