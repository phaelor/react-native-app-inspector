/**
 * The demo Todo app that produces inspector data. All inspector wiring lives
 * in ../App.tsx; the only calls here are the manual ones a host without React
 * Navigation would make (trackNavigation / mark).
 *
 * @format
 */

import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {AppInspector} from 'react-native-app-inspector';
import {TodoListScreen} from './TodoListScreen';
import {StatsScreen} from './StatsScreen';
import {useTodos} from './useTodos';

type Screen = 'todos' | 'stats';

const SCREEN_LABELS: Record<Screen, string> = {todos: 'Todos', stats: 'Stats'};

function HeaderTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function DemoApp(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('todos');
  const todos = useTodos();

  useEffect(() => {
    AppInspector.trackNavigation('Todos');
    AppInspector.mark('app-start');
  }, []);

  const go = (next: Screen): void => {
    if (next === screen) {
      return;
    }
    setScreen(next);
    AppInspector.trackNavigation(SCREEN_LABELS[next]);
  };

  const simulateError = (): void => {
    // Lands on the timeline as an ERR event.
    console.error('Demo: checkout failed', {
      code: 402,
      reason: 'card_declined',
    });
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3f4f6" />
      <View style={styles.header}>
        <View style={styles.tabs}>
          <HeaderTab
            label="Todos"
            active={screen === 'todos'}
            onPress={() => go('todos')}
          />
          <HeaderTab
            label="Stats"
            active={screen === 'stats'}
            onPress={() => go('stats')}
          />
        </View>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={simulateError}
          accessibilityRole="button">
          <Text style={styles.errorText}>Error</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {screen === 'todos' ? (
          <TodoListScreen {...todos} />
        ) : (
          <StatsScreen todos={todos.todos} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#f3f4f6'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  tabs: {flexDirection: 'row', gap: 8},
  tab: {paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16},
  tabActive: {backgroundColor: '#dbeafe'},
  tabText: {fontSize: 15, color: '#6b7280', fontWeight: '600'},
  tabTextActive: {color: '#2563eb'},
  errorButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
  },
  errorText: {color: '#b91c1c', fontSize: 13, fontWeight: '700'},
  body: {flex: 1},
});
