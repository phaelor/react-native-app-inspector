import { AppInspector } from '../src/core';
import type { PersistenceAdapter } from '../src/core/types';

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
