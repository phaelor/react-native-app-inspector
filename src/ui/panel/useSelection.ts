import { useEffect, useState } from 'react';

export interface SelectionProps {
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

/**
 * Detail selection that the modal can own (so system back and the search bar
 * know a detail is open), falling back to local state when used standalone.
 * A selection whose item vanished (cleared, evicted) is reset so the owner
 * doesn't think a detail is still showing.
 */
export function useSelection(
  { selectedId, onSelect }: SelectionProps,
  exists: (id: string) => boolean,
): [string | null, (id: string | null) => void] {
  const [own, setOwn] = useState<string | null>(null);
  const current = onSelect ? (selectedId ?? null) : own;
  const select = onSelect ?? setOwn;
  const stale = current !== null && !exists(current);

  useEffect(() => {
    if (stale) {
      select(null);
    }
  }, [stale, select]);

  return [stale ? null : current, select];
}
