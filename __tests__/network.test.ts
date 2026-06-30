import { NetworkLogger } from '../src/modules/network';
import type { NetworkLogEntry } from '../src/core/types';

/** Minimal XHR stand-in so the interceptor can be driven deterministically. */
class FakeXhr {
  status = 0;
  private listeners: Record<string, Array<() => void>> = {};
  open(_method: string, _url: string): void {}
  send(_body?: unknown): void {}
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
});
