import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from './storage';
import type { AiIdea, Answers, Recipe, Settings, Suggestion } from './types';

/** A tiny observable store, optionally persisted to local/session storage. */
export function createStore<T>(initial: T, persist?: { key: string; storage?: 'local' | 'session' }) {
  const stored = persist ? readJSON<T | null>(persist.key, null, persist.storage) : null;
  // Objects get new default fields merged in; arrays are taken as stored.
  let state: T = stored === null ? initial : Array.isArray(initial) ? stored : { ...initial, ...stored };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
      if (persist) writeJSON(persist.key, state, persist.storage);
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T>(store: ReturnType<typeof createStore<T>>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/* ------------------------------ Settings ------------------------------ */

export const DEFAULT_TEXT_MODEL = 'gemini-3.8-flash';
export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';

export const settingsStore = createStore<Settings>(
  // AI pictures are off by default: they're paid-only on the Gemini API.
  { aiMode: 'app', geminiKey: '', textModel: DEFAULT_TEXT_MODEL, imageModel: DEFAULT_IMAGE_MODEL, aiIdeas: true, aiImages: 'off' },
  { key: 'forkcast.settings' },
);

// Settings saved before AI modes existed: a saved key meant the API was in use.
if (!readJSON<Partial<Settings>>('forkcast.settings', {}).aiMode && settingsStore.get().geminiKey) {
  settingsStore.set((s) => ({ ...s, aiMode: 'api' }));
}

/** Automatic AI through the Gemini API (needs a key). */
export function aiEnabled(s: Settings = settingsStore.get()): boolean {
  return s.aiMode === 'api' && Boolean(s.geminiKey.trim());
}

/** Copy & paste with the Gemini app. */
export function appMode(s: Settings = settingsStore.get()): boolean {
  return s.aiMode === 'app';
}

/* ------------------------------ Wizard ------------------------------ */

export const EMPTY_ANSWERS: Answers = {
  meal: null,
  category: null,
  styles: [],
  moods: [],
  time: 'any',
  skill: 'any',
  cuisines: [],
  diets: [],
  include: [],
  avoid: [],
  servings: 2,
};

export const answersStore = createStore<Answers>(EMPTY_ANSWERS, { key: 'forkcast.answers', storage: 'session' });

/** Diets are remembered between visits — they rarely change. */
export const dietMemory = createStore<{ diets: string[]; avoid: string[] }>({ diets: [], avoid: [] }, { key: 'forkcast.diet' });

/* ------------------------------ Results ------------------------------ */

export interface ResultsState {
  /** Fingerprint of the answers these results were made for. */
  forAnswers: string;
  suggestions: Suggestion[];
  /** Ids/titles already shown, so "show different options" gives fresh ones. */
  shown: string[];
  round: number;
}

export const resultsStore = createStore<ResultsState>(
  { forAnswers: '', suggestions: [], shown: [], round: 0 },
  { key: 'forkcast.results', storage: 'session' },
);

export function answersFingerprint(a: Answers): string {
  return JSON.stringify(a);
}

/** AI ideas by key, so the recipe page can generate the full recipe after a refresh. */
export const ideasStore = createStore<Record<string, { idea: AiIdea; answers: Answers }>>({}, { key: 'forkcast.ideas', storage: 'session' });

/* ------------------------------ Recipes ------------------------------ */

const MAX_AI_RECIPES = 40;

export const aiRecipesStore = createStore<{ order: string[]; byId: Record<string, Recipe> }>(
  { order: [], byId: {} },
  { key: 'forkcast.aiRecipes' },
);

export function rememberAiRecipe(recipe: Recipe) {
  aiRecipesStore.set((prev) => {
    const order = [recipe.id, ...prev.order.filter((id) => id !== recipe.id)];
    const byId = { ...prev.byId, [recipe.id]: recipe };
    for (const id of order.splice(MAX_AI_RECIPES)) delete byId[id];
    return { order, byId };
  });
}

export interface CookbookEntry {
  recipe: Recipe;
  at: number;
}

export const cookbookStore = createStore<{ saved: CookbookEntry[]; recent: CookbookEntry[] }>(
  { saved: [], recent: [] },
  { key: 'forkcast.cookbook' },
);

export function isSaved(id: string): boolean {
  return cookbookStore.get().saved.some((e) => e.recipe.id === id);
}

export function toggleSaved(recipe: Recipe) {
  cookbookStore.set((prev) => {
    const exists = prev.saved.some((e) => e.recipe.id === recipe.id);
    return {
      ...prev,
      saved: exists ? prev.saved.filter((e) => e.recipe.id !== recipe.id) : [{ recipe, at: Date.now() }, ...prev.saved],
    };
  });
}

export function addRecent(recipe: Recipe) {
  cookbookStore.set((prev) => ({
    ...prev,
    recent: [{ recipe, at: Date.now() }, ...prev.recent.filter((e) => e.recipe.id !== recipe.id)].slice(0, 24),
    // Keep saved copies fresh (e.g. a photo found later).
    saved: prev.saved.map((e) => (e.recipe.id === recipe.id ? { ...e, recipe } : e)),
  }));
}

/** Save a changed recipe (e.g. a photo was found) everywhere a copy is kept. */
export function updateRecipeEverywhere(recipe: Recipe) {
  if (recipe.source === 'ai') rememberAiRecipe(recipe);
  cookbookStore.set((prev) => ({
    saved: prev.saved.map((e) => (e.recipe.id === recipe.id ? { ...e, recipe } : e)),
    recent: prev.recent.map((e) => (e.recipe.id === recipe.id ? { ...e, recipe } : e)),
  }));
}

/* ------------------------------ Timers ------------------------------ */

export interface Timer {
  id: string;
  label: string;
  endsAt: number;
  totalMs: number;
  done: boolean;
}

/** Saved so a refresh (or closing the tab) doesn't lose a running timer. */
export const timersStore = createStore<Timer[]>([], { key: 'forkcast.timers' });
