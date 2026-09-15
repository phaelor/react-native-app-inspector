import type { NetworkLogEntry } from '../../core/types';
import { DEFAULT_MAX_BODY_BYTES, redactUrl, sanitizeBody } from './redact';

export interface NetworkLoggerOptions {
  /** Called once per completed request (success or failure). */
  onEntry: (entry: NetworkLogEntry) => void;
  onLateBody?: (id: string, responseBody: unknown) => void;
  captureBodies?: boolean;
  maxBodyBytes?: number;
}

interface XhrMeta {
  method: string;
  url: string;
  startedAt: number;
  requestBody?: unknown;
}

/** A blob body, readable only asynchronously via FileReader. */
interface PendingBlob {
  blob: unknown;
}

/**
 * Guards the `responseType` values whose `responseText` getter throws. RN's
 * `fetch` asks for a blob, so `_response` is a blob handle, not text — those
 * are returned as {@link PendingBlob} for the caller to decode off the hot path.
 */
function readResponseBody(xhr: XMLHttpRequest): unknown | PendingBlob {
  const type = xhr.responseType;
  if (type === 'blob') {
    try {
      const blob = xhr.response as unknown;
      return blob ? { blob } : undefined;
    } catch {
      return '[blob]';
    }
  }
  if (type === 'arraybuffer') {
    return '[arraybuffer]';
  }
  try {
    return type === 'json' ? xhr.response : xhr.responseText;
  } catch {
    return undefined;
  }
}

function isPendingBlob(value: unknown): value is PendingBlob {
  return typeof value === 'object' && value !== null && 'blob' in value;
}

function readBlobText(blob: unknown, onText: (text: string) => void): void {
  const Reader = (globalThis as { FileReader?: typeof FileReader }).FileReader;
  if (!Reader) {
    return;
  }
  try {
    const reader = new Reader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onText(reader.result);
      }
    };
    reader.readAsText(blob as Blob);
  } catch {
    /* body inspection is best-effort */
  }
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
  private readonly onLateBody?: (id: string, responseBody: unknown) => void;
  private readonly captureBodies: boolean;
  private readonly maxBodyBytes: number;
  private running = false;
  private originalOpen: XMLHttpRequest['open'] | null = null;
  private originalSend: XMLHttpRequest['send'] | null = null;

  constructor(options: NetworkLoggerOptions) {
    this.onEntry = options.onEntry;
    this.onLateBody = options.onLateBody;
    this.captureBodies = options.captureBodies ?? true;
    this.maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
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
    const onLateBody = this.onLateBody;
    const captureBodies = this.captureBodies;
    const maxBodyBytes = this.maxBodyBytes;
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
        url: redactUrl(String(url)),
        startedAt: 0,
      };
      return Reflect.apply(originalOpen, this, [method, url, ...rest]);
    } as XMLHttpRequest['open'];

    proto.send = function patchedSend(this: PatchableXhr, body?: unknown) {
      const meta = this.__inspector;
      if (meta) {
        meta.startedAt = Date.now();
        if (captureBodies) {
          meta.requestBody = sanitizeBody(body, maxBodyBytes);
        }
        this.addEventListener('loadend', () => {
          const id = nextId();
          const raw = captureBodies ? readResponseBody(this) : undefined;
          const pending = isPendingBlob(raw);

          onEntry({
            id,
            method: meta.method,
            url: meta.url,
            status: this.status || undefined,
            startedAt: meta.startedAt,
            durationMs: Date.now() - meta.startedAt,
            requestBody: meta.requestBody,
            responseBody: pending ? undefined : sanitizeBody(raw, maxBodyBytes),
          });

          if (pending && onLateBody) {
            readBlobText(raw.blob, (text) =>
              onLateBody(id, sanitizeBody(text, maxBodyBytes)),
            );
          }
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
