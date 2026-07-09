import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useInspectorState } from './useInspectorState';
import { fpsColor, useTheme } from './theme';
import type { Theme } from './theme';

/** Corner the badge docks to before it's dragged. */
export type BadgeCorner =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface InspectorFpsBadgeProps {
  visible?: boolean;
  /** Fired on a tap (never on a drag). */
  onPress?: () => void;
  /** Starting corner. Defaults to `top-right`. */
  initialCorner?: BadgeCorner;
}

const MARGIN = 12;
const TOP_INSET = 52;
const BOTTOM_INSET = 40;
const DRAG_THRESHOLD = 6;

function Stat({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: string;
  color: string;
  theme: Theme;
}): ReactElement {
  return (
    <View style={styles.cell}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={[styles.label, { color: theme.faint }]}>{label}</Text>
    </View>
  );
}

/** Draggable floating pill: live JS/UI FPS, CPU and memory; snaps to the nearest edge, tap opens the inspector. */
export function InspectorFpsBadge({
  visible = true,
  onPress,
  initialCorner = 'top-right',
}: InspectorFpsBadgeProps): ReactElement | null {
  const state = useInspectorState();
  const theme = useTheme();
  const dims = useWindowDimensions();

  const pan = useRef(new Animated.ValueXY()).current;
  const pos = useRef({ x: 0, y: 0 });
  const size = useRef({ width: 0, height: 0 });
  const placed = useRef(false);
  const [ready, setReady] = useState(false);
  const dimsRef = useRef(dims);
  dimsRef.current = dims;

  useEffect(() => {
    const id = pan.addListener((value) => {
      pos.current = value;
    });
    return () => pan.removeListener(id);
  }, [pan]);

  const cornerFor = (corner: BadgeCorner): { x: number; y: number } => {
    const right = dims.width - size.current.width - MARGIN;
    const bottom = dims.height - size.current.height - BOTTOM_INSET;
    return {
      x: corner.endsWith('right') ? Math.max(MARGIN, right) : MARGIN,
      y: corner.startsWith('bottom') ? Math.max(TOP_INSET, bottom) : TOP_INSET,
    };
  };

  const snapToEdge = (): void => {
    const { width, height } = dimsRef.current;
    const maxX = Math.max(MARGIN, width - size.current.width - MARGIN);
    const maxY = Math.max(
      TOP_INSET,
      height - size.current.height - BOTTOM_INSET,
    );
    const center = pos.current.x + size.current.width / 2;
    Animated.spring(pan, {
      toValue: {
        x: center < width / 2 ? MARGIN : maxX,
        y: Math.min(Math.max(pos.current.y, TOP_INSET), maxY),
      },
      friction: 7,
      tension: 60,
      useNativeDriver: false,
    }).start();
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > DRAG_THRESHOLD || Math.abs(g.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        pan.setOffset(pos.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        snapToEdge();
      },
    }),
  ).current;

  if (!visible) {
    return null;
  }

  const latest = state.performance[state.performance.length - 1];
  const jsFps = latest?.jsFps ?? 0;
  const uiFps = latest?.uiFps ?? 0;

  return (
    <Animated.View
      {...responder.panHandlers}
      onLayout={(e) => {
        size.current = {
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        };
        if (!placed.current) {
          placed.current = true;
          pan.setValue(cornerFor(initialCorner));
          setReady(true);
        }
      }}
      style={[
        styles.container,
        { backgroundColor: theme.bg, borderColor: theme.divider },
        { opacity: ready ? 1 : 0, transform: pan.getTranslateTransform() },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open inspector"
        onPress={onPress}
        style={styles.inner}
      >
        <Stat
          label="JS"
          value={jsFps > 0 ? String(jsFps) : '—'}
          color={fpsColor(theme, jsFps)}
          theme={theme}
        />
        <Stat
          label="UI"
          value={uiFps > 0 ? String(uiFps) : 'n/a'}
          color={uiFps > 0 ? fpsColor(theme, uiFps) : theme.muted}
          theme={theme}
        />
        <Stat
          label="CPU"
          value={
            latest?.cpuPercent !== undefined ? `${latest.cpuPercent}%` : '—'
          }
          color={theme.text}
          theme={theme}
        />
        <Stat
          label="MB"
          value={
            latest?.usedMemoryMb !== undefined
              ? String(Math.round(latest.usedMemoryMb))
              : '—'
          }
          color={theme.text}
          theme={theme}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cell: {
    alignItems: 'center',
    gap: 1,
  },
  value: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 22,
    textAlign: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
