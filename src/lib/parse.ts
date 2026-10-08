import type { Difficulty, Ingredient, Step } from './types';

/* ------------------------------------------------------------------ */
/* Instructions → steps                                                */
/* ------------------------------------------------------------------ */

const STEP_MARKER_ONLY = /^(step\s*)?\d+\s*[.):-]?$/i;
const LEADING_MARKER = /^(step\s*\d+\s*[.):\-–]?\s*|\d+\s*[.)]\s+|[•*▢]\s*|-\s+)/i;

/** Split text into sentences without breaking on "approx." style abbreviations. */
export function splitSentences(text: string): string[] {
  const parts = text
    .replace(/\b(approx|e\.g|i\.e|tbsp|tsp|oz|lb|min|mins|hr|hrs|no|vs|etc)\.\s/gi, (m) => m.replace('. ', '.\u0000'))
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(“"'])/)
    .map((s) => s.replace(/\u0000/g, ' ').trim())
    .filter(Boolean);
  return parts;
}

/** Group sentences into readable chunks of roughly `target` characters. */
function chunkSentences(sentences: string[], target = 240): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current && current.length + s.length > target) {
      chunks.push(current);
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Turn a free-text instructions blob (as found in TheMealDB) into clean steps.
 * Handles "STEP 1" markers, numbered lines, bullet lines, section headers like
 * "For the sauce:" and single giant paragraphs.
 */
export function splitInstructions(raw: string): Step[] {
  const text = (raw || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim();
  if (!text) return [];

  let lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !STEP_MARKER_ONLY.test(l))
    .map((l) => l.replace(LEADING_MARKER, '').trim())
    .filter(Boolean);

  // Break up long paragraphs (and recipes that are one big paragraph) so each step is bite-sized.
  const expanded: string[] = [];
  const shouldSplitAll = lines.length <= 2 && text.length > 260;
  for (const line of lines) {
    if (shouldSplitAll || line.length > 360) expanded.push(...chunkSentences(splitSentences(line), 220));
    else expanded.push(line);
  }
  lines = expanded;

  const steps: Step[] = [];
  let pendingTitle: string | undefined;
  for (const line of lines) {
    // Short lines ending with ":" are section headers ("For the sauce:").
    if (line.length <= 45 && /:$/.test(line)) {
      pendingTitle = line.replace(/:$/, '');
      continue;
    }
    steps.push({ title: pendingTitle, text: line, minutes: longestDuration(line) });
    pendingTitle = undefined;
  }
  return steps;
}

/* ------------------------------------------------------------------ */
/* Durations & timers                                                  */
/* ------------------------------------------------------------------ */

export interface Duration {
  /** Lower bound in minutes ("10–15 minutes" → 10). Used for timers. */
  min: number;
  /** Upper bound in minutes ("10–15 minutes" → 15). Used for time estimates. */
  max: number;
  /** The matched text, e.g. "10-15 minutes". */
  text: string;
  /** True for long hands-off time like chilling, marinating or rising. */
  passive: boolean;
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fortyfive: 45, sixty: 60,
  few: 3, couple: 2, several: 4,
};
const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

const NUM = String.raw`(?:\d+(?:[.,]\d+)?(?:\s*[½¼¾⅓⅔])?|\d+\s+\d\/\d|\d\/\d|[½¼¾⅓⅔]|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty-five|forty|sixty|a few|a couple(?: of)?|few|several)`;
const DURATION_RE = new RegExp(
  String.raw`(\b(?:every|each)\s+)?(?:\b(half an?|${NUM})(?![a-z0-9]))(?:\s*(?:-|–|to|or)\s*(${NUM})(?![a-z0-9]))?\s*(?:more\s+|extra\s+|further\s+|additional\s+)?(minutes?|mins?|hours?|hrs?)\b`,
  'gi',
);
const PASSIVE_WORDS = /\b(chill|refrigerat|fridge|marinat|rest|rise|prove|proof|soak|freez|set|cool|overnight|leave|stand|slow cooker)/i;

function toNumber(token: string): number {
  const t = token.trim().toLowerCase();
  if (t.startsWith('half')) return 0.5;
  if (/^a (few|couple)/.test(t)) return WORD_NUMBERS[t.split(' ')[1]] ?? 2;
  if (t in WORD_NUMBERS) return WORD_NUMBERS[t];
  if (t in FRACTIONS) return FRACTIONS[t];
  const mixed = t.match(/^(\d+)\s+(\d)\/(\d)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d)\/(\d)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const withSymbol = t.match(/^(\d+(?:[.,]\d+)?)\s*([½¼¾⅓⅔])$/);
  if (withSymbol) return Number(withSymbol[1].replace(',', '.')) + FRACTIONS[withSymbol[2]];
  return Number(t.replace(',', '.'));
}

/** Find every duration mentioned in a piece of text ("simmer for 10-15 minutes"). */
export function parseDurations(text: string): Duration[] {
  const out: Duration[] = [];
  for (const m of text.matchAll(DURATION_RE)) {
    if (m[1]) continue; // "every 10 minutes" is an interval, not a duration
    const a = toNumber(m[2]);
    const b = m[3] ? toNumber(m[3]) : a;
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) continue;
    const factor = /^h/i.test(m[4]) ? 60 : 1;
    const min = Math.min(a, b) * factor;
    const max = Math.max(a, b) * factor;
    if (max > 72 * 60) continue;
    // Look at the words just before the duration to decide if it's hands-off time.
    const before = text.slice(Math.max(0, (m.index ?? 0) - 60), m.index ?? 0);
    out.push({ min: Math.round(min), max: Math.round(max), text: m[0].trim(), passive: max >= 60 && PASSIVE_WORDS.test(before) });
  }
  if (/\bovernight\b/i.test(text)) out.push({ min: 480, max: 480, text: 'overnight', passive: true });
  return out;
}

function longestDuration(text: string): number | undefined {
  const d = parseDurations(text);
  if (!d.length) return undefined;
  return Math.max(...d.map((x) => x.max));
}

/** Timers worth offering for a step: unique, between 1 minute and 12 hours. */
export function stepTimers(text: string): Duration[] {
  const seen = new Set<number>();
  return parseDurations(text).filter((d) => {
    if (d.min < 1 || d.min > 720 || seen.has(d.min)) return false;
    seen.add(d.min);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Estimates                                                           */
/* ------------------------------------------------------------------ */

export function estimateMinutes(ingredientCount: number, steps: Step[]): { total: number; passive: boolean } {
  const all = steps.flatMap((s) => parseDurations(s.text));
  const prep = Math.min(30, 5 + ingredientCount * 1.2);
  let total: number;
  if (all.length) total = prep + all.reduce((sum, d) => sum + d.max, 0) * 0.8;
  else total = prep + 10 + steps.length * 3;
  const rounded = Math.max(10, Math.round(total / 5) * 5);
  return { total: rounded, passive: all.some((d) => d.passive) };
}

const TECHNIQUES =
  /\b(knead|prove|proof|yeast|laminat|temper|deep[- ]?fry|deep[- ]fried|caramel|roux|julienne|stiff peaks|fold in|piping bag|pipe the|sous[- ]vide|flamb|choux|souffl|rest the dough|roll out|blind bake|bain[- ]marie|water bath|candy thermometer|sugar thermometer|debone|butterfl|spatchcock|clarif|emulsif|steam|blanch)/gi;

export function estimateDifficulty(ingredientCount: number, stepCount: number, text: string, totalMinutes: number): Difficulty {
  const techniques = new Set((text.match(TECHNIQUES) || []).map((t) => t.toLowerCase().slice(0, 5))).size;
  const points =
    ingredientCount * 0.25 + stepCount * 0.3 + techniques * 1.1 + (totalMinutes > 90 ? 1 : 0) + (totalMinutes > 180 ? 1 : 0);
  if (points < 5) return 'Easy';
  if (points < 7.5) return 'Medium';
  return 'Hard';
}

/* ------------------------------------------------------------------ */
/* Ingredients mentioned in a step                                     */
/* ------------------------------------------------------------------ */

const GENERIC_LAST_WORDS = new Set(['powder', 'sauce', 'juice', 'leaves', 'leaf', 'seeds', 'seed', 'paste', 'extract', 'flakes', 'stock', 'cubes', 'cube', 'zest', 'water']);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function singular(word: string) {
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Which of the recipe's ingredients does this step mention? (In order of appearance.) */
export function ingredientsInStep(stepText: string, ingredients: Ingredient[], limit = 5): Ingredient[] {
  const text = stepText.toLowerCase();
  const hits: { ing: Ingredient; at: number }[] = [];
  for (const ing of ingredients) {
    const name = ing.name.toLowerCase().trim();
    if (!name) continue;
    const words = name.split(/\s+/);
    const candidates = [name, singular(name)];
    const last = singular(words[words.length - 1]);
    if (words.length > 1 && last.length >= 3 && !GENERIC_LAST_WORDS.has(last)) candidates.push(last);
    let at = -1;
    for (const c of candidates) {
      const m = new RegExp(`\\b${escapeRe(c)}(e?s)?\\b`).exec(text);
      if (m) {
        at = m.index;
        break;
      }
    }
    if (at >= 0) hits.push({ ing, at });
  }
  return hits.sort((a, b) => a.at - b.at).slice(0, limit).map((h) => h.ing);
}

/** Picture of an ingredient from TheMealDB's ingredient image set. */
export function ingredientImage(name: string): string {
  return `https://www.themealdb.com/images/ingredients/${encodeURIComponent(name.trim())}-small.png`;
}

/** "75" → "1 hr 15 min". */
export function formatMinutes(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return '';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Extract the video id from a YouTube URL. */
export function youtubeId(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m?.[1];
}
