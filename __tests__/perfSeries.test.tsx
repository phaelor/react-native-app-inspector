import { renderHook } from '@testing-library/react-native';
import { usePerfSeries } from '../src/ui/usePerfSeries';
import type { PerformanceSample } from '../src/core/types';

function sample(over: Partial<PerformanceSample>): PerformanceSample {
  return {
    timestamp: 0,
    jsFps: 60,
    uiFps: 60,
    jankyFrames: 0,
    longestFrameMs: 16,
    ...over,
  };
}

describe('usePerfSeries', () => {
  it('splits samples into per-metric series', () => {
    const samples = [
      sample({ jsFps: 58, uiFps: 60, cpuPercent: 12, usedMemoryMb: 120 }),
      sample({ jsFps: 30, uiFps: 45, cpuPercent: 80, usedMemoryMb: 140 }),
    ];
    const { result } = renderHook(() => usePerfSeries(samples));
    expect(result.current.jsFps).toEqual([58, 30]);
    expect(result.current.uiFps).toEqual([60, 45]);
    expect(result.current.cpuPercent).toEqual([12, 80]);
    expect(result.current.usedMemoryMb).toEqual([120, 140]);
  });

  it('defaults missing native metrics to 0', () => {
    const { result } = renderHook(() =>
      usePerfSeries([
        sample({ cpuPercent: undefined, usedMemoryMb: undefined }),
      ]),
    );
    expect(result.current.cpuPercent).toEqual([0]);
    expect(result.current.usedMemoryMb).toEqual([0]);
  });

  it('keeps only the last `count` samples', () => {
    const samples = Array.from({ length: 50 }, (_, i) => sample({ jsFps: i }));
    const { result } = renderHook(() => usePerfSeries(samples, 10));
    expect(result.current.jsFps).toHaveLength(10);
    expect(result.current.jsFps[0]).toBe(40);
  });
});
