import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { AppInspector } from '../core';
import type { AppInspectorConfig } from '../core/types';
import {
  createNavigationTracker,
  type NavigationRefLike,
} from '../modules/navigation';
import { InspectorFpsBadge, type BadgeCorner } from './InspectorFpsBadge';
import { InspectorModal, type InspectorModalProps } from './InspectorModal';
import { InspectorProfiler } from './InspectorProfiler';
import { InspectorTapBoundary } from './InspectorTapBoundary';

export interface InspectorRootProps {
  children: ReactNode;
  /** Master switch. When `false` the children render untouched. Gate with `__DEV__`. */
  enabled?: boolean;
  /** React Navigation container ref; screen changes are then tracked automatically. */
  navigationRef?: NavigationRefLike;
  /** Whether the floating FPS badge starts visible. Defaults to `true`. */
  badge?: boolean;
  badgeCorner?: BadgeCorner;
  initialTab?: InspectorModalProps['initialTab'];
  /** Wrap the app in a root render profiler (id `App`). Defaults to `true`. */
  profileRoot?: boolean;
  /**
   * Auto-capture tap-to-response latency for every pressable child. Adds one
   * flex:1 View around the children. Defaults to `true`.
   */
  autoCaptureTaps?: boolean;
  storage?: AppInspectorConfig['storage'];
  /** Stores to browse in the Storage tab (see `asyncStorageAdapter`). */
  storages?: AppInspectorConfig['storages'];
  clipboard?: AppInspectorConfig['clipboard'];
  modules?: AppInspectorConfig['modules'];
  maxEntries?: number;
}

/**
 * Single-wrapper integration: configuration, capture lifecycle, the FPS badge
 * and the panel (badge tap opens it), root render profiling, and — given a
 * `navigationRef` — automatic screen tracking.
 *
 * ```tsx
 * <InspectorRoot enabled={__DEV__} storage={AsyncStorage} navigationRef={navRef}>
 *   <App />
 * </InspectorRoot>
 * ```
 */
export function InspectorRoot({
  children,
  enabled = true,
  navigationRef,
  badge = true,
  badgeCorner,
  initialTab,
  profileRoot = true,
  autoCaptureTaps = true,
  storage,
  storages,
  clipboard,
  modules,
  maxEntries,
}: InspectorRootProps): ReactElement {
  const [panelOpen, setPanelOpen] = useState(false);
  const [badgeVisible, setBadgeVisible] = useState(badge);

  // Read at start() time so inline object props don't restart capture.
  const configRef = useRef<AppInspectorConfig>({});
  configRef.current = { storage, storages, clipboard, modules, maxEntries };

  // Layout effect: runs before any child's passive effect, so requests fired
  // from children's mount effects are already captured.
  useLayoutEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const { storage, storages, clipboard, modules, maxEntries } =
      configRef.current;
    const config: AppInspectorConfig = { enabled: true };
    if (storage) config.storage = storage;
    if (storages) config.storages = storages;
    if (clipboard) config.clipboard = clipboard;
    if (modules) config.modules = modules;
    if (maxEntries !== undefined) config.maxEntries = maxEntries;
    AppInspector.configure(config);
    AppInspector.start();
    return () => AppInspector.stop();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !navigationRef) {
      return undefined;
    }
    const tracker = createNavigationTracker(navigationRef);
    tracker.onReady();
    return navigationRef.addListener?.('state', (event) =>
      tracker.onStateChange(event.data?.state),
    );
  }, [enabled, navigationRef]);

  if (!enabled) {
    return <>{children}</>;
  }

  const content = autoCaptureTaps ? (
    <InspectorTapBoundary>{children}</InspectorTapBoundary>
  ) : (
    children
  );

  return (
    <>
      {profileRoot ? (
        <InspectorProfiler id="App">{content}</InspectorProfiler>
      ) : (
        content
      )}
      <InspectorFpsBadge
        visible={badgeVisible}
        initialCorner={badgeCorner}
        onPress={() => setPanelOpen((open) => !open)}
      />
      <InspectorModal
        visible={panelOpen}
        onClose={() => setPanelOpen(false)}
        initialTab={initialTab}
        badgeVisible={badgeVisible}
        onToggleBadge={() => setBadgeVisible((visible) => !visible)}
      />
    </>
  );
}
