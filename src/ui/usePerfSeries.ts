import { useMemo } from 'react';
import type { PerformanceSample } from '../core/types';

/** Numeric series extracted from recent performance samples, for sparklines. */
export interface PerfSeries {
  jsFps: number[];
  uiFps: number[];
  cpuPercent: number[];
  usedMemoryMb: number[];
}

/** Last `count` samples split into per-metric series (missing values → 0). */
export function usePerfSeries(
  samples: readonly PerformanceSample[],
  count = 40,
): PerfSeries {
  return useMemo(() => {
    const recent = samples.slice(-count);
    return {
      jsFps: recent.map((s) => s.jsFps),
      uiFps: recent.map((s) => s.uiFps),
      cpuPercent: recent.map((s) => s.cpuPercent ?? 0),
      usedMemoryMb: recent.map((s) => s.usedMemoryMb ?? 0),
    };
  }, [samples, count]);
}
