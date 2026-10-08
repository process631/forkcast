/* Small fetch helpers with a timeout, one retry and messages people can act on. */

const TIMEOUT_MS = 12_000;
const RETRY_DELAY_MS = 600;

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** An error whose message is safe to show to people as-is. */
export class NetworkError extends Error {
  constructor(message: string, readonly kind: 'offline' | 'timeout' | 'http' | 'network' | 'bad-data') {
    super(message);
    this.name = 'NetworkError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce<T>(url: string, source: string, timeoutMs: number): Promise<T> {
  if (isOffline()) throw new NetworkError('You seem to be offline. Check your internet connection and try again.', 'offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch {
    if (ctrl.signal.aborted) throw new NetworkError(`${source} took too long to answer. Try again in a moment.`, 'timeout');
    if (isOffline()) throw new NetworkError('You seem to be offline. Check your internet connection and try again.', 'offline');
    throw new NetworkError(`Couldn’t reach ${source}. Check your internet connection and try again.`, 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new NetworkError(`${source} is having trouble right now (error ${res.status}). Try again later.`, 'http');
  try {
    return (await res.json()) as T;
  } catch {
    throw new NetworkError(`${source} sent back something unexpected. Try again later.`, 'bad-data');
  }
}

/**
 * GET a JSON document. Timeouts, network errors and 5xx/429 answers are retried once;
 * being offline or a 4xx answer fails right away.
 */
export async function fetchJson<T>(url: string, source: string, { timeoutMs = TIMEOUT_MS, retries = 1 } = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchOnce<T>(url, source, timeoutMs);
    } catch (e) {
      const err = e as NetworkError;
      const retryable = err.kind === 'timeout' || err.kind === 'network' || (err.kind === 'http' && /error (5\d\d|429)/.test(err.message));
      if (!retryable || attempt >= retries) throw err;
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
}

/** Fetch `search.php?f=a…z` from a TheMealDB-style API and pool the results. */
export async function fetchByLetter<Raw>(fetchPage: (letter: string) => Promise<Raw[] | null>): Promise<{ items: Raw[]; failed: number; error?: unknown }> {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const results = await Promise.allSettled(letters.map(fetchPage));
  const items = results.flatMap((r) => (r.status === 'fulfilled' && r.value ? r.value : []));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  return { items, failed: failures.length, error: failures[0]?.reason };
}
