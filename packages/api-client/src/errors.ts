/**
 * Platform-neutral HTTP policy. Callers localize these stable categories;
 * untrusted server response bodies must not be displayed directly to users.
 */
export type ApiFailureKind =
  | 'network'
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'throttled'
  | 'server'
  | 'unknown';

export function classifyHttpFailure(status: number | null): ApiFailureKind {
  if (status === null) return 'network';
  if (!Number.isInteger(status) || status < 100 || status > 599) return 'unknown';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'throttled';
  if (status >= 500 && status < 600) return 'server';
  return 'unknown';
}

/**
 * Retry-After may be a number of seconds or an HTTP-date.
 * Bound durations to one day so malformed/untrusted headers cannot block UI forever.
 * Invalid and negative values are ignored. This does not automatically retry requests.
 */
export function parseRetryAfterSeconds(header: string | null, nowMs = Date.now()): number | null {
  if (!header || header.length > 128 || !Number.isFinite(nowMs)) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds) ? Math.min(seconds, 86_400) : null;
  }
  // Date.parse accepts ambiguous values such as '1' or ISO timestamps that are not
  // HTTP-date field values. Accept only the IMF-fixdate form emitted by HTTP servers.
  if (
    !/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
      trimmed,
    )
  ) {
    return null;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isFinite(dateMs) || new Date(dateMs).toUTCString() !== trimmed || dateMs <= nowMs)
    return null;
  return Math.min(Math.ceil((dateMs - nowMs) / 1000), 86_400);
}
