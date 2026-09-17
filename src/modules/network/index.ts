import type { NetworkLogEntry } from '../../core/types';
import {
  DEFAULT_MAX_BODY_BYTES,
  redactHeaders,
  redactUrl,
  sanitizeBody,
} from './redact';

export interface NetworkLoggerOptions {
  /** Called once per completed request (success or failure). */
  onEntry: (entry: NetworkLogEntry) => void;
  onLateBody?: (id: string, responseBody: unknown) => void;
  captureBodies?: boolean;
  maxBodyBytes?: number;
  captureHeaders?: boolean;
}

interface XhrMeta {
  method: string;
  url: string;
  startedAt: number;
  requestBody?: unknown;
  requestHeaders?: Record<string, string>;
}

/** `getAllResponseHeaders()` → object; repeated names are comma-joined. */
function parseResponseHeaders(raw: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of (raw ?? '').split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon <= 0) {
      continue;
    }
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    headers[name] = name in headers ? `${headers[name]}, ${value}` : value;
  }
  return headers;
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

function readResponseHeaders(xhr: XMLHttpRequest): Record<string, string> {
  try {
    return parseResponseHeaders(xhr.getAllResponseHeaders());
  } catch {
    return {};
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
  private readonly captureHeaders: boolean;
  private running = false;
  private originalOpen: XMLHttpRequest['open'] | null = null;
  private originalSend: XMLHttpRequest['send'] | null = null;
  private originalSetRequestHeader: XMLHttpRequest['setRequestHeader'] | null =
    null;

  constructor(options: NetworkLoggerOptions) {
    this.onEntry = options.onEntry;
    this.onLateBody = options.onLateBody;
    this.captureBodies = options.captureBodies ?? true;
    this.maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    this.captureHeaders = options.captureHeaders ?? true;
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
    const captureHeaders = this.captureHeaders;
    this.originalOpen = proto.open;
    this.originalSend = proto.send;
    this.originalSetRequestHeader = proto.setRequestHeader;
    const originalOpen = proto.open;
    const originalSend = proto.send;
    const originalSetRequestHeader = proto.setRequestHeader;

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

    if (captureHeaders && typeof originalSetRequestHeader === 'function') {
      proto.setRequestHeader = function patchedSetRequestHeader(
        this: PatchableXhr,
        name: string,
        value: string,
      ) {
        const meta = this.__inspector;
        if (meta) {
          const headers = meta.requestHeaders ?? {};
          headers[name] =
            name in headers ? `${headers[name]}, ${value}` : value;
          meta.requestHeaders = headers;
        }
        return Reflect.apply(originalSetRequestHeader, this, [name, value]);
      } as XMLHttpRequest['setRequestHeader'];
    } else {
      this.originalSetRequestHeader = null;
    }

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
            requestHeaders: captureHeaders
              ? redactHeaders(meta.requestHeaders)
              : undefined,
            responseHeaders: captureHeaders
              ? redactHeaders(readResponseHeaders(this))
              : undefined,
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
      if (this.originalSetRequestHeader) {
        Xhr.prototype.setRequestHeader = this.originalSetRequestHeader;
      }
    }
    this.originalOpen = null;
    this.originalSend = null;
    this.originalSetRequestHeader = null;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}
