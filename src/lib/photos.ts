import { hasFish, hasMeat } from './diet';
import { idbGet, idbSet } from './storage';
import type { ImageCredit } from './types';

/**
 * Free, openly-licensed food photos for dishes that don't come with one
 * (AI-invented recipes when AI images are off). Wikimedia Commons first, Openverse as a backup.
 * Both allow browser requests without an API key. Credits are shown under the photo.
 */

export interface FreePhoto {
  url: string;
  credit: ImageCredit;
}

const BAD_TITLE = /\b(logo|map|menu|sign|diagram|chart|poster|label|packag|restaurant|store|shop|market|svg|icon|flag|stamp|cover|book)\b/i;

/** For a meat-free dish, skip photos whose title shows meat or seafood ("Fettuccine with Shrimp"). */
function wrongForDiet(title: string, meatFree: boolean): boolean {
  if (!meatFree) return false;
  const words = [title.replace(/[_.,()-]/g, ' ')];
  return hasMeat(words) || hasFish(words);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function fromWikimedia(query: string, meatFree: boolean): Promise<FreePhoto | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size|mime',
    iiurlwidth: '960',
    iiextmetadatafilter: 'Artist|LicenseShortName',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!res.ok) return null;
  const json = await res.json();
  const pages = Object.values(json?.query?.pages ?? {}) as {
    title: string;
    index: number;
    imageinfo?: { thumburl?: string; url: string; descriptionurl: string; width: number; mime: string; extmetadata?: Record<string, { value: string }> }[];
  }[];
  pages.sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info || !/jpe?g|png|webp/.test(info.mime) || info.width < 500 || BAD_TITLE.test(p.title) || wrongForDiet(p.title, meatFree)) continue;
    const author = stripHtml(info.extmetadata?.Artist?.value ?? '') || 'Unknown author';
    const license = info.extmetadata?.LicenseShortName?.value ?? 'CC';
    return {
      url: info.thumburl || info.url,
      credit: { text: `Similar dish · Photo: ${author.slice(0, 60)} · ${license} · Wikimedia Commons`, url: info.descriptionurl },
    };
  }
  return null;
}

async function fromOpenverse(query: string, meatFree: boolean): Promise<FreePhoto | null> {
  const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=6&mature=false`);
  if (!res.ok) return null;
  const json = await res.json();
  for (const r of json?.results ?? []) {
    if (!r.url || BAD_TITLE.test(r.title ?? '') || wrongForDiet(r.title ?? '', meatFree)) continue;
    return {
      url: r.url,
      credit: { text: `Similar dish · Photo: ${(r.creator || 'Unknown').slice(0, 60)} · ${String(r.license || 'cc').toUpperCase()} · via Openverse`, url: r.foreign_landing_url },
    };
  }
  return null;
}

/** Find a free photo for a dish name. Results (including "nothing found") are cached. */
export async function findFreePhoto(dish: string, { meatFree = false } = {}): Promise<FreePhoto | null> {
  const query = dish.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!query) return null;
  const cacheKey = `photo:${meatFree ? 'veg:' : ''}${query.toLowerCase()}`;
  const cached = await idbGet<FreePhoto | { none: number }>(cacheKey);
  if (cached && 'url' in cached) return cached;
  if (cached && Date.now() - cached.none < 86400_000) return null; // "nothing found" is retried after a day

  // Try the full name, then shorter versions: "Creamy Spinach Orzo" → "Spinach Orzo" → "Orzo".
  const words = query.split(' ');
  const attempts = [...new Set([query, words.slice(-2).join(' '), words.length > 1 && words[words.length - 1].length > 3 ? words[words.length - 1] : ''])].filter(Boolean);
  let found: FreePhoto | null = null;
  for (const q of attempts) {
    found = (await fromWikimedia(q, meatFree).catch(() => null)) ?? (await fromOpenverse(q, meatFree).catch(() => null));
    if (found) break;
  }
  await idbSet(cacheKey, found ?? { none: Date.now() });
  return found;
}
