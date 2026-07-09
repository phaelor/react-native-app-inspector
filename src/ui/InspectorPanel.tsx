import { useState } from 'react';
import type { ReactElement } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { PerformanceSample } from '../core/types';
import { shareLogs } from '../export/share';
import { useInspectorState } from './useInspectorState';
import { PerformanceTab } from './panel/PerformanceTab';
import { TimelineTab } from './panel/TimelineTab';
import { ScreensTab } from './panel/ScreensTab';
import { StartupTab } from './panel/StartupTab';
import { usePanelStyles } from './panel/styles';
import { fpsColor } from './theme';
import type { PanelStyles } from './panel/styles';
import type { Theme } from './theme';

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

/** Compact, always-visible live summary: FPS · CPU · MEM. */
function StatusStrip({
  latest,
  styles,
  theme,
}: {
  latest: PerformanceSample | undefined;
  styles: PanelStyles;
  theme: Theme;
}): ReactElement {
  const fps = latest?.uiFps && latest.uiFps > 0 ? latest.uiFps : latest?.jsFps;
  return (
    <View style={styles.status}>
      <View style={styles.statusItem}>
        <Text
          style={[styles.statusValue, { color: fpsColor(theme, fps ?? 0) }]}
        >
          {fps !== undefined && fps > 0 ? fps : '—'}
        </Text>
        <Text style={styles.statusLabel}>fps</Text>
      </View>
      <View style={styles.statusItem}>
        <Text style={styles.statusValue}>
          {latest?.cpuPercent !== undefined ? `${latest.cpuPercent}%` : '—'}
        </Text>
        <Text style={styles.statusLabel}>cpu</Text>
      </View>
      <View style={styles.statusItem}>
        <Text style={styles.statusValue}>
          {latest?.usedMemoryMb !== undefined
            ? `${Math.round(latest.usedMemoryMb)}`
            : '—'}
        </Text>
        <Text style={styles.statusLabel}>mb</Text>
      </View>
    </View>
  );
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
  const { styles, theme } = usePanelStyles();

  if (!visible) {
    return null;
  }

  const latest = state.performance[state.performance.length - 1];

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.panel}>
        <StatusStrip latest={latest} styles={styles} theme={theme} />

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
