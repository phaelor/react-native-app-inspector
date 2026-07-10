/**
 * Demo app for react-native-app-inspector — a small Todo list.
 *
 * Using the app naturally produces inspector data: API calls feed the network
 * timeline (the real fetch on launch is auto-captured by the XHR interceptor),
 * todo actions feed the action log, switching tabs feeds navigation, the list
 * feeds render stats, the Stats screen triggers a slow render / FPS drop you can
 * correlate, and "Simulate error" lands on the timeline as an ERR event.
 *
 * The host app decides when to show the panel — here a header "Inspect" button
 * toggles it (wire it to a shake gesture, a hidden tap target, a dev menu, etc).
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
import {
  AppInspector,
  InspectorFpsBadge,
  InspectorPanel,
  type PersistenceAdapter,
} from 'react-native-app-inspector';
import {TodoListScreen} from './src/TodoListScreen';
import {StatsScreen} from './src/StatsScreen';
import {useTodos} from './src/useTodos';

type Screen = 'todos' | 'stats';

const SCREEN_LABELS: Record<Screen, string> = {todos: 'Todos', stats: 'Stats'};

// A throwaway in-memory store so the persistence API is wired in the demo. In a
// real app you'd pass AsyncStorage (or MMKV) here so a session survives a crash
// and is readable via AppInspector.getPreviousSession() after relaunch.
const demoStorage: PersistenceAdapter = (() => {
  const map = new Map<string, string>();
  return {
    getItem: key => Promise.resolve(map.get(key) ?? null),
    setItem: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    removeItem: key => {
      map.delete(key);
      return Promise.resolve();
    },
  };
})();

// A genuine network request (not via the fake API) — captured automatically by
// the XHR interceptor with no trackNetwork call.
function fetchTip(): void {
  fetch('https://jsonplaceholder.typicode.com/todos/1').catch(() => {});
}

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

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('todos');
  const [panelOpen, setPanelOpen] = useState(false);
  const [badgeVisible, setBadgeVisible] = useState(true);
  const todos = useTodos();

  useEffect(() => {
    AppInspector.configure({enabled: true, storage: demoStorage});
    AppInspector.start();
    AppInspector.trackNavigation('Todos');
    AppInspector.mark('app-start');
    fetchTip();
    return () => AppInspector.stop();
  }, []);

  const go = (next: Screen): void => {
    if (next === screen) {
      return;
    }
    setScreen(next);
    AppInspector.trackNavigation(SCREEN_LABELS[next]);
  };

  const simulateError = (): void => {
    // Captured by the error tracker and shown on the timeline as ERR.
    console.error('Demo: checkout failed', {code: 402, reason: 'card_declined'});
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
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={simulateError}
            accessibilityRole="button">
            <Text style={styles.errorText}>Error</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.inspectButton}
            onPress={() => setPanelOpen(open => !open)}
            accessibilityRole="button">
            <Text style={styles.inspectText}>
              {panelOpen ? 'Close' : 'Inspect'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        {screen === 'todos' ? (
          <TodoListScreen {...todos} />
        ) : (
          <StatsScreen todos={todos.todos} />
        )}
      </View>

      <InspectorFpsBadge
        visible={badgeVisible}
        initialCorner="bottom-left"
        onPress={() => setPanelOpen(open => !open)}
      />
      <InspectorPanel
        visible={panelOpen}
        initialTab="timeline"
        badgeVisible={badgeVisible}
        onToggleBadge={() => setBadgeVisible(v => !v)}
      />
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
  actions: {flexDirection: 'row', gap: 8},
  errorButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
  },
  errorText: {color: '#b91c1c', fontSize: 13, fontWeight: '700'},
  inspectButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#111827',
  },
  inspectText: {color: '#ffffff', fontSize: 13, fontWeight: '700'},
  body: {flex: 1},
});

export default App;
