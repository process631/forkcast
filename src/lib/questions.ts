import { getCategory, type Question } from '../data/taxonomy';
import type { Answers } from './types';

/** The adaptive question screens that follow the meal + category picks. */
export type Screen =
  | { id: 'style'; question: Question }
  | { id: 'mood' }
  | { id: 'time' }
  | { id: 'skill' }
  | { id: 'cuisine' }
  | { id: 'diet' }
  | { id: 'pantry' }
  | { id: 'servings' };

const SWEET_CATEGORIES = new Set(['sweet', 'cakes', 'cookies', 'chocolate', 'fruity', 'pies', 'puddings', 'pancakes']);

export function buildScreens(a: Answers, aiOn: boolean): Screen[] {
  const screens: Screen[] = [];
  const cat = getCategory(a.category);
  if (cat?.question) screens.push({ id: 'style', question: cat.question });
  // Flavor moods like "spicy" or "garlicky" don't make sense for desserts.
  if (a.meal !== 'dessert' && !SWEET_CATEGORIES.has(a.category ?? '')) screens.push({ id: 'mood' });
  screens.push({ id: 'time' }, { id: 'skill' }, { id: 'cuisine' }, { id: 'diet' }, { id: 'pantry' });
  // Library recipes have fixed amounts; only the AI chef scales to a serving count.
  if (aiOn) screens.push({ id: 'servings' });
  return screens;
}
