import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  AccessibilityInfo,
  Modal,
  SafeAreaView,
  ScrollView,
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
import { PerformanceTab } from './panel/PerformanceTab';
import { ScreensTab } from './panel/ScreensTab';
import { StartupTab } from './panel/StartupTab';
import { usePanelStyles } from './panel/styles';

type Tab = 'timeline' | 'network' | 'performance' | 'screens' | 'startup';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'network', label: 'Network' },
  { key: 'performance', label: 'Perf' },
  { key: 'screens', label: 'Screens' },
  { key: 'startup', label: 'Startup' },
];

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

/**
 * Full-screen inspector covering the app: timeline, network, performance,
 * screens and startup views, plus pause / clear / share. Toggle with
 * `visible`; the host decides when to show it.
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

  const searchable = tab === 'timeline' || tab === 'network';

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.fullscreen}>
        <View style={styles.header}>
          <Text style={styles.title}>Inspector</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setPaused((p) => !p)}
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>
              {paused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => AppInspector.clear()}
            style={styles.headerBtn}
          >
            <Text style={[styles.headerBtnText, styles.headerBtnDanger]}>
              Clear
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Share inspector session"
            onPress={() => {
              void shareLogs();
            }}
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {TABS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === key }}
                onPress={() => selectTab(key)}
                style={[styles.tab, tab === key && styles.tabActive]}
              >
                <Text
                  style={[styles.tabText, tab === key && styles.tabTextActive]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
            {onToggleBadge ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={onToggleBadge}
                style={styles.tab}
              >
                <Text style={styles.tabText}>
                  {badgeVisible ? 'Hide badge' : 'Show badge'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>

        {searchable ? (
          <View style={styles.body}>
            <TextInput
              style={styles.search}
              placeholder="Search…"
              placeholderTextColor={theme.faint}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}

        <ScrollView
          style={[styles.body, styles.bodyFill]}
          contentContainerStyle={styles.bodyInner}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'timeline' && <TimelineTab state={state} search={search} />}
          {tab === 'network' && <NetworkTab state={state} search={search} />}
          {tab === 'performance' && <PerformanceTab state={state} />}
          {tab === 'screens' && <ScreensTab state={state} />}
          {tab === 'startup' && <StartupTab state={state} />}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
