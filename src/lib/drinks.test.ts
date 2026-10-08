import { describe, expect, it } from 'vitest';
import { categoriesForMeal } from '../data/taxonomy';
import { cleanDrinks, normalizeDrink, type RawDrink } from './cocktaildb';
import { normalizeMeal } from './mealdb';
import { matchLibrary, randomPick } from './match';
import { buildScreens } from './questions';
import { EMPTY_ANSWERS } from './store';
import type { Answers } from './types';

let nextId = 1;
function drink(title: string, category: string, alcoholic: 'Alcoholic' | 'Non alcoholic', ingredients: string[], instructions = 'Shake with ice and strain into a glass.') {
  const raw: RawDrink = {
    idDrink: String(nextId++),
    strDrink: title,
    strCategory: category,
    strAlcoholic: alcoholic,
    strGlass: 'Highball glass',
    strInstructions: instructions,
    strDrinkThumb: 'https://example.com/d.jpg',
    strTags: null,
    strVideo: null,
  };
  ingredients.forEach((ing, i) => {
    raw[`strIngredient${i + 1}`] = ing;
    raw[`strMeasure${i + 1}`] = '1 oz';
  });
  return normalizeDrink(raw);
}

const library = [
  drink('Gin Fizz', 'Ordinary Drink', 'Alcoholic', ['Gin', 'Lemon', 'Powdered sugar', 'Carbonated water']),
  drink('Mojito', 'Cocktail', 'Alcoholic', ['Light rum', 'Lime', 'Sugar', 'Mint', 'Soda water']),
  drink('Limeade', 'Other / Unknown', 'Non alcoholic', ['Lime', 'Sugar', 'Water']),
  drink('Strawberry Shake', 'Shake', 'Non alcoholic', ['Strawberries', 'Milk', 'Ice cream']),
  drink('Masala Chai', 'Coffee / Tea', 'Non alcoholic', ['Black tea', 'Milk', 'Cardamom'], 'Heat the milk and tea and boil for 5 minutes.'),
  drink('Thai Iced Coffee', 'Coffee / Tea', 'Non alcoholic', ['Coffee', 'Condensed milk', 'Ice'], 'Brew the coffee, chill and pour over ice.'),
  normalizeMeal({
    idMeal: '99', strMeal: 'Beef Stew', strCategory: 'Beef', strArea: null, strInstructions: 'Brown the beef.\nSimmer for 2 hours.',
    strMealThumb: 'https://example.com/x.jpg', strTags: null, strYoutube: null, strSource: null, strIngredient1: 'Beef', strMeasure1: '1kg',
  }),
];

const answers = (a: Partial<Answers>): Answers => ({ ...EMPTY_ANSWERS, ...a });
const titles = (a: Partial<Answers>) => matchLibrary(library, answers(a)).suggestions.map((s) => s.recipe.title);

describe('drinks', () => {
  it('normalizes TheCocktailDB drinks', () => {
    const [gin] = library;
    expect(gin.kind).toBe('drink');
    expect(gin.recipe).toMatchObject({ id: 'cdb-1', source: 'cocktaildb', kind: 'drink', note: 'Serve in a highball glass.', difficulty: 'Easy' });
    expect(gin.recipe.totalMinutes).toBeLessThanOrEqual(10);
    expect(gin.tags).toContain('alcoholic');
  });

  it('never mixes drinks into food results or food into drinks', () => {
    expect(titles({ meal: 'dinner', category: 'surprise' })).toEqual(['Beef Stew']);
    expect(titles({ meal: 'drink', category: 'surprise' })).not.toContain('Beef Stew');
    for (let i = 0; i < 20; i++) expect(randomPick(library)?.kind).toBe('food');
  });

  it('keeps cocktails and mocktails apart', () => {
    expect(titles({ meal: 'drink', category: 'cocktails' }).slice(0, 2).sort()).toEqual(['Gin Fizz', 'Mojito']);
    const mocktails = matchLibrary(library, answers({ meal: 'drink', category: 'mocktails' })).suggestions.filter((s) => !s.close);
    expect(mocktails.map((s) => s.recipe.title)).toContain('Limeade');
    expect(mocktails.map((s) => s.recipe.title)).not.toContain('Mojito');
  });

  it('drops alcoholic drinks for the no-alcohol diet', () => {
    const picked = titles({ meal: 'drink', category: 'surprise', diets: ['no-alcohol'] });
    expect(picked).not.toContain('Gin Fizz');
    expect(picked).not.toContain('Mojito');
    expect(picked).toContain('Limeade');
  });

  it('answers the follow-ups', () => {
    expect(titles({ meal: 'drink', category: 'cocktails', styles: ['rum'] })[0]).toBe('Mojito');
    expect(titles({ meal: 'drink', category: 'coffee-tea', styles: ['iced'] })[0]).toBe('Thai Iced Coffee');
    expect(titles({ meal: 'drink', category: 'coffee-tea', styles: ['hot'] })[0]).toBe('Masala Chai');
  });

  it('asks only drink-relevant questions', () => {
    const screens = buildScreens(answers({ meal: 'drink', category: 'cocktails' })).map((s) => s.id);
    expect(screens).toEqual(['style', 'diet', 'pantry']);
    const { main, more } = categoriesForMeal('drink');
    expect(main.map((c) => c.id)).toContain('mocktails');
    expect(more).toEqual([]);
    expect(categoriesForMeal('dinner').more.map((c) => c.id)).not.toContain('cocktails');
  });
});

describe('drink names', () => {
  it('leaves out drinks with crude names but keeps innocent look-alikes', () => {
    const named = (strDrink: string) => ({ strDrink }) as RawDrink;
    const kept = cleanDrinks([named('Royal Bitch'), named('Brass Monkey'), named('Grasshopper'), named('Orgasm')]).map((d) => d.strDrink);
    expect(kept).toEqual(['Brass Monkey', 'Grasshopper']);
  });
});
