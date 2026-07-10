import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  AccessibilityInfo,
  Modal,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppInspector } from '../core';
import { shareLogs } from '../export/share';
import { useInspectorState } from './useInspectorState';
import { TimelineTab } from './panel/TimelineTab';
import { NetworkTab } from './panel/NetworkTab';
import { InteractionsTab } from './panel/InteractionsTab';
import { PerformanceTab } from './panel/PerformanceTab';
import { ScreensTab } from './panel/ScreensTab';
import { StartupTab } from './panel/StartupTab';
import { StatusStrip } from './panel/StatusStrip';
import { usePanelStyles } from './panel/styles';

type Tab =
  | 'timeline'
  | 'network'
  | 'interactions'
  | 'performance'
  | 'screens'
  | 'startup'
  | 'settings';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'network', label: 'Network' },
  { key: 'interactions', label: 'Taps' },
  { key: 'performance', label: 'Perf' },
  { key: 'screens', label: 'Screens' },
  { key: 'startup', label: 'Startup' },
  { key: 'settings', label: 'Settings' },
];

/** Tabs that render their own virtualized list (must not nest in ScrollView). */
const LIST_TABS: ReadonlyArray<Tab> = ['timeline', 'network', 'interactions'];

export interface InspectorModalProps {
  /** Whether the modal is shown. */
  visible?: boolean;
  /** Called when the user dismisses the modal (Close button or system back). */
  onClose?: () => void;
  /** Tab to show first. Defaults to `timeline`. */
  initialTab?: Tab;
  /** Current badge visibility, for the toggle's label. */
  badgeVisible?: boolean;
  /** When set, shows a control that toggles the floating badge. */
  onToggleBadge?: () => void;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    const query = AccessibilityInfo.isReduceMotionEnabled?.();
    if (query && typeof query.then === 'function') {
      void query.then((v) => {
        if (alive) setReduce(v);
      });
    }
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduce,
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

function SettingsView({
  paused,
  onTogglePause,
  onClear,
  badgeVisible,
  onToggleBadge,
}: {
  paused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
  badgeVisible: boolean;
  onToggleBadge?: () => void;
}): ReactElement {
  const { styles, theme } = usePanelStyles();
  return (
    <View>
      <Text style={styles.sectionTitle}>Session</Text>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onTogglePause}
        style={styles.settingRow}
      >
        <Text style={styles.settingLabel}>
          {paused ? 'Resume live updates' : 'Pause live updates'}
        </Text>
        <Text style={[styles.settingValue, paused && { color: theme.warn }]}>
          {paused ? 'Paused' : 'Live'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Share inspector session"
        onPress={() => {
          void shareLogs();
        }}
        style={styles.settingRow}
      >
        <Text style={styles.settingLabel}>Share session</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onClear}
        style={styles.settingRow}
      >
        <Text style={[styles.settingLabel, { color: theme.bad }]}>
          Clear session
        </Text>
      </TouchableOpacity>

      {onToggleBadge ? (
        <>
          <Text style={styles.sectionTitle}>Display</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Floating badge</Text>
            <Switch
              accessibilityLabel="Toggle floating badge"
              value={badgeVisible}
              onValueChange={onToggleBadge}
              trackColor={{ true: theme.accent }}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

/**
 * Full-screen inspector covering the app: timeline, network, performance,
 * screens and startup views, plus a settings tab with pause / clear / share
 * and the badge switch. Toggle with `visible`; the host decides when to show
 * it.
 */
export function InspectorModal({
  visible = false,
  onClose,
  initialTab = 'timeline',
  badgeVisible = true,
  onToggleBadge,
}: InspectorModalProps): ReactElement {
  const { styles, theme } = usePanelStyles();
  const live = useInspectorState();
  const reduceMotion = useReduceMotion();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState('');

  // While paused, freeze the last live snapshot instead of tracking updates.
  const frozen = useRef(live);
  if (!paused) {
    frozen.current = live;
  }
  const state = frozen.current;

  const selectTab = (key: Tab): void => {
    setTab(key);
    setSearch('');
  };

  // Resume on clear so the wipe is visible immediately, not after Resume.
  const handleClear = (): void => {
    AppInspector.clear();
    setPaused(false);
  };

  const searchable = LIST_TABS.includes(tab);
  const errorCount = state.timeline.filter(
    (e) => e.severity === 'error',
  ).length;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.fullscreen}>
        <View style={styles.header}>
          <Text style={styles.title}>Inspector</Text>
          {paused ? (
            <View style={styles.pausedChip}>
              <Text style={styles.pausedChipText}>Paused</Text>
            </View>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <StatusStrip
            latest={state.performance[state.performance.length - 1]}
          />
        </View>

        <View style={styles.tabsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {TABS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === key }}
                onPress={() => selectTab(key)}
                style={[styles.tabPill, tab === key && styles.tabPillActive]}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    tab === key && styles.tabPillTextActive,
                  ]}
                >
                  {label}
                </Text>
                {key === 'timeline' && errorCount > 0 ? (
                  <View style={styles.tabCount}>
                    <Text style={styles.tabCountText}>{errorCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {searchable ? (
          <View style={styles.body}>
            <TextInput
              style={styles.search}
              placeholder={
                tab === 'network'
                  ? 'Search requests…'
                  : tab === 'interactions'
                    ? 'Search taps…'
                    : 'Search events…'
              }
              placeholderTextColor={theme.faint}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}

        {/* List tabs own their scrolling (FlatList must not nest in a ScrollView). */}
        {tab === 'timeline' && <TimelineTab state={state} search={search} />}
        {tab === 'network' && <NetworkTab state={state} search={search} />}
        {tab === 'interactions' && (
          <InteractionsTab state={state} search={search} />
        )}
        {!LIST_TABS.includes(tab) ? (
          <ScrollView
            style={[styles.body, styles.bodyFill]}
            contentContainerStyle={styles.bodyInner}
            keyboardShouldPersistTaps="handled"
          >
            {tab === 'performance' && <PerformanceTab state={state} />}
            {tab === 'screens' && <ScreensTab state={state} />}
            {tab === 'startup' && <StartupTab state={state} />}
            {tab === 'settings' && (
              <SettingsView
                paused={paused}
                onTogglePause={() => setPaused((p) => !p)}
                onClear={handleClear}
                badgeVisible={badgeVisible}
                onToggleBadge={onToggleBadge}
              />
            )}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
