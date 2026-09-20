import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Platform, StatusBar } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { NativeMetricsModule } from '../native';
import type { WindowInsets } from '../native';

const ZERO: WindowInsets = { top: 0, right: 0, bottom: 0, left: 0 };

// Survive remounts so a reopened panel is padded from its first frame.
let cachedInsets: WindowInsets | null = null;
let cachedCoversScreen = false;

export interface ModalInsets {
  padding: {
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
  };
  /**
   * True on iOS when the native module is not linked, so nothing can report
   * the insets and the caller falls back to React Native's SafeAreaView.
   */
  useLegacySafeArea: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
}

function sameInsets(a: WindowInsets | null, b: WindowInsets): boolean {
  return (
    a !== null &&
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom &&
    a.left === b.left
  );
}

/**
 * Safe-area padding for the full-screen panel without SafeAreaView, which
 * React Native deprecated in 0.81 and which never did anything on Android.
 *
 * iOS: a full-screen Modal always extends under the status bar and home
 * indicator, so the window insets always apply. Android: they apply only when
 * the Modal is drawn edge-to-edge, which is detected by the panel covering the
 * whole screen; otherwise the system already keeps it clear of the bars.
 */
export function useModalInsets(visible: boolean): ModalInsets {
  const native = NativeMetricsModule.supportsWindowInsets();
  const [insets, setInsets] = useState<WindowInsets | null>(cachedInsets);
  const [coversScreen, setCoversScreen] = useState(cachedCoversScreen);

  useEffect(() => {
    if (!native) {
      return undefined;
    }
    let cancelled = false;
    const refresh = (): void => {
      void NativeMetricsModule.getWindowInsets().then((next) => {
        if (cancelled || next === null) {
          return;
        }
        cachedInsets = next;
        setInsets((prev) => (sameInsets(prev, next) ? prev : next));
      });
    };
    refresh();
    const subscription = Dimensions.addEventListener('change', refresh);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [native, visible]);

  const onLayout = useCallback((event: LayoutChangeEvent): void => {
    if (Platform.OS !== 'android') {
      return;
    }
    // Latched: edge-to-edge is a property of the app, while the height also
    // drops below the screen's whenever the keyboard resizes the Modal.
    if (
      event.nativeEvent.layout.height >=
      Dimensions.get('screen').height - 1
    ) {
      cachedCoversScreen = true;
      setCoversScreen(true);
    }
  }, []);

  let applied = ZERO;
  if (Platform.OS === 'android') {
    if (coversScreen) {
      applied = insets ?? { ...ZERO, top: StatusBar.currentHeight ?? 0 };
    }
  } else if (insets) {
    applied = insets;
  }

  return {
    padding: {
      paddingTop: applied.top,
      paddingRight: applied.right,
      paddingBottom: applied.bottom,
      paddingLeft: applied.left,
    },
    useLegacySafeArea: Platform.OS === 'ios' && !native,
    onLayout,
  };
}

/** Test hook: forget what earlier panels measured. */
export function resetModalInsetsCache(): void {
  cachedInsets = null;
  cachedCoversScreen = false;
}
