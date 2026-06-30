import type { NetworkLogEntry } from '../../core/types';

export interface NetworkLoggerOptions {
  /** Called once per completed request (success or failure). */
  onEntry: (entry: NetworkLogEntry) => void;
}

interface XhrMeta {
  method: string;
  url: string;
  startedAt: number;
}

type PatchableXhr = XMLHttpRequest & { __inspector?: XhrMeta };

let seq = 0;
function nextId(): string {
  seq += 1;
  return `net_${Date.now()}_${seq}`;
}

/**
 * Captures outgoing network traffic by patching `XMLHttpRequest`.
 *
 * In React Native `fetch` is implemented on top of `XMLHttpRequest`, so
 * intercepting XHR alone captures both `fetch` and direct XHR calls without
 * double-counting. Patching is reversible via {@link stop}.
 */
export class NetworkLogger {
  private readonly onEntry: (entry: NetworkLogEntry) => void;
  private running = false;
  private originalOpen: XMLHttpRequest['open'] | null = null;
  private originalSend: XMLHttpRequest['send'] | null = null;

  constructor(options: NetworkLoggerOptions) {
    this.onEntry = options.onEntry;
  }

  /** Patch `XMLHttpRequest` and begin recording. Idempotent. */
  start(): void {
    if (this.running) {
      return;
    }
    const Xhr = (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest })
      .XMLHttpRequest;
    if (!Xhr) {
      return;
    }
    this.running = true;

    const proto = Xhr.prototype;
    const onEntry = this.onEntry;
    this.originalOpen = proto.open;
    this.originalSend = proto.send;
    const originalOpen = proto.open;
    const originalSend = proto.send;

    proto.open = function patchedOpen(
      this: PatchableXhr,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      this.__inspector = {
        method: (method || 'GET').toUpperCase(),
        url: String(url),
        startedAt: 0,
      };
      return Reflect.apply(originalOpen, this, [method, url, ...rest]);
    } as XMLHttpRequest['open'];

    proto.send = function patchedSend(this: PatchableXhr, body?: unknown) {
      const meta = this.__inspector;
      if (meta) {
        meta.startedAt = Date.now();
        this.addEventListener('loadend', () => {
          onEntry({
            id: nextId(),
            method: meta.method,
            url: meta.url,
            status: this.status || undefined,
            startedAt: meta.startedAt,
            durationMs: Date.now() - meta.startedAt,
          });
        });
      }
      return Reflect.apply(
        originalSend,
        this,
        body === undefined ? [] : [body],
      );
    } as XMLHttpRequest['send'];
  }

  /** Restore the original `XMLHttpRequest` methods. */
  stop(): void {
    if (!this.running) {
      return;
    }
    const Xhr = (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest })
      .XMLHttpRequest;
    if (Xhr && this.originalOpen && this.originalSend) {
      Xhr.prototype.open = this.originalOpen;
      Xhr.prototype.send = this.originalSend;
    }
    this.originalOpen = null;
    this.originalSend = null;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}
