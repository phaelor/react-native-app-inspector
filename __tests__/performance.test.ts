import { PerformanceMonitor } from '../src/modules/performance';

type FrameCb = (ts: number) => void;

/** Drives the monitor with a manual frame clock; returns emitted samples. */
function run(frames: number[]) {
  const samples: ReturnType<PerformanceMonitor['getSamples']>[number][] = [];
  let cb: FrameCb | null = null;
  const monitor = new PerformanceMonitor({
    sampleIntervalMs: 1000,
    scheduleFrame: (fn) => {
      cb = fn;
      return 1;
    },
    cancelFrame: () => {},
    now: () => 0,
    onSample: (s) => samples.push(s),
  });
  monitor.start();
  for (const ts of frames) {
    cb!(ts);
  }
  monitor.stop();
  return samples;
}

const g = globalThis as {
  HermesInternal?: unknown;
  performance?: { memory?: unknown };
};

describe('PerformanceMonitor heap reading', () => {
  const originalHermes = g.HermesInternal;
  const originalPerformance = g.performance;

  afterEach(() => {
    g.HermesInternal = originalHermes;
    g.performance = originalPerformance;
  });

  it('reads the Hermes heap when performance.memory is absent', () => {
    g.performance = {};
    g.HermesInternal = {
      getInstrumentedStats: () => ({
        js_allocatedBytes: 12 * 1024 * 1024,
        js_heapSize: 40 * 1024 * 1024,
      }),
    };
    const [sample] = run([0, 500, 1000]);
    expect(sample?.jsHeapUsedMb).toBe(12);
    expect(sample?.jsHeapTotalMb).toBe(40);
  });

  it('prefers performance.memory when both exist', () => {
    g.performance = {
      memory: {
        usedJSHeapSize: 2 * 1024 * 1024,
        totalJSHeapSize: 8 * 1024 * 1024,
      },
    };
    g.HermesInternal = {
      getInstrumentedStats: () => ({ js_allocatedBytes: 99 * 1024 * 1024 }),
    };
    const [sample] = run([0, 500, 1000]);
    expect(sample?.jsHeapUsedMb).toBe(2);
  });

  it('leaves heap undefined when Hermes stats throw or are missing', () => {
    g.performance = {};
    g.HermesInternal = {
      getInstrumentedStats: () => {
        throw new Error('nope');
      },
    };
    const [sample] = run([0, 500, 1000]);
    expect(sample?.jsHeapUsedMb).toBeUndefined();
  });
});
