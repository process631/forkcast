import { CUISINES, MOODS, TIMES, getCategory, type CategoryDef, type MatchOption } from '../data/taxonomy';
import { hasFish, hasMeat, mentionsAny, violatesDiet } from './diet';
import type { LibraryItem } from './item';
import { formatMinutes } from './parse';
import type { Answers, MealId, Suggestion } from './types';

const SWEET_TAGS = ['sweet', 'desert', 'dessert', 'cake', 'pudding', 'treat', 'chocolate', 'fruity', 'baking'];
const MAIN_CATS = ['Beef', 'Chicken', 'Lamb', 'Pork', 'Seafood', 'Pasta', 'Goat', 'Vegetarian', 'Vegan', 'Miscellaneous'];
/** Categories where sweet recipes are allowed. */
const SWEET_OK = new Set(['sweet', 'baking', 'pancakes', 'vegan', 'surprise', 'cakes', 'cookies', 'chocolate', 'fruity', 'pies', 'puddings']);

export function isSweet(item: LibraryItem): boolean {
  if (item.category === 'Dessert') return true;
  if (MAIN_CATS.includes(item.category) || item.category === 'Side' || item.category === 'Starter') return false;
  return item.tags.some((t) => SWEET_TAGS.includes(t)) && !item.tags.includes('savory');
}

/* ------------------------------------------------------------------ */
/* Meal fit: how well a recipe suits breakfast / lunch / dinner ...     */
/* ------------------------------------------------------------------ */

const BREAKFAST_TITLE = /\b(breakfast|porridge|oat|oats|oatmeal|granola|muffins?|toast|bagels?|hash|smoothie|yogh?urt|scones?|croissants?|pancakes?|waffles?|french toast|omelett?e|eggs?|shakshuka|frittata|benedict|kedgeree|grits|crepes?|buns?|pastries|torrijas?|poffertjes|mandazi|lahsa|ugali|bread|rolls?|cinnamon|danish|brioche|granola)\b/;
const SNACK_TITLE = /\b(dips?|fritters?|croquet(as|tes)?|wings|bites|balls|samosas?|spring rolls?|egg rolls?|empanadas?|nachos|hummus|crisps|skewers?|kebabs?|bruschetta|pakoras?|bhajis?|dumplings?|gyoza|sliders|tapenade|guacamole|salsa|deviled|devilled|falafel|arancini|cookies?|bars?|brownies?|popcorn|toasts?|briks?)\b/;
const LUNCH_TITLE = /\b(sandwich|wraps?|burgers?|salad|soup|bowls?|tacos?|quesadilla|pitt?a|toastie|panini|b[aá]nh)\b/;

export function mealFit(item: LibraryItem, meal: MealId | null): number {
  if (!meal) return 2;
  const cat = item.category;
  const sweet = isSweet(item);
  switch (meal) {
    case 'breakfast':
      if (cat === 'Breakfast') return 3;
      if (BREAKFAST_TITLE.test(item.title)) return sweet ? 2 : 2.5;
      // TheMealDB tags are noisy ("Fish pie" is tagged Breakfast), so they count for less.
      if (item.tags.includes('breakfast') || item.tags.includes('brunch')) return 1.5;
      if (sweet && /\b(bake|baking|bun|bread|loaf)\b/.test(item.tags.join(' ') + ' ' + item.title)) return 1;
      return 0;
    case 'lunch':
      if (sweet) return 0;
      if (LUNCH_TITLE.test(item.title)) return 3;
      if (['Starter', 'Side', 'Pasta', 'Vegetarian', 'Vegan', 'Miscellaneous'].includes(cat)) return 2;
      if (cat === 'Breakfast') return 1;
      return 1.5;
    case 'dinner':
      if (sweet) return 0;
      if (MAIN_CATS.includes(cat)) return 3;
      if (cat === 'Side' || cat === 'Starter') return 1;
      return 0.5;
    case 'side':
      if (sweet) return 0;
      if (cat === 'Side') return 3;
      if (/\b(salad|rice|potato(es)?|bread|slaw|vegetables?|beans|greens|chips|fries|mash)\b/.test(item.title)) return 2;
      if (cat === 'Starter') return 1.5;
      if (cat === 'Vegetarian' || cat === 'Vegan') return 1;
      return 0.3;
    case 'snack':
      if (cat === 'Starter' || item.tags.some((t) => ['snack', 'treat', 'streetfood', 'onthego'].includes(t))) return 3;
      if (SNACK_TITLE.test(item.title)) return 3;
      if (cat === 'Side') return 1.5;
      if (sweet) return 1;
      return 0.3;
    case 'dessert':
      return sweet ? 3 : 0;
    case 'drink':
      return item.kind === 'drink' ? 3 : 0;
  }
}

/* ------------------------------------------------------------------ */
/* Category match                                                      */
/* ------------------------------------------------------------------ */

/** 0 = no match, 1 = weak signal (ingredients/tags), 2 = strong (title or category). */
export function categoryStrength(item: LibraryItem, cat: CategoryDef): number {
  const r = cat.rule;
  if (r.excludeTitleRe?.test(item.title)) return 0;
  if (r.sweet === true && !isSweet(item)) return 0;
  if (r.sweet === false && isSweet(item)) return 0;

  let strength = 0;
  if (r.cats?.includes(item.category)) strength = 2;
  if (r.titleRe?.test(item.title)) strength = 2;
  if (!strength && r.tags?.some((t) => item.tags.includes(t.toLowerCase()))) strength = 1.5;
  if (!strength && r.ingRe?.test(item.mainIngredients)) strength = 1;

  switch (r.special) {
    case 'any':
      return Math.max(strength, 1);
    case 'vegetarian':
      if (hasMeat(item.ingredientNames) || hasFish(item.ingredientNames)) return 0;
      return Math.max(strength, 1);
    case 'vegan':
      if (violatesDiet(item.ingredientNames, ['vegan'])) return 0;
      return Math.max(strength, 1);
    case 'light': {
      const heavy = item.ingredientNames.filter((n) => /\b(cream|butter|cheese|sugar|double cream|bacon|lard|suet|mayonnaise|sausages?|black pudding|hash browns)\b/.test(n)).length;
      if (heavy > 1 || /\b(deep[- ]?fry|deep[- ]fried)\b/.test(item.text)) return 0;
      return Math.max(strength, item.ingredientNames.length <= 12 ? 1 : 0);
    }
    case 'comfort':
      return strength;
    case 'spicy': {
      const heat = item.ingredientNames.filter((n) => /\b(chil[il]i|chillies|chilies|cayenne|jalape|scotch bonnet|habanero|harissa|sriracha|gochujang|curry|chipotle|piri)/.test(n)).length;
      return Math.max(strength, heat >= 2 ? 1.5 : heat === 1 ? 0.5 : 0);
    }
  }
  return strength;
}

function optionMatches(item: LibraryItem, opt: MatchOption): 'title' | 'text' | null {
  if (opt.notRe?.test(item.text)) return null;
  if (opt.cats?.includes(item.category)) return 'title';
  if (opt.titleRe?.test(item.title)) return 'title';
  if (opt.re?.test(item.title)) return 'title';
  if (opt.re?.test(item.text)) return 'text';
  return null;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export interface Scored {
  item: LibraryItem;
  score: number;
  reasons: string[];
  close: boolean;
}

/** Deterministic pseudo-random number in [0, 1) for a seed + id. */
function jitter(seed: number, id: string): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export function scoreItem(item: LibraryItem, a: Answers, seed = 0): Scored | null {
  const r = item.recipe;
  // Drinks only for the Drinks meal, food for everything else.
  if ((item.kind === 'drink') !== (a.meal === 'drink')) return null;
  // Hard filters: diets and things to avoid.
  if (violatesDiet(item.ingredientNames, a.diets, item.category)) return null;
  if (a.avoid.length && mentionsAny(item.ingredientNames, a.avoid).length) return null;
  if (a.avoid.some((w) => w.trim() && item.title.includes(w.toLowerCase().trim()))) return null;

  const cat = getCategory(a.category);
  const fit = mealFit(item, a.meal);
  if (a.meal === 'dessert' && fit === 0) return null;
  // Savory categories never show desserts (no "rice pudding" for a rice dinner).
  if (cat && !SWEET_OK.has(cat.id) && isSweet(item)) return null;

  const strength = cat ? categoryStrength(item, cat) : 1;
  // "Close" = right kind of food for the wrong meal, or the right meal but a different kind of food.
  const close = strength === 0 || fit === 0;
  const reasons: string[] = [];
  let score = fit * 2.5 + strength * 3;
  if (strength === 0) score -= 6;
  else if (fit === 0) score -= 3;

  // Category-specific follow-up ("Which meat?", "Creamy or tomato?").
  if (a.styles.length && cat?.question) {
    const chosen = cat.question.options.filter((o) => a.styles.includes(o.id) && (o.re || o.titleRe || o.cats));
    if (chosen.length) {
      const hits = chosen.map((o) => ({ o, how: optionMatches(item, o) })).filter((h) => h.how);
      if (hits.length) {
        score += hits.some((h) => h.how === 'title') ? 4 : 2.5;
        reasons.push(hits[0].o.label);
      } else {
        score -= 2;
      }
    }
    if (a.styles.includes('noyeast') && /\byeast\b/.test(item.text)) score -= 3;
  }

  // Flavor mood.
  let moodHits = 0;
  for (const id of a.moods) {
    const mood = MOODS.find((m) => m.id === id);
    if (mood?.re?.test(item.text)) {
      moodHits++;
      if (moodHits <= 2) reasons.push(mood.label);
    }
  }
  score += Math.min(moodHits, 3) * 1.3;
  if (a.moods.length && !moodHits) score -= 1;

  // Cuisine.
  if (a.cuisines.length) {
    if (r.cuisineGroup && a.cuisines.includes(r.cuisineGroup)) {
      score += 4;
      reasons.push(r.cuisine || CUISINES.find((c) => c.id === r.cuisineGroup)?.label || 'Your cuisine');
    } else {
      score -= 3;
    }
  }

  // Ingredients to use up.
  if (a.include.length) {
    const used = mentionsAny(item.ingredientNames, a.include);
    score += used.length * 3.5;
    if (used.length) reasons.unshift(`Uses ${used.slice(0, 2).join(' & ')}`);
    else score -= 1.5;
  }

  // Time.
  const time = TIMES.find((t) => t.id === a.time);
  if (time && Number.isFinite(time.max)) {
    if (r.totalMinutes <= time.max) {
      score += 2;
      reasons.push(`~${formatMinutes(r.totalMinutes)}`);
    } else if (r.totalMinutes <= time.max * 1.5) {
      score -= 0.5;
    } else {
      score -= 4;
    }
  }

  // Skill.
  const d = r.difficulty;
  if (a.skill === 'easy') score += d === 'Easy' ? 2 : d === 'Medium' ? 0 : -3;
  if (a.skill === 'medium') score += d === 'Medium' ? 1.5 : d === 'Easy' ? 1 : -0.5;
  if (a.skill === 'hard') score += d === 'Hard' ? 2.5 : d === 'Medium' ? 1 : -0.5;
  if (a.skill !== 'any' && ((a.skill === 'easy' && d === 'Easy') || (a.skill === 'hard' && d === 'Hard'))) reasons.push(d === 'Easy' ? 'Beginner friendly' : 'A real challenge');

  if (r.youtube) score += 0.3;
  score += jitter(seed, r.id) * 2.5;

  if (a.diets.length) reasons.push(dietReason(a.diets));
  if (!reasons.length && cat && cat.id !== 'surprise') reasons.push(cat.label);
  return { item, score, reasons: [...new Set(reasons)].slice(0, 4), close };
}

function dietReason(diets: string[]): string {
  const labels: Record<string, string> = {
    vegetarian: 'Vegetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', 'gluten-free': 'Gluten-free',
    'dairy-free': 'Dairy-free', 'nut-free': 'Nut-free', 'egg-free': 'Egg-free', 'low-carb': 'Low-carb', 'no-pork': 'No pork', 'no-alcohol': 'No alcohol',
  };
  return diets.slice(0, 2).map((d) => labels[d] || d).join(' · ');
}

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['with', 'and', 'the'].includes(w))
      // Collapse doubled letters and plurals so "Fettuccine" ≈ "Fettucine", "Pancakes" ≈ "Pancake".
      .map((w) => w.replace(/(.)\1+/g, '$1').replace(/s$/, '')),
  );
}

function tooSimilar(a: string, b: string): boolean {
  const wa = titleWords(a);
  const wb = titleWords(b);
  if (!wa.size || !wb.size) return false;
  let shared = 0;
  wa.forEach((w) => wb.has(w) && shared++);
  return shared / Math.min(wa.size, wb.size) >= 0.6;
}

export interface MatchResult {
  suggestions: Suggestion[];
  /** How many recipes passed the diet filters and matched the category. */
  poolSize: number;
}

/**
 * Pick the best library recipes for these answers.
 * `exclude` holds ids already shown, so "show different options" gives fresh picks.
 */
export function matchLibrary(
  library: LibraryItem[],
  answers: Answers,
  opts: { count?: number; exclude?: string[]; excludeTitles?: string[]; seed?: number } = {},
): MatchResult {
  const count = opts.count ?? 6;
  const exclude = new Set(opts.exclude ?? []);
  const scored = library
    .map((item) => scoreItem(item, answers, opts.seed ?? 0))
    .filter((s): s is Scored => Boolean(s));

  const strict = scored.filter((s) => !s.close);
  strict.sort((a, b) => b.score - a.score);
  // If the category is thin (e.g. sandwiches for breakfast), fill up with close matches, ranked after real ones.
  const pool = strict.length >= count + (opts.exclude?.length ?? 0) ? strict : [...strict, ...scored.filter((s) => s.close).sort((a, b) => b.score - a.score)];

  const picked: Scored[] = [];
  for (const s of pool) {
    if (picked.length >= count) break;
    if (exclude.has(s.item.recipe.id)) continue;
    if (picked.some((p) => tooSimilar(p.item.recipe.title, s.item.recipe.title))) continue;
    if (opts.excludeTitles?.some((t) => tooSimilar(t, s.item.recipe.title))) continue;
    picked.push(s);
  }
  return {
    poolSize: strict.length,
    suggestions: picked.map((s) => ({
      recipe: s.item.recipe,
      reasons: s.close ? ['Close match', ...s.reasons].slice(0, 4) : s.reasons,
      score: s.score,
      close: s.close,
    })),
  };
}

/** A random crowd-pleaser for the "Surprise me" button. */
export function randomPick(library: LibraryItem[], answers?: Partial<Answers>): LibraryItem | undefined {
  const pool = library.filter((i) => i.kind === 'food' && i.recipe.image && i.recipe.steps.length >= 2 && !violatesDiet(i.ingredientNames, answers?.diets ?? [], i.category));
  return pool[Math.floor(Math.random() * pool.length)];
}
