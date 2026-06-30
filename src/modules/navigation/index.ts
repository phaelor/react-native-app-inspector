import { AppInspector } from '../../core';

/** Minimal shape of a React Navigation state tree (version-agnostic). */
export interface NavigationStateLike {
  index: number;
  routes: Array<{ name: string; state?: NavigationStateLike }>;
}

/** Minimal shape of a React Navigation container ref. */
export interface NavigationRefLike {
  getCurrentRoute?: () => { name?: string } | undefined;
}

/** Walk the nested navigation state to the focused (leaf) route name. */
export function getActiveRouteName(
  state: NavigationStateLike | undefined,
): string | undefined {
  if (!state) {
    return undefined;
  }
  const route = state.routes[state.index];
  if (!route) {
    return undefined;
  }
  return route.state ? getActiveRouteName(route.state) : route.name;
}

/** Handlers to spread onto a `NavigationContainer`. */
export interface NavigationTracker {
  onReady: () => void;
  onStateChange: (state: NavigationStateLike | undefined) => void;
}

/**
 * Drop-in React Navigation integration: records every screen change on the
 * timeline automatically, so you don't have to call `trackNavigation` by hand.
 *
 * ```tsx
 * const navigationRef = useNavigationContainerRef();
 * const tracker = createNavigationTracker(navigationRef);
 * <NavigationContainer ref={navigationRef} {...tracker}>…</NavigationContainer>
 * ```
 */
export function createNavigationTracker(
  navigationRef?: NavigationRefLike,
): NavigationTracker {
  let last: string | undefined;

  const record = (name: string | undefined): void => {
    if (name && name !== last) {
      last = name;
      AppInspector.trackNavigation(name);
    }
  };

  return {
    onReady: () => record(navigationRef?.getCurrentRoute?.()?.name),
    onStateChange: (state) =>
      record(
        getActiveRouteName(state) ?? navigationRef?.getCurrentRoute?.()?.name,
      ),
  };
}
