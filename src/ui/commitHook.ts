import {
  inspectorBadgeRenderPending,
  inspectorUiRenderPending,
} from './uiRenderMark';

const HOOK_KEY = '__REACT_DEVTOOLS_GLOBAL_HOOK__';

/**
 * Production React never calls `Profiler.onRender`, which is what reports
 * commits in development. The renderer does still report every commit to the
 * DevTools global hook, if one exists when the renderer initialises. Release
 * builds have none, so this installs a minimal one that only forwards commits.
 *
 * It has to run before the renderer loads: import the package at the top of
 * the app's entry file. When it is too late nothing is installed and auto taps
 * end at the next presented frame instead (see InteractionTracker).
 *
 * Returns whether the hook was installed.
 */
export function installCommitHook(
  target: Record<string, unknown>,
  isDev: boolean,
  onCommit: () => void,
): boolean {
  // In development the real DevTools hook is there and the Profiler works.
  if (isDev || target[HOOK_KEY] !== undefined) {
    return false;
  }
  const renderers = new Map<number, unknown>();
  let nextId = 0;
  target[HOOK_KEY] = {
    supportsFiber: true,
    isDisabled: false,
    renderers,
    inject(renderer: unknown): number {
      nextId += 1;
      renderers.set(nextId, renderer);
      return nextId;
    },
    onCommitFiberRoot(): void {
      // The inspector's own badge and panel commit too; they are not the
      // app's response to a tap.
      if (!inspectorUiRenderPending() && !inspectorBadgeRenderPending()) {
        onCommit();
      }
    },
    onPostCommitFiberRoot(): void {},
    onCommitFiberUnmount(): void {},
    checkDCE(): void {},
    on(): void {},
    off(): void {},
    emit(): void {},
    sub(): () => void {
      return () => {};
    },
  };
  return true;
}
