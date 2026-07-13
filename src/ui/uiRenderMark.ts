let marked = false;

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
