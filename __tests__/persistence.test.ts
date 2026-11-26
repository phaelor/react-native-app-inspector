import { AppInspector } from '../src/core';
import type { PersistenceAdapter } from '../src/core/types';
import { SessionPersistence } from '../src/modules/persistence';

/** In-memory adapter standing in for AsyncStorage. */
function memoryAdapter(): PersistenceAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => Promise.resolve(store.get(k) ?? null),
    setItem: (k, v) => {
      store.set(k, v);
      return Promise.resolve();
    },
    removeItem: (k) => {
      store.delete(k);
      return Promise.resolve();
    },
  };
}

describe('session persistence', () => {
  it('saves the session on persist() and reloads it as the previous session', async () => {
    const adapter = memoryAdapter();

    AppInspector.configure({ storage: adapter });
    AppInspector.clear();
    AppInspector.trackNavigation('Home');
    AppInspector.trackAction('tap');

    await AppInspector.persist();
    expect(adapter.store.size).toBe(1);

    // Simulate a relaunch: a fresh configure + start loads the previous run.
    AppInspector.configure({ storage: adapter });
    AppInspector.start();
    await Promise.resolve();
    await Promise.resolve();

    const previous = AppInspector.getPreviousSession();
    AppInspector.stop();

    expect(previous).not.toBeNull();
    expect(previous?.events.length).toBeGreaterThanOrEqual(2);
    expect(typeof previous?.savedAt).toBe('number');
  });

  it('is a no-op without a storage adapter', async () => {
    AppInspector.configure();
    await expect(AppInspector.persist()).resolves.toBeUndefined();
    expect(AppInspector.getPreviousSession()).toBeNull();
  });
});

describe('SessionPersistence', () => {
  const KEY = '@app-inspector/last-session';
  const valid = { savedAt: 1, session: 's', startedAt: 0, events: [] };

  function adapterWith(raw: string | null): PersistenceAdapter {
    return {
      getItem: () => Promise.resolve(raw),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    };
  }

  const failing: PersistenceAdapter = {
    getItem: () => Promise.reject(new Error('disk')),
    setItem: () => Promise.reject(new Error('quota')),
    removeItem: () => Promise.reject(new Error('disk')),
  };

  it('loads a well-formed session', async () => {
    const p = new SessionPersistence(adapterWith(JSON.stringify(valid)));
    await expect(p.loadPrevious()).resolves.toEqual(valid);
  });

  it.each([
    ['corrupt JSON', '{"savedAt":'],
    ['a non-object', '42'],
    ['events that are not an array', JSON.stringify({ ...valid, events: {} })],
    ['a missing savedAt', JSON.stringify({ ...valid, savedAt: undefined })],
  ])('returns null for %s', async (_case, raw) => {
    const p = new SessionPersistence(adapterWith(raw));
    await expect(p.loadPrevious()).resolves.toBeNull();
  });

  it('never throws when the adapter fails', async () => {
    const p = new SessionPersistence(failing, KEY);
    await expect(p.loadPrevious()).resolves.toBeNull();
    await expect(
      p.save({ session: 's', startedAt: 0, events: [] }),
    ).resolves.toBeUndefined();
    await expect(p.clear()).resolves.toBeUndefined();
  });
});

describe('previous-session loading', () => {
  afterEach(() => {
    AppInspector.stop();
    AppInspector.configure();
  });

  it('ignores a load that finishes after configure() swapped the adapter', async () => {
    let resolveOld: (raw: string) => void = () => undefined;
    const slow: PersistenceAdapter = {
      getItem: () =>
        new Promise<string>((resolve) => {
          resolveOld = resolve;
        }),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    };

    AppInspector.configure({ storage: slow });
    AppInspector.start();
    AppInspector.stop();
    AppInspector.configure({ storage: memoryAdapter() });

    resolveOld(
      JSON.stringify({ savedAt: 1, session: 'old', startedAt: 0, events: [] }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(AppInspector.getPreviousSession()).toBeNull();
  });
});
