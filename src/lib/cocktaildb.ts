import { buildItem, type LibraryItem } from './item';
import type { Source } from './library';
import { fetchByLetter, fetchJson } from './net';
import { parseDurations } from './parse';
import type { Ingredient } from './types';

/**
 * TheCocktailDB (https://www.thecocktaildb.com): TheMealDB's sister site, about 400 drinks:
 * cocktails, mocktails, shakes, coffee & tea. The free developer key "1" is fine for personal and
 * educational projects.
 */
const API = 'https://www.thecocktaildb.com/api/json/v1/1';
const NAME = 'TheCocktailDB';

export interface RawDrink {
  idDrink: string;
  strDrink: string;
  strCategory: string | null;
  strAlcoholic: string | null;
  strGlass: string | null;
  strInstructions: string | null;
  strDrinkThumb: string | null;
  strTags: string | null;
  strVideo: string | null;
  [key: string]: string | null | undefined;
}

export function drinkIngredientImage(name: string): string {
  return `https://www.thecocktaildb.com/images/ingredients/${encodeURIComponent(name.trim())}-small.png`;
}

export function normalizeDrink(d: RawDrink): LibraryItem {
  const ingredients: Ingredient[] = [];
  for (let i = 1; i <= 15; i++) {
    const name = (d[`strIngredient${i}`] || '').trim();
    if (!name) continue;
    ingredients.push({ name, measure: (d[`strMeasure${i}`] || '').trim(), image: drinkIngredientImage(name) });
  }
  const instructions = d.strInstructions || '';
  const alcohol = (d.strAlcoholic || '').toLowerCase();
  const tags = (d.strTags || '').split(',').map((t) => t.trim()).filter(Boolean);
  // "Alcoholic", "Non alcoholic" or "Optional alcohol", as a tag the matcher and diet filter can use.
  tags.push(alcohol === 'alcoholic' ? 'Alcoholic' : alcohol === 'optional alcohol' ? 'Optional alcohol' : 'Non-alcoholic');
  // Most drinks take a few minutes; only count longer times the instructions spell out (steeping, chilling).
  const waits = parseDurations(instructions).reduce((sum, w) => sum + w.max, 0);
  return buildItem({
    id: `cdb-${d.idDrink}`,
    source: 'cocktaildb',
    kind: 'drink',
    title: d.strDrink,
    image: d.strDrinkThumb || undefined,
    category: d.strCategory || undefined,
    tags,
    ingredients,
    instructions,
    youtube: d.strVideo,
    minutes: Math.max(5, Math.round((3 + ingredients.length + waits) / 5) * 5),
    difficulty: ingredients.length <= 4 ? 'Easy' : ingredients.length <= 7 ? 'Medium' : 'Hard',
    note: d.strGlass ? `Serve in a ${d.strGlass.toLowerCase()}.` : undefined,
  });
}

type DrinksResponse = { drinks: RawDrink[] | null };

/** A few drinks have crude names; Forkcast is for everyone, so they're left out. */
const CRUDE = /\b(ass|asshole|orgasm|bitch|nipple|smut|fuck\w*|shit\w*|slut|whore)\b/i;
export const cleanDrinks = (drinks: RawDrink[] | null) => (drinks ?? []).filter((d) => !CRUDE.test(d.strDrink));

export const cocktaildbSource: Source<RawDrink> = {
  name: NAME,
  prefix: 'cdb-',
  cacheKey: 'library:drinks:v1',
  maxFailures: 5,
  fetchAll: () => fetchByLetter(async (l) => cleanDrinks((await fetchJson<DrinksResponse>(`${API}/search.php?f=${l}`, NAME)).drinks)),
  normalize: normalizeDrink,
  lookup: async (id) => cleanDrinks((await fetchJson<DrinksResponse>(`${API}/lookup.php?i=${encodeURIComponent(id)}`, NAME)).drinks)[0],
};
