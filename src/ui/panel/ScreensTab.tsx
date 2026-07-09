import { useState } from 'react';
import type { ReactElement } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { InspectorState } from '../../core';
import type { ScreenProblem, ScreenProfile } from '../../core/types';
import { Row } from './Row';
import { usePanelStyles } from './styles';
import { scoreColor } from '../theme';

function ScreenListRow({
  profile,
  onPress,
}: {
  profile: ScreenProfile;
  onPress: () => void;
}): ReactElement {
  const { styles, theme } = usePanelStyles();
  const color = scoreColor(theme, profile.score);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={styles.screenRow}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.screenName}>{profile.screen}</Text>
      <Text style={styles.screenMeta}>
        {profile.problems.length > 0
          ? `${profile.problems.length} issue${profile.problems.length > 1 ? 's' : ''}`
          : 'healthy'}
      </Text>
      <Text style={[styles.screenScore, { color }]}>{profile.score}</Text>
    </TouchableOpacity>
  );
}

function ProblemRow({ problem }: { problem: ScreenProblem }): ReactElement {
  const { styles, theme } = usePanelStyles();
  const color = problem.severity === 'error' ? theme.bad : theme.warn;
  return (
    <View style={styles.problemRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.problemText}>{problem.label}</Text>
    </View>
  );
}

function ms(value: number | undefined): string {
  return value !== undefined ? `${value} ms` : 'n/a';
}

function ScreenDetail({
  profile,
  onBack,
}: {
  profile: ScreenProfile;
  onBack: () => void;
}): ReactElement {
  const { styles, theme } = usePanelStyles();
  const color = scoreColor(theme, profile.score);
  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onBack}
        style={styles.back}
      >
        <Text style={styles.backText}>‹ Back to screens</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>{profile.screen}</Text>
      <View style={styles.scoreHeadline}>
        <Text style={[styles.scoreBig, { color }]}>{profile.score}</Text>
        <Text style={styles.scoreOutOf}>/ 100</Text>
      </View>

      <Text style={styles.sectionTitle}>Metrics</Text>
      <Row
        label="load"
        value={ms(profile.loadTimeMs ?? profile.firstRenderMs)}
      />
      <Row
        label="renders"
        value={`${profile.render.commits}× · ${profile.render.avgMs}ms avg · ${profile.render.worstMs}ms max`}
      />
      <Row
        label="FPS avg"
        value={
          profile.fps.average > 0
            ? `${profile.fps.average}${profile.fps.drops ? ` · ${profile.fps.drops} drop` : ''}`
            : 'n/a'
        }
      />
      <Row
        label="memory"
        value={
          profile.memory.increaseMb !== undefined
            ? `${profile.memory.increaseMb >= 0 ? '+' : ''}${profile.memory.increaseMb} MB`
            : 'n/a'
        }
      />
      <Row
        label="network"
        value={`${profile.network.requests} req · ${profile.network.slowRequests} slow`}
      />
      <Row
        label="taps"
        value={
          profile.interactions.count > 0
            ? `${profile.interactions.count}× · ${profile.interactions.worstMs}ms worst`
            : 'n/a'
        }
      />

      <Text style={styles.sectionTitle}>Why slow?</Text>
      {profile.problems.length > 0 ? (
        profile.problems.map((problem, i) => (
          <ProblemRow key={`${problem.kind}-${i}`} problem={problem} />
        ))
      ) : (
        <Text style={styles.empty}>
          No problems detected — this screen is healthy.
        </Text>
      )}
    </View>
  );
}

/**
 * Per-screen performance profiles: each screen scored 0–100 with its concrete
 * problems. Tap a screen to see why it's slow.
 */
export function ScreensTab({ state }: { state: InspectorState }): ReactElement {
  const { styles } = usePanelStyles();
  const [selected, setSelected] = useState<string | null>(null);
  const { screens } = state;

  if (screens.length === 0) {
    return (
      <Text style={styles.empty}>
        Navigate between screens to profile them — use
        createNavigationTracker(),
        {' <InspectorScreen>'}, or AppInspector.trackNavigation(name).
      </Text>
    );
  }

  const current = selected
    ? screens.find((s) => s.screen === selected)
    : undefined;
  if (current) {
    return <ScreenDetail profile={current} onBack={() => setSelected(null)} />;
  }

  return (
    <View>
      {screens.map((profile) => (
        <ScreenListRow
          key={profile.screen}
          profile={profile}
          onPress={() => setSelected(profile.screen)}
        />
      ))}
    </View>
  );
}
