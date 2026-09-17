export const REDACTED = '[redacted]';
export const TRUNCATED_SUFFIX = '…[truncated]';
export const DEFAULT_MAX_BODY_BYTES = 32 * 1024;

/** Matched as a substring, so `access_token` is caught by `token`. */
const SECRET_KEY_PATTERNS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'credential',
  'session',
  'cookie',
  'signature',
  'privatekey',
  'private_key',
  'refresh',
  'otp',
  'pin',
  'cvv',
  'cardnumber',
  'card_number',
];

/** Matched whole, so `keyword` isn't caught by `key`. */
const SECRET_QUERY_PATTERNS = [
  'token',
  'access_token',
  'refresh_token',
  'apikey',
  'api_key',
  'key',
  'password',
  'secret',
  'signature',
  'sig',
  'auth',
];

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, '');
}

export function isSecretKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SECRET_KEY_PATTERNS.some((pattern) =>
    normalized.includes(normalizeKey(pattern)),
  );
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
      const normalized = normalizeKey(decodeURIComponent(name));
      const secret = SECRET_QUERY_PATTERNS.some(
        (pattern) => normalized === normalizeKey(pattern),
      );
      return secret ? `${name}=${REDACTED}` : pair;
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
      return isSecretKey(decodeURIComponent(name))
        ? `${name}=${REDACTED}`
        : pair;
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
