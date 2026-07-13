import { Profiler } from 'react';
import type { ProfilerOnRenderCallback, ReactElement, ReactNode } from 'react';
import { AppInspector } from '../core';
import { inspectorUiRenderPending } from './uiRenderMark';

export interface InspectorProfilerProps {
  /** Stable id used to aggregate render stats for this subtree. */
  id: string;
  children: ReactNode;
}

/**
 * Wraps children in a React `<Profiler>` and feeds every commit into the
 * inspector's {@link RenderTracker}, surfacing render counts, durations and
 * slow/wasted re-renders in the panel.
 *
 * ```tsx
 * <InspectorProfiler id="ProductList">
 *   <ProductList />
 * </InspectorProfiler>
 * ```
 */
export function InspectorProfiler({
  id,
  children,
}: InspectorProfilerProps): ReactElement {
  const handleRender: ProfilerOnRenderCallback = (
    profilerId,
    phase,
    actualDuration,
  ) => {
    if (inspectorUiRenderPending()) {
      return;
    }
    AppInspector.getRenderTracker().record(profilerId, phase, actualDuration);
  };

  return (
    <Profiler id={id} onRender={handleRender}>
      {children}
    </Profiler>
  );
}
