import { describe, expect, it } from 'vitest';
import { normalizeMeal, type RawMeal } from './mealdb';
import { categoryStrength, matchLibrary, mealFit } from './match';
import { EMPTY_ANSWERS } from './store';
import { getCategory } from '../data/taxonomy';
import type { Answers } from './types';

let nextId = 1;
function meal(title: string, category: string, ingredients: string[], instructions: string, extra: Partial<RawMeal> = {}) {
  const raw: RawMeal = {
    idMeal: String(nextId++),
    strMeal: title,
    strCategory: category,
    strArea: null,
    strCountry: 'Italy',
    strInstructions: instructions,
    strMealThumb: 'https://example.com/x.jpg',
    strTags: null,
    strYoutube: null,
    strSource: null,
    ...extra,
  };
  ingredients.forEach((ing, i) => {
    raw[`strIngredient${i + 1}`] = ing;
    raw[`strMeasure${i + 1}`] = '1';
  });
  return normalizeMeal(raw);
}

const library = [
  meal('Fettuccine Alfredo', 'Pasta', ['Fettuccine', 'Double Cream', 'Parmesan', 'Garlic'], 'Boil the pasta for 10 minutes. Stir in the cream and cheese.'),
  meal('Fettucine alfredo', 'Pasta', ['Fettuccine', 'Butter', 'Parmesan'], 'Cook pasta for 9 minutes. Toss with butter and parmesan.'),
  meal('Spaghetti Bolognese', 'Beef', ['Spaghetti', 'Minced Beef', 'Tomatoes'], 'Brown the beef. Simmer the sauce for 40 minutes. Serve with spaghetti.'),
  meal('Spinach Lasagne', 'Vegetarian', ['Lasagne Sheets', 'Spinach', 'Ricotta'], 'Layer and bake for 40 minutes.'),
  meal('Thai Green Curry', 'Chicken', ['Chicken', 'Coconut Milk', 'Green Chilli', 'Chilli Powder'], 'Simmer for 20 minutes.', { strCountry: 'Thailand' }),
  meal('Rice Pudding', 'Dessert', ['Pudding Rice', 'Milk', 'Sugar'], 'Bake for 2 hours.'),
  meal('Pancakes', 'Breakfast', ['Flour', 'Eggs', 'Milk'], 'Whisk and fry for 2 minutes each side.'),
  meal('Chocolate Brownies', 'Dessert', ['Dark Chocolate', 'Butter', 'Sugar', 'Eggs'], 'Bake in the oven for 25 minutes.'),
  meal('Chocolate Mousse', 'Dessert', ['Dark Chocolate', 'Double Cream', 'Eggs'], 'Fold together and chill in the fridge for 4 hours.'),
];

const answers = (a: Partial<Answers>): Answers => ({ ...EMPTY_ANSWERS, ...a });
const titles = (a: Answers, opts = {}) =>
  matchLibrary(library, a, opts).suggestions.map((s) => s.recipe.title);

describe('matchLibrary', () => {
  it('honors diets as hard filters', () => {
    const picked = titles(answers({ meal: 'dinner', category: 'pasta', diets: ['vegetarian'] }));
    expect(picked).not.toContain('Spaghetti Bolognese');
    expect(picked).toContain('Spinach Lasagne');
    expect(picked.some((t) => /alfredo/i.test(t))).toBe(true);
  });

  it('never suggests near-duplicate titles together', () => {
    const picked = titles(answers({ meal: 'dinner', category: 'pasta' }));
    expect(picked.filter((t) => t.toLowerCase().startsWith('fettuc'))).toHaveLength(1);
  });

  it('keeps desserts out of savory categories', () => {
    expect(titles(answers({ meal: 'dinner', category: 'rice' }))).not.toContain('Rice Pudding');
  });

  it('only suggests sweet things for dessert', () => {
    const picked = titles(answers({ meal: 'dessert', category: 'surprise' }));
    expect(picked.sort()).toEqual(['Chocolate Brownies', 'Chocolate Mousse', 'Rice Pudding']);
  });

  it('respects "no oven" for desserts', () => {
    const [first] = titles(answers({ meal: 'dessert', category: 'chocolate', styles: ['nobake'] }));
    expect(first).toBe('Chocolate Mousse');
  });

  it('puts "use up" ingredients and cuisines first, with reasons', () => {
    const res = matchLibrary(library, answers({ meal: 'dinner', category: 'surprise', include: ['spinach'] }));
    const top = res.suggestions[0];
    expect(top.recipe.title).toBe('Spinach Lasagne');
    expect(top.reasons[0]).toBe('Uses spinach');

    const thai = matchLibrary(library, answers({ meal: 'dinner', category: 'surprise', cuisines: ['seasian'] })).suggestions[0];
    expect(thai.recipe.title).toBe('Thai Green Curry');
  });

  it('skips ids and look-alike titles already shown', () => {
    const picked = titles(answers({ meal: 'dinner', category: 'pasta' }), { exclude: ['mdb-1'], excludeTitles: ['Fettuccine Alfredo'] });
    expect(picked.some((t) => t.toLowerCase().startsWith('fettuc'))).toBe(false);
  });
});

describe('mealFit & categoryStrength', () => {
  it('rates breakfast dishes for breakfast and mains for dinner', () => {
    const pancakes = library.find((m) => m.recipe.title === 'Pancakes')!;
    const bolognese = library.find((m) => m.recipe.title === 'Spaghetti Bolognese')!;
    expect(mealFit(pancakes, 'breakfast')).toBe(3);
    expect(mealFit(bolognese, 'breakfast')).toBe(0);
    expect(mealFit(bolognese, 'dinner')).toBe(3);
  });

  it('matches the spicy category by heat in the ingredients', () => {
    const curry = library.find((m) => m.recipe.title === 'Thai Green Curry')!;
    expect(categoryStrength(curry, getCategory('curry')!)).toBeGreaterThan(0);
  });
});
