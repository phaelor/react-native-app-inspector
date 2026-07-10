import { useState } from 'react';
import type { ReactElement } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { shareLogs } from '../export/share';
import { useInspectorState } from './useInspectorState';
import { PerformanceTab } from './panel/PerformanceTab';
import { TimelineTab } from './panel/TimelineTab';
import { ScreensTab } from './panel/ScreensTab';
import { StartupTab } from './panel/StartupTab';
import { StatusStrip } from './panel/StatusStrip';
import { usePanelStyles } from './panel/styles';

type Tab = 'timeline' | 'performance' | 'screens' | 'startup';

const TAB_LABELS: Record<Tab, string> = {
  timeline: 'Timeline',
  performance: 'Perf',
  screens: 'Screens',
  startup: 'Startup',
};

export interface InspectorPanelProps {
  /** Whether the panel overlay is currently shown. */
  visible?: boolean;
  /** Tab to show first. Defaults to `timeline`. */
  initialTab?: Tab;
  /** Current visibility of the floating badge, for the toggle's label. */
  badgeVisible?: boolean;
  /** When set, shows a control that toggles the floating badge. */
  onToggleBadge?: () => void;
}

/**
 * The in-app debug panel overlay: a glanceable live summary plus a tabbed view
 * over the inspector state (timeline, performance, screens, startup). Toggle
 * with the `visible` prop; the host decides when to show it.
 */
export function InspectorPanel({
  visible = false,
  initialTab = 'timeline',
  badgeVisible = true,
  onToggleBadge,
}: InspectorPanelProps): ReactElement | null {
  const [tab, setTab] = useState<Tab>(initialTab);
  const state = useInspectorState();
  const { styles } = usePanelStyles();

  if (!visible) {
    return null;
  }

  const latest = state.performance[state.performance.length - 1];

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.panel}>
        <StatusStrip latest={latest} />

        <View style={styles.tabs}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
            <TouchableOpacity
              key={key}
              accessibilityRole="button"
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && styles.tabActive]}
            >
              <Text
                style={[styles.tabText, tab === key && styles.tabTextActive]}
              >
                {TAB_LABELS[key]}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.tabsSpacer} />
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Share inspector session"
            onPress={() => {
              void shareLogs();
            }}
            style={styles.tab}
          >
            <Text style={styles.tabText}>Share</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyInner}
        >
          {tab === 'timeline' && <TimelineTab state={state} />}
          {tab === 'performance' && <PerformanceTab state={state} />}
          {tab === 'screens' && <ScreensTab state={state} />}
          {tab === 'startup' && <StartupTab state={state} />}
        </ScrollView>
      </View>
    </View>
  );
}
