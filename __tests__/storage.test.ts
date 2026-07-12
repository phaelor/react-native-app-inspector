import {
  asyncStorageAdapter,
  formatSize,
  formatStorageValue,
  isAsyncStorageLike,
  listEntries,
  mmkvAdapter,
  type AsyncStorageLike,
  type MmkvLike,
} from '../src/modules/storage';
import { AppInspector } from '../src/core';

function fakeAsyncStorage(
  seed: Record<string, string> = {},
): AsyncStorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getAllKeys: () => Promise.resolve([...map.keys()]),
    getItem: (key) => Promise.resolve(map.get(key) ?? null),
    setItem: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      map.clear();
      return Promise.resolve();
    },
  };
}

function fakeMmkv(
  seed: Record<string, string | number | boolean> = {},
): MmkvLike & { map: Map<string, string | number | boolean> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getAllKeys: () => [...map.keys()],
    getString: (key) => {
      const value = map.get(key);
      if (value === undefined) return undefined;
      if (typeof value === 'string') return value;
      return typeof value === 'number' ? '' : undefined;
    },
    getNumber: (key) => {
      const value = map.get(key);
      return typeof value === 'number' ? value : undefined;
    },
    getBoolean: (key) => {
      const value = map.get(key);
      if (value === undefined) return undefined;
      if (typeof value === 'boolean') return value;
      return typeof value === 'string' ? true : false;
    },
    set: (key, value) => {
      map.set(key, value);
    },
    delete: (key) => {
      map.delete(key);
    },
    clearAll: () => {
      map.clear();
    },
  };
}

describe('asyncStorageAdapter', () => {
  it('exposes keys, values and mutations of the underlying store', async () => {
    const store = fakeAsyncStorage({ a: '1', b: '2' });
    const adapter = asyncStorageAdapter(store);

    expect(adapter.name).toBe('AsyncStorage');
    expect(await adapter.getAllKeys()).toEqual(['a', 'b']);
    expect(await adapter.get('a')).toBe('1');
    expect(await adapter.get('missing')).toBeNull();

    await adapter.set('c', '3');
    expect(store.map.get('c')).toBe('3');
    await adapter.remove('a');
    expect(store.map.has('a')).toBe(false);
    await adapter.clear!();
    expect(store.map.size).toBe(0);
  });

  it('omits clear when the store has none', () => {
    const { clear, ...withoutClear } = fakeAsyncStorage();
    void clear;
    expect(asyncStorageAdapter(withoutClear).clear).toBeUndefined();
  });
});

describe('mmkvAdapter', () => {
  it('reads typed values as strings', async () => {
    const adapter = mmkvAdapter(
      fakeMmkv({ token: 'abc', retries: 3, dark: false }),
    );
    expect(adapter.name).toBe('MMKV');
    expect(await adapter.get('token')).toBe('abc');
    expect(await adapter.get('retries')).toBe('3');
    expect(await adapter.get('dark')).toBe('false');
    expect(await adapter.get('missing')).toBeNull();
  });

  it('preserves the MMKV type when editing number and boolean keys', async () => {
    const store = fakeMmkv({ retries: 3, dark: false, note: 'hi' });
    const adapter = mmkvAdapter(store);

    await adapter.set('retries', '5');
    expect(store.map.get('retries')).toBe(5);
    await adapter.set('dark', 'true');
    expect(store.map.get('dark')).toBe(true);
    await adapter.set('note', '42');
    expect(store.map.get('note')).toBe('42');
    await adapter.set('note', 'true');
    expect(store.map.get('note')).toBe('true');
    // A non-numeric edit of a number key degrades to a string.
    await adapter.set('retries', 'oops');
    expect(store.map.get('retries')).toBe('oops');
  });

  it('reads typed values despite the JSI getter quirks', async () => {
    // getString returns "" (not undefined) for a number key and getBoolean
    // returns garbage for non-boolean keys — the adapter must not be fooled.
    const adapter = mmkvAdapter(fakeMmkv({ count: 7, empty: '' }));
    expect(await adapter.get('count')).toBe('7');
    expect(await adapter.get('empty')).toBe('');
  });

  it('removes and clears', async () => {
    const store = fakeMmkv({ a: '1', b: '2' });
    const adapter = mmkvAdapter(store);
    await adapter.remove('a');
    expect(store.map.has('a')).toBe(false);
    await adapter.clear!();
    expect(store.map.size).toBe(0);
  });
});

describe('listEntries', () => {
  it('sorts by key and reports value sizes', async () => {
    const adapter = asyncStorageAdapter(
      fakeAsyncStorage({ b: 'xx', a: 'xxxx' }),
    );
    expect(await listEntries(adapter)).toEqual([
      { key: 'a', size: 4, preview: 'xxxx' },
      { key: 'b', size: 2, preview: 'xx' },
    ]);
  });

  it('a throwing key does not break the listing', async () => {
    const store = fakeAsyncStorage({ good: 'ok', bad: 'x' });
    const adapter = asyncStorageAdapter(store);
    const originalGet = adapter.get.bind(adapter);
    adapter.get = (key) =>
      key === 'bad' ? Promise.reject(new Error('boom')) : originalGet(key);
    expect(await listEntries(adapter)).toEqual([
      { key: 'bad', size: 0, preview: '' },
      { key: 'good', size: 2, preview: 'ok' },
    ]);
  });
});

describe('formatStorageValue / formatSize', () => {
  it('pretty-prints JSON and passes anything else through', () => {
    expect(formatStorageValue('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(formatStorageValue('[1,2]')).toBe('[\n  1,\n  2\n]');
    expect(formatStorageValue('not json {')).toBe('not json {');
    expect(formatStorageValue('plain')).toBe('plain');
  });

  it('formats sizes with units', () => {
    expect(formatSize(12)).toBe('12 B');
    expect(formatSize(2048)).toBe('2.0 kB');
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('storage config on AppInspector', () => {
  afterEach(() => AppInspector.configure());

  it('derives a browsable store from an AsyncStorage-like `storage`', () => {
    const store = fakeAsyncStorage({ a: '1' });
    AppInspector.configure({ storage: store });
    const storages = AppInspector.getStorages();
    expect(storages).toHaveLength(1);
    expect(storages[0]!.name).toBe('AsyncStorage');
  });

  it('does not derive one from a minimal PersistenceAdapter', () => {
    AppInspector.configure({
      storage: {
        getItem: () => Promise.resolve(null),
        setItem: () => Promise.resolve(),
        removeItem: () => Promise.resolve(),
      },
    });
    expect(AppInspector.getStorages()).toEqual([]);
  });

  it('explicit `storages` wins over derivation', () => {
    const adapter = asyncStorageAdapter(fakeAsyncStorage(), 'Custom');
    AppInspector.configure({
      storage: fakeAsyncStorage(),
      storages: [adapter],
    });
    expect(AppInspector.getStorages()).toEqual([adapter]);
  });

  it('isAsyncStorageLike detects the getAllKeys surface', () => {
    expect(isAsyncStorageLike(fakeAsyncStorage())).toBe(true);
    expect(isAsyncStorageLike({ getItem: () => null })).toBe(false);
    expect(isAsyncStorageLike(null)).toBe(false);
  });
});
