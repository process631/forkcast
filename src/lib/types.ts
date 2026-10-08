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
  servings: number;
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
  /** Minutes this step takes, if known (used for timers). */
  minutes?: number;
  /** Prompt for generating a picture of this step with AI. */
  imagePrompt?: string;
  tip?: string;
}

export interface ImageCredit {
  text: string;
  url?: string;
}

export interface Recipe {
  /** 'mdb-<id>' for library recipes, 'ai-<hash>' for AI recipes. */
  id: string;
  source: 'library' | 'ai';
  title: string;
  description?: string;
  image?: string;
  imageCredit?: ImageCredit;
  category?: string;
  cuisine?: string;
  /** Cuisine group id from the taxonomy. */
  cuisineGroup?: string;
  tags: string[];
  servings?: number;
  totalMinutes: number;
  /** True when the time includes long passive time (chilling, marinating, rising). */
  hasPassiveTime?: boolean;
  difficulty: Difficulty;
  ingredients: Ingredient[];
  steps: Step[];
  equipment?: string[];
  tips?: string[];
  youtube?: string;
  sourceUrl?: string;
  emoji?: string;
}

/** A short AI idea shown on the results page before the full recipe exists. */
export interface AiIdea {
  key: string;
  title: string;
  emoji: string;
  description: string;
  cuisine: string;
  totalMinutes: number;
  difficulty: Difficulty;
  reasons: string[];
  keyIngredients: string[];
}

export type Suggestion =
  | { kind: 'library'; recipe: Recipe; reasons: string[]; score: number; close?: boolean }
  | { kind: 'ai'; idea: AiIdea; reasons: string[] };

export interface Settings {
  /**
   * How the AI chef runs:
   * - off: free recipe library only
   * - app: copy & paste with the Gemini app (uses the person's own Gemini plan, no key, no cost)
   * - api: automatic, with a Gemini API key
   */
  aiMode: 'off' | 'app' | 'api';
  geminiKey: string;
  textModel: string;
  imageModel: string;
  /** Use Gemini to invent tailored recipe ideas. */
  aiIdeas: boolean;
  /** off: never generate; dish: auto-generate dish photos; steps: also auto-generate step photos. */
  aiImages: 'off' | 'dish' | 'steps';
}
