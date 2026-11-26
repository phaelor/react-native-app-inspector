import { AppInspector } from '../src/core';
import { ActionLogger } from '../src/modules/actions';
import { REDACTED } from '../src/modules/network/redact';
import type { ActionLogEntry } from '../src/core/types';

describe('ActionLogger', () => {
  it('redacts secret keys in a logged payload', () => {
    const entries: ActionLogEntry[] = [];
    const logger = new ActionLogger({ onEntry: (e) => entries.push(e) });

    logger.log('LOGIN_SUCCESS', { user: { id: 7, token: 'abc' }, ok: true });

    expect(entries[0]?.payload).toEqual({
      user: { id: 7, token: REDACTED },
      ok: true,
    });
  });

  it('redacts dispatched Redux actions and still passes the original on', () => {
    const entries: ActionLogEntry[] = [];
    const logger = new ActionLogger({ onEntry: (e) => entries.push(e) });
    const next = jest.fn((action: unknown) => action);
    const action = { type: 'auth/set', refreshToken: 'r1', userId: 3 };

    logger.middleware()(null)(next)(action);

    expect(entries[0]?.payload).toEqual({
      type: 'auth/set',
      refreshToken: REDACTED,
      userId: 3,
    });
    expect(next).toHaveBeenCalledWith(action);
    expect(action.refreshToken).toBe('r1');
  });
});

describe('AppInspector action/error data', () => {
  beforeEach(() => {
    AppInspector.configure();
    AppInspector.stop();
    AppInspector.clear();
    AppInspector.start();
  });

  afterEach(() => {
    AppInspector.stop();
  });

  it('redacts Redux payloads on the timeline and in the action log', () => {
    AppInspector.getActionLogger().middleware()(null)((a: unknown) => a)({
      type: 'login',
      password: 'p',
    });

    const snapshot = AppInspector.getSnapshot();
    const event = snapshot.timeline.find((e) => e.type === 'action');
    expect(JSON.stringify(event)).not.toContain('"p"');
    expect(snapshot.actions[0]?.payload).toEqual({
      type: 'login',
      password: REDACTED,
    });
  });

  it('redacts data passed to trackAction and trackError', () => {
    AppInspector.trackAction('checkout', { cardNumber: '4111', total: 9 });
    AppInspector.trackError('auth failed', { apiKey: 'k', status: 401 });

    const snapshot = AppInspector.getSnapshot();
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('4111');
    expect(serialized).not.toContain('"k"');
    expect(snapshot.actions[0]?.payload).toEqual({
      cardNumber: REDACTED,
      total: 9,
    });
  });
});
