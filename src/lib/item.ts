import { cuisineForCountry } from '../data/taxonomy';
import { estimateDifficulty, estimateMinutes, splitInstructions, youtubeId } from './parse';
import type { Difficulty, Ingredient, Recipe, RecipeKind, RecipeSource } from './types';

/** A library recipe plus lower-cased text used by the matching engine. */
export interface LibraryItem {
  recipe: Recipe;
  kind: RecipeKind;
  title: string;
  category: string;
  tags: string[];
  ingredientNames: string[];
  /** Ingredient names without stocks/sauces, for "main ingredient" checks. */
  mainIngredients: string;
  /** Everything (title, tags, ingredients, instructions) for keyword checks. */
  text: string;
  country: string;
}

/** What every source turns its own records into before they join the library. */
export interface ItemInput {
  id: string;
  source: RecipeSource;
  kind?: RecipeKind;
  title: string;
  /** TheMealDB-style category ("Beef", "Dessert", "Side"…) so one set of matching rules fits all sources. */
  category?: string;
  cuisine?: string;
  country?: string;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string;
  image?: string;
  youtube?: string | null;
  sourceUrl?: string;
  /** The source's own numbers win over our estimates when it has them. */
  minutes?: number;
  difficulty?: Difficulty;
  note?: string;
}

export function buildItem(i: ItemInput): LibraryItem {
  const steps = splitInstructions(i.instructions);
  const estimate = estimateMinutes(i.ingredients.length, steps);
  const total = i.minutes && i.minutes > 0 ? i.minutes : estimate.total;
  const country = i.country || '';
  const recipe: Recipe = {
    id: i.id,
    source: i.source,
    kind: i.kind ?? 'food',
    title: i.title.trim(),
    image: i.image || undefined,
    category: i.category || undefined,
    cuisine: i.cuisine,
    cuisineGroup: cuisineForCountry(country)?.id,
    tags: i.tags,
    totalMinutes: total,
    hasPassiveTime: estimate.passive,
    difficulty: i.difficulty ?? estimateDifficulty(i.ingredients.length, steps.length, i.instructions, total),
    ingredients: i.ingredients,
    steps,
    youtube: youtubeId(i.youtube),
    sourceUrl: i.sourceUrl || undefined,
    note: i.note,
  };
  const ingredientNames = i.ingredients.map((x) => x.name.toLowerCase());
  const mainIngredients = ingredientNames.filter((n) => !/\b(stock|broth|bouillon|cubes?|gravy|sauce|fat|dripping|granules)\b/.test(n)).join(' | ');
  const title = recipe.title.toLowerCase();
  return {
    recipe,
    kind: recipe.kind ?? 'food',
    title,
    category: recipe.category || '',
    tags: i.tags.map((t) => t.toLowerCase()),
    ingredientNames,
    mainIngredients,
    text: [title, i.tags.join(' '), ingredientNames.join(' '), i.instructions].join(' \n ').toLowerCase(),
    country,
  };
}

/** Where a recipe came from, for credits on the recipe page. */
export const SOURCE_NAMES: Record<RecipeSource, string> = {
  mealdb: 'TheMealDB',
  dummyjson: 'DummyJSON',
  cocktaildb: 'TheCocktailDB',
};
