import { useEffect, useState } from 'react';
import { AppInspector } from '../core';
import type { InspectorState } from '../core';

/**
 * Subscribe to the inspector's live state. The component re-renders whenever a
 * capture module pushes new data (performance samples, renders, marks, …).
 *
 * Pass `active: false` to pause the subscription (e.g. while the consuming UI
 * is hidden); the last observed state keeps being returned.
 */
export function useInspectorState(active = true): InspectorState {
  const [state, setState] = useState<InspectorState>(() =>
    AppInspector.getState(),
  );

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    // Sync immediately in case state changed between render and effect.
    setState(AppInspector.getState());
    return AppInspector.subscribe(setState);
  }, [active]);

  return state;
}
