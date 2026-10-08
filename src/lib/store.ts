import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from './storage';
import type { Answers, Recipe, Suggestion } from './types';

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

/* ------------------------------ Cookbook ------------------------------ */

export interface CookbookEntry {
  recipe: Recipe;
  at: number;
}

export const cookbookStore = createStore<{ saved: CookbookEntry[]; recent: CookbookEntry[] }>(
  { saved: [], recent: [] },
  { key: 'forkcast.cookbook' },
);

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
    // Keep saved copies fresh.
    saved: prev.saved.map((e) => (e.recipe.id === recipe.id ? { ...e, recipe } : e)),
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
