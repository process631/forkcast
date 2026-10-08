import { hasFish, hasMeat } from './diet';
import { buildItem, type LibraryItem } from './item';
import type { Source } from './library';
import { fetchJson } from './net';
import { ingredientImage } from './parse';
import type { Difficulty, Ingredient } from './types';

/**
 * DummyJSON (https://dummyjson.com/docs/recipes): about 50 extra recipes from around the world.
 * Free, no key, and it allows browser requests from any site.
 */
const API = 'https://dummyjson.com/recipes';
const NAME = 'DummyJSON';

export interface RawDummyRecipe {
  id: number;
  name: string;
  ingredients: string[];
  instructions: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  difficulty?: string;
  cuisine?: string;
  tags?: string[];
  image?: string;
  mealType?: string[];
}

/** Its cuisine labels → a country our cuisine groups know. */
const CUISINE_COUNTRY: Record<string, string> = {
  Italian: 'Italy', American: 'United States', Hawaiian: 'United States', Mexican: 'Mexico', Mediterranean: 'Greece',
  Pakistani: 'Pakistan', Japanese: 'Japan', Moroccan: 'Morocco', Korean: 'South Korea', Greek: 'Greece', Thai: 'Thailand',
  Indian: 'India', Turkish: 'Turkey', Russian: 'Russia', Lebanese: 'Lebanon', Brazilian: 'Brazil', Spanish: 'Spain',
  Vietnamese: 'Vietnam', Cuban: 'Cuba', Chinese: 'China', French: 'France',
};

/** "Tomatoes, diced" → name "Tomatoes", measure "diced". */
export function splitIngredient(line: string): Ingredient {
  const [name, ...rest] = line.split(',');
  const clean = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return { name: clean, measure: rest.join(',').trim(), image: ingredientImage(clean) };
}

/** Pick a TheMealDB-style category so the shared matching rules work. */
export function dummyCategory(r: RawDummyRecipe, names: string[]): string {
  const meals = (r.mealType ?? []).map((m) => m.toLowerCase());
  const words = [r.name, ...(r.tags ?? [])].join(' ').toLowerCase();
  const all = `${words} ${names.join(' ').toLowerCase()}`;
  if (meals.includes('dessert') || /\b(dessert|cookies?|tiramisu|ice cream|brigadeiros?)\b/.test(words)) return 'Dessert';
  if (meals.length === 1 && meals[0] === 'breakfast') return 'Breakfast';
  if (meals.every((m) => m === 'side dish' || m === 'lunch') && meals.includes('side dish')) return 'Side';
  if (meals.every((m) => /^(appetizer|snacks?)$/.test(m))) return 'Starter';
  if (/\bpasta\b/.test(words)) return 'Pasta';
  if (/\b(shrimp|prawns?|fish|salmon)\b/.test(words) || hasFish(names)) return 'Seafood';
  if (/\bchicken\b/.test(all)) return 'Chicken';
  if (/\blamb\b/.test(all)) return 'Lamb';
  if (/\b(beef|keema)\b/.test(all)) return 'Beef';
  if (/\bpork\b/.test(all)) return 'Pork';
  if (!hasMeat(names)) return 'Vegetarian';
  return 'Miscellaneous';
}

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export function normalizeDummy(r: RawDummyRecipe): LibraryItem {
  const ingredients = r.ingredients.map(splitIngredient).filter((i) => i.name);
  const names = ingredients.map((i) => i.name);
  const drink = (r.mealType ?? []).some((m) => m.toLowerCase() === 'beverage');
  const cuisine = r.cuisine && CUISINE_COUNTRY[r.cuisine] ? r.cuisine : undefined;
  const minutes = (r.prepTimeMinutes ?? 0) + (r.cookTimeMinutes ?? 0);
  return buildItem({
    id: `djr-${r.id}`,
    source: 'dummyjson',
    kind: drink ? 'drink' : 'food',
    title: r.name,
    image: r.image,
    category: drink ? (/\b(cocktail|caipirinha|mojito)\b/i.test([r.name, ...(r.tags ?? [])].join(' ')) ? 'Cocktail' : 'Shake') : dummyCategory(r, names),
    cuisine,
    country: cuisine ? CUISINE_COUNTRY[cuisine] : '',
    tags: r.tags ?? [],
    ingredients,
    instructions: r.instructions.join('\n'),
    minutes: minutes > 0 ? minutes : undefined,
    difficulty: DIFFICULTIES.find((d) => d === r.difficulty),
  });
}

type RecipesResponse = { recipes: RawDummyRecipe[] };

export const dummyjsonSource: Source<RawDummyRecipe> = {
  name: NAME,
  prefix: 'djr-',
  cacheKey: 'library:dummyjson:v1',
  fetchAll: async () => ({ items: (await fetchJson<RecipesResponse>(`${API}?limit=0`, NAME)).recipes ?? [], failed: 0 }),
  normalize: normalizeDummy,
  lookup: async (id) => {
    try {
      return await fetchJson<RawDummyRecipe>(`${API}/${encodeURIComponent(id)}`, NAME);
    } catch {
      return undefined;
    }
  },
};
