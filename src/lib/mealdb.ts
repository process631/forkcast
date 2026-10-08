import { buildItem, type LibraryItem } from './item';
import type { Source } from './library';
import { fetchByLetter, fetchJson } from './net';
import { ingredientImage } from './parse';
import type { Ingredient } from './types';

export type { LibraryItem } from './item';

/**
 * TheMealDB (https://www.themealdb.com) — a free recipe API with ~800 recipes, photos and videos.
 * The free developer key "1" is fine for personal and educational projects.
 */
const API = 'https://www.themealdb.com/api/json/v1/1';
const NAME = 'TheMealDB';

export interface RawMeal {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strCountry?: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  strTags: string | null;
  strYoutube: string | null;
  strSource: string | null;
  [key: string]: string | null | undefined;
}

/** Adjective-style cuisine labels for the newer TheMealDB entries that only have a country. */
const COUNTRY_ADJECTIVE: Record<string, string> = {
  'United States': 'American', 'United Kingdom': 'British', France: 'French', India: 'Indian', Norway: 'Norwegian',
  Netherlands: 'Dutch', Argentina: 'Argentine', Venezuela: 'Venezuelan', Slovakia: 'Slovak', Brazil: 'Brazilian',
  Colombia: 'Colombian', Cambodia: 'Cambodian', Dominica: 'Dominican', Albania: 'Albanian', Denmark: 'Danish',
  Bulgaria: 'Bulgarian', 'Cayman Islands': 'Caymanian', Chile: 'Chilean', Afghanistan: 'Afghan', Barbados: 'Barbadian',
  'Costa Rica': 'Costa Rican', Belgium: 'Belgian', Estonia: 'Estonian', Aruba: 'Aruban', Cuba: 'Cuban', Botswana: 'Botswanan',
  'Antigua and Barbuda': 'Antiguan', Laos: 'Lao', Austria: 'Austrian', Armenia: 'Armenian', Bangladesh: 'Bangladeshi',
  Andorra: 'Andorran', Angola: 'Angolan', Azerbaijan: 'Azerbaijani', Bahamas: 'Bahamian',
};

function cuisineLabel(area: string | null, country: string | null | undefined): string | undefined {
  if (area && !COUNTRY_ADJECTIVE[area]) return area;
  if (area && COUNTRY_ADJECTIVE[area]) return COUNTRY_ADJECTIVE[area];
  if (country) return COUNTRY_ADJECTIVE[country] ?? country;
  return undefined;
}

export function normalizeMeal(m: RawMeal): LibraryItem {
  const ingredients: Ingredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] || '').trim();
    if (!name) continue;
    ingredients.push({ name, measure: (m[`strMeasure${i}`] || '').trim(), image: ingredientImage(name) });
  }
  return buildItem({
    id: `mdb-${m.idMeal}`,
    source: 'mealdb',
    title: m.strMeal,
    image: m.strMealThumb || undefined,
    category: m.strCategory || undefined,
    cuisine: cuisineLabel(m.strArea, m.strCountry),
    country: m.strCountry || '',
    tags: (m.strTags || '').split(',').map((t) => t.trim()).filter(Boolean),
    ingredients,
    instructions: m.strInstructions || '',
    youtube: m.strYoutube,
    sourceUrl: m.strSource || undefined,
  });
}

type MealsResponse = { meals: RawMeal[] | null };

export const mealdbSource: Source<RawMeal> = {
  name: NAME,
  prefix: 'mdb-',
  cacheKey: 'library:mealdb:v2',
  // A few missing letters still leave a useful catalog.
  maxFailures: 5,
  fetchAll: () => fetchByLetter(async (l) => (await fetchJson<MealsResponse>(`${API}/search.php?f=${l}`, NAME)).meals),
  normalize: normalizeMeal,
  lookup: async (id) => (await fetchJson<MealsResponse>(`${API}/lookup.php?i=${encodeURIComponent(id)}`, NAME)).meals?.[0],
};
