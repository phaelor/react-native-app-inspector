import { NetworkLogger } from '../src/modules/network';
import type { NetworkLogEntry } from '../src/core/types';

/** Minimal XHR stand-in so the interceptor can be driven deterministically. */
class FakeXhr {
  status = 0;
  responseHeaders = '';
  private listeners: Record<string, Array<() => void>> = {};
  open(_method: string, _url: string): void {}
  send(_body?: unknown): void {}
  setRequestHeader(_name: string, _value: string): void {}
  getAllResponseHeaders(): string {
    return this.responseHeaders;
  }
  addEventListener(type: string, cb: () => void): void {
    (this.listeners[type] ??= []).push(cb);
  }
  finish(status: number): void {
    this.status = status;
    (this.listeners.loadend ?? []).forEach((cb) => cb());
  }
}

describe('NetworkLogger (XHR interceptor)', () => {
  const g = globalThis as { XMLHttpRequest?: unknown };
  let original: unknown;

  beforeEach(() => {
    original = g.XMLHttpRequest;
    g.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  });
  afterEach(() => {
    g.XMLHttpRequest = original as typeof XMLHttpRequest;
  });

  it('records a completed request', () => {
    const entries: NetworkLogEntry[] = [];
    const logger = new NetworkLogger({ onEntry: (e) => entries.push(e) });
    logger.start();

    const xhr = new FakeXhr();
    xhr.open('get', 'https://api.example.com/users?page=1');
    xhr.send();
    xhr.finish(200);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      method: 'GET',
      status: 200,
      url: 'https://api.example.com/users?page=1',
    });
    expect(entries[0]?.durationMs).toBeGreaterThanOrEqual(0);

    logger.stop();
  });

  it('restores the original methods on stop', () => {
    const pristine = FakeXhr.prototype.send;
    const logger = new NetworkLogger({ onEntry: () => {} });

    logger.start();
    expect(FakeXhr.prototype.send).not.toBe(pristine);

    logger.stop();
    expect(FakeXhr.prototype.send).toBe(pristine);
  });

  it('does not record after stop', () => {
    const entries: NetworkLogEntry[] = [];
    const logger = new NetworkLogger({ onEntry: (e) => entries.push(e) });
    logger.start();
    logger.stop();

    const xhr = new FakeXhr();
    xhr.open('GET', 'https://api.example.com/ping');
    xhr.send();
    xhr.finish(200);

    expect(entries).toHaveLength(0);
  });

  it('captures request and response headers with secrets redacted', () => {
    const entries: NetworkLogEntry[] = [];
    const logger = new NetworkLogger({ onEntry: (e) => entries.push(e) });
    logger.start();

    const xhr = new FakeXhr();
    xhr.open('POST', 'https://api.example.com/orders');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer abc');
    xhr.setRequestHeader('X-Api-Key', 'k');
    xhr.responseHeaders =
      'content-type: application/json\r\nset-cookie: a=1\r\nset-cookie: b=2\r\nx-request-id: r1\r\n';
    xhr.send('{}');
    xhr.finish(201);

    expect(entries[0]?.requestHeaders).toEqual({
      'Content-Type': 'application/json',
      Authorization: '[redacted]',
      'X-Api-Key': '[redacted]',
    });
    expect(entries[0]?.responseHeaders).toEqual({
      'content-type': 'application/json',
      'set-cookie': '[redacted]',
      'x-request-id': 'r1',
    });

    logger.stop();
    expect(FakeXhr.prototype.setRequestHeader.name).toBe('setRequestHeader');
  });

  it('skips headers when captureHeaders is false', () => {
    const entries: NetworkLogEntry[] = [];
    const logger = new NetworkLogger({
      onEntry: (e) => entries.push(e),
      captureHeaders: false,
    });
    logger.start();

    const xhr = new FakeXhr();
    xhr.open('GET', 'https://api.example.com/me');
    xhr.setRequestHeader('Authorization', 'Bearer abc');
    xhr.responseHeaders = 'content-type: application/json\r\n';
    xhr.send();
    xhr.finish(200);

    expect(entries[0]?.requestHeaders).toBeUndefined();
    expect(entries[0]?.responseHeaders).toBeUndefined();
    logger.stop();
  });
});
