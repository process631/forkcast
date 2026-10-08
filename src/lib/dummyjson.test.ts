import { describe, expect, it } from 'vitest';
import { normalizeDummy, splitIngredient, type RawDummyRecipe } from './dummyjson';

const recipe = (r: Partial<RawDummyRecipe>): RawDummyRecipe => ({
  id: 1,
  name: 'Test',
  ingredients: ['Salt'],
  instructions: ['Mix.', 'Serve.'],
  mealType: ['Dinner'],
  ...r,
});

describe('DummyJSON recipes', () => {
  it('splits the prep note off ingredient names', () => {
    expect(splitIngredient('Tomatoes, diced')).toMatchObject({ name: 'Tomatoes', measure: 'diced' });
    expect(splitIngredient('Cachaça (Brazilian sugarcane spirit)').name).toBe('Cachaça');
  });

  it('maps a recipe into the shared library shape', () => {
    const item = normalizeDummy(
      recipe({ id: 21, name: 'Thai Green Curry', cuisine: 'Thai', ingredients: ['Chicken thighs, boneless', 'Coconut milk'], prepTimeMinutes: 15, cookTimeMinutes: 25, difficulty: 'Medium' }),
    );
    expect(item.recipe).toMatchObject({ id: 'djr-21', source: 'dummyjson', kind: 'food', category: 'Chicken', cuisineGroup: 'seasian', totalMinutes: 40, difficulty: 'Medium' });
    expect(item.recipe.steps).toHaveLength(2);
  });

  it('picks sensible categories', () => {
    const cat = (r: Partial<RawDummyRecipe>) => normalizeDummy(recipe(r)).category;
    expect(cat({ name: 'Italian Tiramisu', mealType: ['Dessert'] })).toBe('Dessert');
    expect(cat({ name: 'Bruschetta', mealType: ['Appetizer'] })).toBe('Starter');
    expect(cat({ name: 'Quinoa Salad', mealType: ['Lunch', 'Side Dish'] })).toBe('Side');
    expect(cat({ name: 'Shrimp Scampi Pasta', ingredients: ['Linguine pasta', 'Shrimp'] })).toBe('Pasta');
    expect(cat({ name: 'Greek Moussaka', ingredients: ['Eggplants', 'Ground lamb or beef'] })).toBe('Lamb');
    expect(cat({ name: 'Chickpea Tagine', ingredients: ['Chickpeas', 'Carrots'] })).toBe('Vegetarian');
  });

  it('turns beverages into drinks', () => {
    const lassi = normalizeDummy(recipe({ name: 'Mango Lassi', mealType: ['Beverage'], ingredients: ['Mango', 'Yogurt'] }));
    expect(lassi.kind).toBe('drink');
  });
});
