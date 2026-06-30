import { useEffect, useState } from 'react';
import { AppInspector } from '../core';
import type { InspectorState } from '../core';

/**
 * Subscribe to the inspector's live state. The component re-renders whenever a
 * capture module pushes new data (performance samples, renders, marks, …).
 */
export function useInspectorState(): InspectorState {
  const [state, setState] = useState<InspectorState>(() =>
    AppInspector.getState(),
  );

  useEffect(() => {
    // Sync immediately in case state changed between render and effect.
    setState(AppInspector.getState());
    return AppInspector.subscribe(setState);
  }, []);

  return state;
}
