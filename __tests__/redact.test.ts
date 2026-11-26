import {
  isSecretKey,
  redactHeaders,
  redactUrl,
  redactValue,
  sanitizeBody,
  REDACTED,
  TRUNCATED_SUFFIX,
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
    'Access-Control-Allow-Credentials',
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

describe('redactHeaders', () => {
  it('redacts secret query parameters in URL-valued headers', () => {
    expect(
      redactHeaders({
        location: 'https://api.example.com/posts?api_key=SECRET&q=1/101',
        'Content-Location': '/v1/items?token=abc&page=2',
        Referer: 'https://app.example.com/cb?code=1&access_token=zzz#frag',
        Link: '<https://api.example.com/next?page=2>; rel="next"',
      }),
    ).toEqual({
      location: 'https://api.example.com/posts?api_key=[redacted]&q=1/101',
      'Content-Location': '/v1/items?token=[redacted]&page=2',
      Referer: 'https://app.example.com/cb?code=1&access_token=[redacted]#frag',
      Link: '<https://api.example.com/next?page=2>; rel="next"',
    });
  });

  it('redacts auth-bearing headers and keeps the rest', () => {
    expect(
      redactHeaders({
        Authorization: 'Bearer x',
        Cookie: 'a=1',
        'Set-Cookie': 'b=2',
        'Proxy-Authorization': 'Basic y',
        'x-api-key': 'k',
        'Content-Type': 'application/json',
        'X-Request-Id': 'r',
      }),
    ).toEqual({
      Authorization: REDACTED,
      Cookie: REDACTED,
      'Set-Cookie': REDACTED,
      'Proxy-Authorization': REDACTED,
      'x-api-key': REDACTED,
      'Content-Type': 'application/json',
      'X-Request-Id': 'r',
    });
  });

  it('returns undefined for missing or empty headers', () => {
    expect(redactHeaders(undefined)).toBeUndefined();
    expect(redactHeaders({})).toBeUndefined();
  });
});

describe('redact edge cases', () => {
  it('marks circular references instead of recursing forever', () => {
    const value: Record<string, unknown> = { name: 'a' };
    value.self = value;
    expect(redactValue(value)).toEqual({ name: 'a', self: '[circular]' });
  });

  it('stringifies class instances instead of walking them', () => {
    const when = new Date(0);
    expect(redactValue({ when })).toEqual({ when: String(when) });
  });

  it('replaces binary bodies with a type marker', () => {
    expect(sanitizeBody(new ArrayBuffer(8))).toBe('[ArrayBuffer]');
    expect(sanitizeBody(new Uint8Array(4))).toBe('[Uint8Array]');
  });

  it('falls back to a truncated string when a body cannot be serialized', () => {
    const body = { big: BigInt(1) };
    expect(typeof sanitizeBody(body, 64)).toBe('string');
  });

  it('caps oversized structured bodies', () => {
    const out = sanitizeBody({ data: 'x'.repeat(500) }, 100);
    expect(typeof out).toBe('string');
    expect(String(out).endsWith(TRUNCATED_SUFFIX)).toBe(true);
  });
});
