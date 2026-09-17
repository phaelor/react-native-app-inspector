export const REDACTED = '[redacted]';
export const TRUNCATED_SUFFIX = '…[truncated]';
export const DEFAULT_MAX_BODY_BYTES = 32 * 1024;

/**
 * Exact (normalised) key names that always hold a secret. Substring matching
 * was tried first and over-redacted: `pin` hit `shipping`, `auth` hit
 * `author`, `refresh` hit `refreshedAt`.
 */
const SECRET_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'authorization',
  'proxyauthorization',
  'auth',
  'credential',
  'credentials',
  'sessionid',
  'sessiontoken',
  'cookie',
  'setcookie',
  'signature',
  'privatekey',
  'clientsecret',
  'csrf',
  'csrftoken',
  'xsrf',
  'xsrftoken',
  'otp',
  'cvv',
  'cvc',
  'cardnumber',
  'pan',
  'pin',
  'pincode',
]);

/**
 * Compound names ending in one of these are secrets too (`userPassword`,
 * `x-api-key`, `authToken`), while `tokenExpiry` or `passwordRules` are not.
 * `credentials` is deliberately exact-only: `Access-Control-Allow-Credentials`
 * is a plain CORS header.
 */
const SECRET_SUFFIXES = [
  'password',
  'secret',
  'token',
  'apikey',
  'cookie',
  'signature',
  'privatekey',
];

/** Extra names that only mean a secret in a query string (`?key=`, `?sig=`). */
const SECRET_QUERY_KEYS = new Set(['key', 'sig']);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_\s.]/g, '');
}

export function isSecretKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return (
    SECRET_KEYS.has(normalized) ||
    SECRET_SUFFIXES.some(
      (suffix) =>
        normalized.length > suffix.length && normalized.endsWith(suffix),
    )
  );
}

function isSecretQueryKey(key: string): boolean {
  return SECRET_QUERY_KEYS.has(normalizeKey(key)) || isSecretKey(key);
}

/** Deep-copy `value`, replacing secret keys' values with {@link REDACTED}. */
export function redactValue(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  // Error, Date, Map, class instances: no key/value shape worth redacting.
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) {
    return String(value);
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = isSecretKey(key) ? REDACTED : redactValue(item, seen);
  }
  return out;
}

/** Copy of `headers` with secret values replaced; `undefined` when empty. */
export function redactHeaders(
  headers: Record<string, unknown> | null | undefined,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || value === null) {
      continue;
    }
    out[name] = isSecretKey(name) ? REDACTED : String(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A malformed escape (`%E0%A4%A`) must not throw out of the capture path. */
function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function redactUrl(url: string): string {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) {
    return url;
  }
  const base = url.slice(0, queryStart);
  // Split the fragment off so it is never treated as part of a value.
  const rest = url.slice(queryStart + 1);
  const hashStart = rest.indexOf('#');
  const query = hashStart === -1 ? rest : rest.slice(0, hashStart);
  const fragment = hashStart === -1 ? '' : rest.slice(hashStart);

  const redacted = query
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq === -1) {
        return pair;
      }
      const name = pair.slice(0, eq);
      return isSecretQueryKey(safeDecode(name)) ? `${name}=${REDACTED}` : pair;
    })
    .join('&');

  return `${base}?${redacted}${fragment}`;
}

export function truncate(text: string, maxBytes: number): string {
  if (text.length <= maxBytes) {
    return text;
  }
  return text.slice(0, maxBytes) + TRUNCATED_SUFFIX;
}

/** Redact per field, keeping the body readable as what went over the wire. */
function redactFormBody(text: string): string {
  return text
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq === -1) {
        return pair;
      }
      const name = pair.slice(0, eq);
      return isSecretKey(safeDecode(name)) ? `${name}=${REDACTED}` : pair;
    })
    .join('&');
}

const FORM_BODY = /^[^\s{[]+=[^\s]*$/;

/** Redact and size-cap one captured body. Empty bodies yield `undefined`. */
export function sanitizeBody(
  body: unknown,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): unknown {
  if (body === undefined || body === null || body === '') {
    return undefined;
  }

  if (typeof body === 'object') {
    const name = (body as object).constructor?.name;
    if (
      name === 'Blob' ||
      name === 'FormData' ||
      name === 'ArrayBuffer' ||
      ArrayBuffer.isView(body as ArrayBufferView)
    ) {
      return `[${name ?? 'binary'}]`;
    }
    return capStructured(redactValue(body), maxBytes);
  }

  if (typeof body !== 'string') {
    return body;
  }

  const text = body.trim();
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return capStructured(redactValue(JSON.parse(text)), maxBytes);
    } catch {
      // Not JSON after all — fall through to the raw-string path.
    }
  }
  if (FORM_BODY.test(text)) {
    return truncate(redactFormBody(body), maxBytes);
  }
  return truncate(body, maxBytes);
}

/** Past the cap, degrade to a truncated string so one body can't pin MBs. */
function capStructured(value: unknown, maxBytes: number): unknown {
  let serialized: string;
  try {
    serialized = JSON.stringify(value) ?? '';
  } catch {
    return truncate(String(value), maxBytes);
  }
  return serialized.length <= maxBytes ? value : truncate(serialized, maxBytes);
}
