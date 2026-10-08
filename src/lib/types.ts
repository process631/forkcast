export type MealId = 'breakfast' | 'lunch' | 'dinner' | 'side' | 'snack' | 'dessert';

export type TimeId = 'quick' | 'medium' | 'long' | 'any';
export type SkillId = 'easy' | 'medium' | 'hard' | 'any';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/** Everything the wizard collects. Empty arrays / 'any' mean "no preference". */
export interface Answers {
  meal: MealId | null;
  category: string | null;
  styles: string[];
  moods: string[];
  time: TimeId;
  skill: SkillId;
  cuisines: string[];
  diets: string[];
  include: string[];
  avoid: string[];
}

export interface Ingredient {
  name: string;
  measure: string;
  /** Picture of the ingredient (TheMealDB ingredient images). */
  image?: string;
}

export interface Step {
  title?: string;
  text: string;
  /** Minutes this step takes, if known. */
  minutes?: number;
}

export interface Recipe {
  /** 'mdb-<id>' for TheMealDB recipes. */
  id: string;
  title: string;
  image?: string;
  category?: string;
  cuisine?: string;
  /** Cuisine group id from the taxonomy. */
  cuisineGroup?: string;
  tags: string[];
  totalMinutes: number;
  /** True when the time includes long passive time (chilling, marinating, rising). */
  hasPassiveTime?: boolean;
  difficulty: Difficulty;
  ingredients: Ingredient[];
  steps: Step[];
  youtube?: string;
  sourceUrl?: string;
}

/** A recipe picked for the person's answers, with the reasons it fits. */
export interface Suggestion {
  recipe: Recipe;
  reasons: string[];
  score: number;
  /** Doesn't fit every answer; the closest the library has. */
  close?: boolean;
}
