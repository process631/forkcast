import type { LibraryItem } from './item';
import { dummyjsonSource } from './dummyjson';
import { mealdbSource } from './mealdb';
import { NetworkError, isOffline } from './net';
import { idbGet, idbSet } from './storage';
import type { Recipe } from './types';

/**
 * The recipe library: every source's catalog, downloaded once and cached for a week.
 *
 * Failure rules for each source:
 * - a fresh cache is used without touching the network
 * - a partial download (some requests failed) is used but never cached
 * - if the download fails badly, a stale cache is better than nothing
 * - only when every source has nothing does loading fail
 */

const CACHE_DAYS = 7;

export interface FetchResult<Raw> {
  items: Raw[];
  /** How many of the source's requests failed. */
  failed: number;
  /** The first error, kept so the message can be shown if nothing loaded. */
  error?: unknown;
}

export interface Source<Raw> {
  /** Shown to people, e.g. "TheMealDB". */
  name: string;
  /** Recipe ids from this source start with this, e.g. "mdb-". */
  prefix: string;
  cacheKey: string;
  fetchAll(): Promise<FetchResult<Raw>>;
  normalize(raw: Raw): LibraryItem;
  /** More failed requests than this and a stale cache wins over the partial download. */
  maxFailures?: number;
  /** Fetch one recipe by its source id (without the prefix), for recipes newer than the cache. */
  lookup?(id: string): Promise<Raw | undefined>;
}

export interface LibraryStatus {
  /** Sources that couldn't load at all. */
  missing: string[];
  /** Sources where only part of the catalog came through. */
  partial: string[];
  /** Sources served from an out-of-date cache because the network failed. */
  stale: string[];
  offline: boolean;
}

const EMPTY_STATUS: LibraryStatus = { missing: [], partial: [], stale: [], offline: false };
let status: LibraryStatus = EMPTY_STATUS;

/** What went wrong (if anything) during the last library load. */
export function libraryStatus(): LibraryStatus {
  return status;
}

/** A one-line, human explanation of `libraryStatus()`, or '' when everything loaded. */
export function describeStatus(s: LibraryStatus = status): string {
  const parts: string[] = [];
  if (s.missing.length) parts.push(`${s.missing.join(' and ')} couldn’t be reached`);
  if (s.partial.length) parts.push(`only part of ${s.partial.join(' and ')} loaded`);
  if (s.stale.length) parts.push(`${s.stale.join(' and ')} ${s.stale.length > 1 ? 'are' : 'is'} from an older saved copy`);
  if (!parts.length) return '';
  const msg = parts.join('; ');
  return `${msg[0].toUpperCase()}${msg.slice(1)}${s.offline ? ' (you seem to be offline)' : ''}, so you’re seeing fewer recipes than usual.`;
}

type SourceResult = { items: LibraryItem[]; missing?: boolean; partial?: boolean; stale?: boolean; error?: unknown };

async function loadSource<Raw>(src: Source<Raw>): Promise<SourceResult> {
  const cached = await idbGet<{ at: number; items: Raw[] }>(src.cacheKey);
  const fresh = cached && Date.now() - cached.at < CACHE_DAYS * 86400_000;
  if (cached && fresh) return { items: cached.items.map(src.normalize) };

  let got: FetchResult<Raw>;
  try {
    got = await src.fetchAll();
  } catch (error) {
    got = { items: [], failed: Infinity, error };
  }
  if (got.items.length === 0 || got.failed > (src.maxFailures ?? 0)) {
    if (cached) return { items: cached.items.map(src.normalize), stale: true };
    if (got.items.length === 0) return { items: [], missing: true, error: got.error };
  }
  if (got.failed === 0) await idbSet(src.cacheKey, { at: Date.now(), items: got.items });
  return { items: got.items.map(src.normalize), partial: got.failed > 0 };
}

/** Every recipe source, in the order their recipes are listed. */
const SOURCES = [mealdbSource, dummyjsonSource] as Source<unknown>[];

let libraryPromise: Promise<LibraryItem[]> | null = null;

/** Load every source. Calls share one in-flight promise, so warming it up early is cheap. */
export function loadLibrary(): Promise<LibraryItem[]> {
  if (!libraryPromise) {
    libraryPromise = loadSources(SOURCES).catch((err) => {
      libraryPromise = null;
      throw err;
    });
  }
  return libraryPromise;
}

/** Forget the in-memory library so the next load tries the network again (after a partial load). */
export function resetLibrary(): void {
  libraryPromise = null;
}

/** Load and merge the given sources, updating `libraryStatus()`. Exported for tests. */
export async function loadSources(sources: Source<unknown>[]): Promise<LibraryItem[]> {
  const results = await Promise.all(sources.map((s) => loadSource(s)));
  const pick = (k: 'missing' | 'partial' | 'stale') => sources.filter((_, i) => results[i][k]).map((s) => s.name);
  status = { missing: pick('missing'), partial: pick('partial'), stale: pick('stale'), offline: isOffline() };
  const items = results.flatMap((r) => r.items);
  if (!items.length) {
    const first = results.find((r) => r.error)?.error;
    if (first instanceof NetworkError && first.kind === 'offline') throw first;
    throw new Error('Couldn’t reach the recipe library. Check your internet connection and try again.');
  }
  return items;
}

/** Look up one library recipe by its app id ("mdb-52772"). */
export async function getLibraryRecipe(id: string): Promise<Recipe | undefined> {
  const library = await loadLibrary().catch(() => [] as LibraryItem[]);
  const hit = library.find((item) => item.recipe.id === id);
  if (hit) return hit.recipe;
  // Not in the cached catalog (e.g. a brand-new recipe): ask the source directly.
  const src = SOURCES.find((s) => id.startsWith(s.prefix));
  const raw = src?.lookup ? await src.lookup(id.slice(src.prefix.length)) : undefined;
  return raw ? src!.normalize(raw).recipe : undefined;
}
