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
  | { id: 'pantry' };

const SWEET_CATEGORIES = new Set(['sweet', 'cakes', 'cookies', 'chocolate', 'fruity', 'pies', 'puddings', 'pancakes']);

export function buildScreens(a: Answers): Screen[] {
  const screens: Screen[] = [];
  const cat = getCategory(a.category);
  if (cat?.question) screens.push({ id: 'style', question: cat.question });
  screens.push({ id: 'time' }, { id: 'skill' }, { id: 'diet' });
  // Flavor moods like "spicy" or "garlicky" don't make sense for desserts.
  if (a.meal !== 'dessert' && !SWEET_CATEGORIES.has(a.category ?? '')) screens.push({ id: 'mood' });
  screens.push({ id: 'cuisine' }, { id: 'pantry' });
  return screens;
}
