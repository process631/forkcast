import { describe, expect, it } from 'vitest';
import { mentionsAny, violatesDiet } from './diet';

describe('violatesDiet', () => {
  it('keeps meat and fish out of vegetarian dishes', () => {
    expect(violatesDiet(['Spaghetti', 'Minced Beef'], ['vegetarian'])).toBe('vegetarian');
    expect(violatesDiet(['Pilchards', 'Tomatoes'], ['vegetarian'])).toBe('vegetarian');
    expect(violatesDiet(['Worcestershire Sauce'], ['vegetarian'])).toBe('vegetarian');
    expect(violatesDiet(['Eggplant', 'Butternut Squash', 'Feta'], ['vegetarian'])).toBeNull();
  });

  it('allows fish but not meat for pescatarians', () => {
    expect(violatesDiet(['Salmon', 'Lemon'], ['pescatarian'])).toBeNull();
    expect(violatesDiet(['Bacon'], ['pescatarian'])).toBe('pescatarian');
  });

  it('treats plant milks and peanut butter as dairy-free', () => {
    expect(violatesDiet(['Coconut Milk', 'Peanut Butter', 'Butter Beans'], ['dairy-free'])).toBeNull();
    expect(violatesDiet(['Double Cream'], ['dairy-free'])).toBe('dairy-free');
  });

  it('checks vegan for dairy, eggs and honey too', () => {
    expect(violatesDiet(['Tofu', 'Soy Milk', 'Eggplant'], ['vegan'])).toBeNull();
    expect(violatesDiet(['Tofu', 'Honey'], ['vegan'])).toBe('vegan');
    expect(violatesDiet(['Eggs'], ['vegan'])).toBe('vegan');
  });

  it('knows gluten-free flours and tamari', () => {
    expect(violatesDiet(['Rice Flour', 'Tamari', 'Rice Noodles'], ['gluten-free'])).toBeNull();
    expect(violatesDiet(['Plain Flour'], ['gluten-free'])).toBe('gluten-free');
    expect(violatesDiet(['Soy Sauce'], ['gluten-free'])).toBe('gluten-free');
  });

  it('does not confuse nutmeg or coconut with nuts', () => {
    expect(violatesDiet(['Nutmeg', 'Coconut', 'Butternut Squash'], ['nut-free'])).toBeNull();
    expect(violatesDiet(['Ground Almonds'], ['nut-free'])).toBe('nut-free');
  });

  it('allows vinegar and ginger when avoiding alcohol', () => {
    expect(violatesDiet(['Red Wine Vinegar', 'Ginger'], ['no-alcohol'])).toBeNull();
    expect(violatesDiet(['White Wine'], ['no-alcohol'])).toBe('no-alcohol');
  });

  it('rejects desserts and starchy staples for low-carb', () => {
    expect(violatesDiet(['Chicken', 'Broccoli'], ['low-carb'])).toBeNull();
    expect(violatesDiet(['Spaghetti', 'Tomatoes'], ['low-carb'])).toBe('low-carb');
    expect(violatesDiet(['Cream'], ['low-carb'], 'Dessert')).toBe('low-carb');
  });
});

describe('mentionsAny', () => {
  it('matches plurals and multi-word words', () => {
    expect(mentionsAny(['Cherry Tomatoes', 'Minced Beef'], ['tomatoes', 'ground beef', 'olives'])).toEqual(['tomatoes', 'ground beef']);
  });
});
