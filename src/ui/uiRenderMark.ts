let marked = false;
let badgeMarked = false;

export function markInspectorUiRender(): void {
  if (marked) {
    return;
  }
  marked = true;
  queueMicrotask(() => {
    marked = false;
  });
}

export function inspectorUiRenderPending(): boolean {
  return marked;
}

/**
 * The badge re-renders with every sample. Only the production commit hook
 * needs to know: it sees every commit, while the Profiler that reports commits
 * in development never wraps the badge.
 */
export function markInspectorBadgeRender(): void {
  if (badgeMarked) {
    return;
  }
  badgeMarked = true;
  queueMicrotask(() => {
    badgeMarked = false;
  });
}

export function inspectorBadgeRenderPending(): boolean {
  return badgeMarked;
}
