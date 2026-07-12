import type { StorageInspectorAdapter } from '../../core/types';

export type { StorageInspectorAdapter };

/**
 * Structural AsyncStorage — matches `@react-native-async-storage/async-storage`
 * and anything with the same surface, so the library stays dependency-free.
 */
export interface AsyncStorageLike {
  getAllKeys(): Promise<readonly string[]>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear?(): Promise<void>;
}

/** Structural `react-native-mmkv` instance (v2+: getters return undefined). */
export interface MmkvLike {
  getAllKeys(): string[];
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: string | number | boolean): void;
  delete(key: string): void;
  clearAll?(): void;
}

export function isAsyncStorageLike(value: unknown): value is AsyncStorageLike {
  const store = value as AsyncStorageLike | null;
  return (
    typeof store === 'object' &&
    store !== null &&
    typeof store.getAllKeys === 'function' &&
    typeof store.getItem === 'function' &&
    typeof store.setItem === 'function' &&
    typeof store.removeItem === 'function'
  );
}

export function asyncStorageAdapter(
  storage: AsyncStorageLike,
  name = 'AsyncStorage',
): StorageInspectorAdapter {
  return {
    name,
    getAllKeys: async () => [...(await storage.getAllKeys())],
    get: (key) => storage.getItem(key),
    set: (key, value) => storage.setItem(key, value),
    remove: (key) => storage.removeItem(key),
    ...(storage.clear ? { clear: () => storage.clear!() } : {}),
  };
}

export function mmkvAdapter(
  storage: MmkvLike,
  name = 'MMKV',
): StorageInspectorAdapter {
  const read = (key: string): string | null => {
    const str = storage.getString(key);
    if (str !== undefined && str !== '') {
      return str;
    }
    const num = storage.getNumber(key);
    if (num !== undefined) {
      return String(num);
    }
    if (str !== undefined) {
      return str;
    }
    const bool = storage.getBoolean(key);
    if (bool !== undefined) {
      return String(bool);
    }
    return null;
  };

  const isNumberKey = (key: string): boolean => {
    const str = storage.getString(key);
    return (
      (str === undefined || str === '') && storage.getNumber(key) !== undefined
    );
  };

  const isBooleanKey = (key: string): boolean =>
    storage.getString(key) === undefined &&
    storage.getNumber(key) === undefined &&
    storage.getBoolean(key) !== undefined;

  return {
    name,
    getAllKeys: () => Promise.resolve([...storage.getAllKeys()]),
    get: (key) => Promise.resolve(read(key)),
    set: (key, value) => {
      // Preserve the entry's MMKV type: editing "42" on a number key stays a
      // number, "true"/"false" on a boolean key stays a boolean.
      if (isNumberKey(key) && value.trim() !== '') {
        const num = Number(value);
        if (Number.isFinite(num)) {
          storage.set(key, num);
          return Promise.resolve();
        }
      }
      if (isBooleanKey(key) && (value === 'true' || value === 'false')) {
        storage.set(key, value === 'true');
        return Promise.resolve();
      }
      storage.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      storage.delete(key);
      return Promise.resolve();
    },
    ...(storage.clearAll
      ? {
          clear: () => {
            storage.clearAll!();
            return Promise.resolve();
          },
        }
      : {}),
  };
}

export interface StorageEntrySummary {
  key: string;
  /** Value length in UTF-16 code units (≈ bytes for ASCII payloads). */
  size: number;
  /** First line of the value, whitespace-collapsed, for the key list. */
  preview: string;
}

const PREVIEW_LENGTH = 80;

/** All entries of a store, sorted by key. Unreadable values count as empty. */
export async function listEntries(
  adapter: StorageInspectorAdapter,
): Promise<StorageEntrySummary[]> {
  const keys = await adapter.getAllKeys();
  const entries = await Promise.all(
    keys.map(async (key) => {
      let value: string | null = null;
      try {
        value = await adapter.get(key);
      } catch {
        /* a single bad key must not break the listing */
      }
      const preview = (value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, PREVIEW_LENGTH);
      return { key, size: value?.length ?? 0, preview };
    }),
  );
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

/** Pretty-print JSON payloads; anything else passes through untouched. */
export function formatStorageValue(raw: string): string {
  const text = raw.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) {
    return raw;
  }
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return raw;
  }
}

export function formatSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} kB`;
  }
  return `${size} B`;
}
