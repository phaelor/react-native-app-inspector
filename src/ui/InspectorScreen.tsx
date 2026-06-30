import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { AppInspector } from '../core';
import { InspectorProfiler } from './InspectorProfiler';

export interface InspectorScreenProps {
  /** Screen name used for navigation + the performance profile. */
  name: string;
  children: ReactNode;
}

/**
 * Manually profile a screen without React Navigation. On mount it enters the
 * screen (so subsequent renders, FPS, memory and network are attributed to it)
 * and wraps the subtree in a profiler so its render cost is measured.
 *
 * ```tsx
 * <InspectorScreen name="Checkout">
 *   <Checkout />
 * </InspectorScreen>
 * ```
 */
export function InspectorScreen({
  name,
  children,
}: InspectorScreenProps): ReactElement {
  useEffect(() => {
    AppInspector.trackNavigation(name);
  }, [name]);

  return <InspectorProfiler id={name}>{children}</InspectorProfiler>;
}
