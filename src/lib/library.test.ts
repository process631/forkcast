import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeStatus, libraryStatus, loadSources, type Source } from './library';
import { normalizeMeal, type RawMeal } from './mealdb';
import { NetworkError, fetchByLetter, fetchJson } from './net';
import { idbDelete, idbGet, idbSet } from './storage';

const raw = (id: string, title: string): RawMeal => ({
  idMeal: id,
  strMeal: title,
  strCategory: 'Beef',
  strArea: null,
  strInstructions: 'Fry for 5 minutes. Serve.',
  strMealThumb: null,
  strTags: null,
  strYoutube: null,
  strSource: null,
});

function source(name: string, fetchAll: Source<RawMeal>['fetchAll'], maxFailures = 0): Source<unknown> {
  return { name, prefix: 'x-', cacheKey: `test:${name}`, fetchAll, normalize: normalizeMeal, maxFailures } as Source<unknown>;
}

const titles = (items: { recipe: { title: string } }[]) => items.map((i) => i.recipe.title);

describe('loadSources', () => {
  beforeEach(async () => {
    for (const k of ['test:A', 'test:B']) await idbDelete(k);
  });

  it('merges sources and caches complete downloads', async () => {
    const items = await loadSources([
      source('A', async () => ({ items: [raw('1', 'Steak')], failed: 0 })),
      source('B', async () => ({ items: [raw('2', 'Stew')], failed: 0 })),
    ]);
    expect(titles(items)).toEqual(['Steak', 'Stew']);
    expect(describeStatus()).toBe('');
    expect(await idbGet('test:A')).toBeTruthy();
  });

  it('keeps going when one source is down and says so', async () => {
    const items = await loadSources([
      source('A', async () => ({ items: [raw('1', 'Steak')], failed: 0 })),
      source('B', async () => {
        throw new NetworkError('down', 'network');
      }),
    ]);
    expect(titles(items)).toEqual(['Steak']);
    expect(libraryStatus().missing).toEqual(['B']);
    expect(describeStatus()).toMatch(/B couldn’t be reached/);
  });

  it('uses a partial download but does not cache it', async () => {
    const items = await loadSources([source('A', async () => ({ items: [raw('1', 'Steak')], failed: 2 }), 5)]);
    expect(titles(items)).toEqual(['Steak']);
    expect(libraryStatus().partial).toEqual(['A']);
    expect(await idbGet('test:A')).toBeUndefined();
  });

  it('falls back to a stale cache when the network fails', async () => {
    await idbSet('test:A', { at: 0, items: [raw('9', 'Old Pie')] });
    const items = await loadSources([source('A', async () => ({ items: [], failed: 26 }))]);
    expect(titles(items)).toEqual(['Old Pie']);
    expect(libraryStatus().stale).toEqual(['A']);
  });

  it('prefers a stale cache over a badly broken download', async () => {
    await idbSet('test:A', { at: 0, items: [raw('9', 'Old Pie'), raw('10', 'Old Tart')] });
    const items = await loadSources([source('A', async () => ({ items: [raw('1', 'Steak')], failed: 20 }), 5)]);
    expect(titles(items)).toEqual(['Old Pie', 'Old Tart']);
  });

  it('uses a fresh cache without touching the network', async () => {
    await idbSet('test:A', { at: Date.now(), items: [raw('9', 'Cached')] });
    const fetchAll = vi.fn();
    expect(titles(await loadSources([source('A', fetchAll)]))).toEqual(['Cached']);
    expect(fetchAll).not.toHaveBeenCalled();
  });

  it('fails with a clear message when nothing loads and nothing is cached', async () => {
    await expect(loadSources([source('A', async () => ({ items: [], failed: 26 }))])).rejects.toThrow(/Check your internet connection/);
  });
});

describe('fetchJson', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries once after a network error', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response('{"ok":1}'));
    globalThis.fetch = fetch;
    expect(await fetchJson('https://x.test', 'Test')).toEqual({ ok: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));
    globalThis.fetch = fetch;
    await expect(fetchJson('https://x.test', 'Test')).rejects.toThrow(/error 404/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up with a timeout message when the server never answers', async () => {
    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    ) as typeof fetch;
    await expect(fetchJson('https://x.test', 'Test', { timeoutMs: 20, retries: 1 })).rejects.toThrow(/took too long/);
  });

  it('fails fast when the browser is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetch = vi.fn();
    globalThis.fetch = fetch;
    await expect(fetchJson('https://x.test', 'Test')).rejects.toMatchObject({ kind: 'offline' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('pools letters and counts the failed ones', async () => {
    const res = await fetchByLetter(async (l) => {
      if (l === 'q') throw new Error('boom');
      return l === 'a' ? ['apple'] : null;
    });
    expect(res.items).toEqual(['apple']);
    expect(res.failed).toBe(1);
  });
});
