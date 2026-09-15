import {
  isSecretKey,
  redactUrl,
  redactValue,
  sanitizeBody,
  REDACTED,
} from '../src/modules/network/redact';

describe('isSecretKey', () => {
  it.each([
    'password',
    'Password',
    'user_password',
    'userPassword',
    'access_token',
    'authToken',
    'x-api-key',
    'X-API-Key',
    'Authorization',
    'Proxy-Authorization',
    'Cookie',
    'Set-Cookie',
    'client_secret',
    'refreshToken',
    'session_id',
    'otp',
    'cvv',
    'pin',
    'cardNumber',
  ])('redacts %s', (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each([
    'author',
    'authorId',
    'shipping',
    'shippingAddress',
    'refreshedAt',
    'sessionCount',
    'tokenExpiry',
    'passwordRules',
    'pinned',
    'spinner',
    'keyword',
    'name',
    'email',
    'expiresIn',
  ])('keeps %s', (key) => {
    expect(isSecretKey(key)).toBe(false);
  });
});

describe('redactValue', () => {
  it('redacts nested secrets and keeps the rest', () => {
    expect(
      redactValue({
        user: { name: 'bob', password: 'x', profile: { authorId: 7 } },
        tokens: [{ accessToken: 'a' }, { refreshToken: 'b' }],
      }),
    ).toEqual({
      user: { name: 'bob', password: REDACTED, profile: { authorId: 7 } },
      tokens: [{ accessToken: REDACTED }, { refreshToken: REDACTED }],
    });
  });
});

describe('redactUrl', () => {
  it('redacts secret query params only', () => {
    expect(
      redactUrl(
        'https://a.com/p?key=1&keyword=2&sig=3&access_token=4&page=5#f',
      ),
    ).toBe(
      `https://a.com/p?key=${REDACTED}&keyword=2&sig=${REDACTED}&access_token=${REDACTED}&page=5#f`,
    );
  });

  it('survives malformed percent escapes', () => {
    expect(redactUrl('https://a.com/p?q=%E0%A4%A&token=t')).toBe(
      `https://a.com/p?q=%E0%A4%A&token=${REDACTED}`,
    );
  });
});

describe('sanitizeBody', () => {
  it('redacts form-encoded bodies per field', () => {
    expect(sanitizeBody('user=bob&password=x&shipping=fast')).toBe(
      `user=bob&password=${REDACTED}&shipping=fast`,
    );
  });
});
