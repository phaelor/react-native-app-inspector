import { Profiler, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import type { ReactElement, ReactNode } from 'react';
import { AppInspector } from '../core';
import {
  TapDetector,
  describeTapTarget,
  type TouchSample,
} from '../modules/taps';

export interface InspectorTapBoundaryProps {
  children: ReactNode;
}

/**
 * Auto taps complete on the next commit, so a commit that arrives late is
 * increasingly likely to be unrelated (a timer, an animation) rather than the
 * tap's own response — cap the wait well below the tracker's manual timeout.
 */
const AUTO_TAP_TIMEOUT_MS = 2000;

function toSample(event: GestureResponderEvent): TouchSample {
  const native = event.nativeEvent;
  return {
    pageX: native.pageX ?? 0,
    pageY: native.pageY ?? 0,
    timestampMs: native.timestamp,
    touchCount: native.touches?.length,
  };
}

/**
 * Auto-captures tap-to-response latency for every pressable child. Touch
 * events bubble here regardless of which child claims the responder, so
 * gestures are unaffected. Adds one flex:1 View around the children;
 * `InspectorRoot` mounts this automatically.
 */
export function InspectorTapBoundary({
  children,
}: InspectorTapBoundaryProps): ReactElement {
  const detectorRef = useRef<TapDetector | null>(null);
  if (detectorRef.current === null) {
    detectorRef.current = new TapDetector({
      onTap: (tap) => {
        const info = describeTapTarget(tap.target);
        if (!info) {
          return;
        }
        AppInspector.getInteractionTracker().begin(info.label ?? 'Tap', {
          nativeTimestampMs: tap.nativeTimestampMs,
          completeOnCommit: true,
          auto: true,
          timeoutMs: AUTO_TAP_TIMEOUT_MS,
        });
      },
    });
  }
  const detector = detectorRef.current;

  return (
    <View
      style={styles.container}
      testID="inspector-tap-boundary"
      onTouchStart={(event) =>
        detector.touchStart(
          toSample(event),
          (event as unknown as { _targetInst?: unknown })._targetInst,
        )
      }
      onTouchEnd={(event) => detector.touchEnd(toSample(event))}
      onTouchCancel={() => detector.cancel()}
    >
      {/* Commit driver for the children subtree: without it, tap completion
          would depend on the host also mounting an InspectorProfiler
          (e.g. profileRoot={false} would silently break auto capture). */}
      <Profiler id="inspector-taps" onRender={notifyCommit}>
        {children}
      </Profiler>
    </View>
  );
}

function notifyCommit(): void {
  AppInspector.getInteractionTracker().notifyCommit();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
