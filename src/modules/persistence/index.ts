import type { PersistenceAdapter } from '../../core/types';

export type { PersistenceAdapter };

/** A persisted session payload (the timeline export plus when it was saved). */
export interface PersistedSession {
  savedAt: number;
  session: string;
  startedAt: number;
  events: unknown[];
}

const KEY = '@app-inspector/last-session';

/**
 * Persists the last inspector session so it can be inspected after a crash or
 * a relaunch. Saving is best-effort and never throws into the caller.
 */
export class SessionPersistence {
  private readonly adapter: PersistenceAdapter;
  private readonly key: string;

  constructor(adapter: PersistenceAdapter, key: string = KEY) {
    this.adapter = adapter;
    this.key = key;
  }

  /** Load the previously saved session, or `null` if none / unreadable. */
  async loadPrevious(): Promise<PersistedSession | null> {
    try {
      const raw = await this.adapter.getItem(this.key);
      return raw ? (JSON.parse(raw) as PersistedSession) : null;
    } catch {
      return null;
    }
  }

  /** Save a session export. Best-effort; failures are swallowed. */
  async save(data: {
    session: string;
    startedAt: number;
    events: unknown[];
  }): Promise<void> {
    try {
      const payload: PersistedSession = { ...data, savedAt: Date.now() };
      await this.adapter.setItem(this.key, JSON.stringify(payload));
    } catch {
      /* persistence is best-effort */
    }
  }

  /** Remove any saved session. */
  async clear(): Promise<void> {
    try {
      await this.adapter.removeItem(this.key);
    } catch {
      /* best-effort */
    }
  }
}
