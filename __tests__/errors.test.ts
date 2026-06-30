import { ErrorTracker, type ErrorEntry } from '../src/modules/errors';

describe('ErrorTracker', () => {
  it('captures console.error / console.warn and restores on stop', () => {
    const entries: ErrorEntry[] = [];
    const tracker = new ErrorTracker({ onEntry: (e) => entries.push(e) });

    const pristineWarn = console.warn;
    tracker.start();
    expect(console.warn).not.toBe(pristineWarn);

    console.error('boom', { code: 500 });
    console.warn('careful');

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      severity: 'error',
      source: 'console.error',
    });
    expect(entries[0]?.message).toContain('boom');
    expect(entries[1]).toMatchObject({
      severity: 'warn',
      source: 'console.warn',
    });

    tracker.stop();
    expect(console.warn).toBe(pristineWarn);

    console.warn('after stop');
    expect(entries).toHaveLength(2);
  });

  it('captures uncaught errors via ErrorUtils', () => {
    const entries: ErrorEntry[] = [];
    const g = globalThis as { ErrorUtils?: unknown };
    const original = g.ErrorUtils;
    type Handler = (e: unknown, fatal?: boolean) => void;
    const holder: { current: Handler } = { current: () => {} };
    g.ErrorUtils = {
      getGlobalHandler: () => holder.current,
      setGlobalHandler: (h: Handler) => {
        holder.current = h;
      },
    };

    const tracker = new ErrorTracker({ onEntry: (e) => entries.push(e) });
    tracker.start();
    holder.current(new Error('kaboom'), true);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ source: 'uncaught', fatal: true });
    expect(entries[0]?.message).toBe('kaboom');

    tracker.stop();
    g.ErrorUtils = original;
  });
});
