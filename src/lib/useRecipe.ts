import { useEffect, useState } from 'react';
import { getLibraryRecipe } from './library';
import { addRecent, cookbookStore } from './store';
import type { Recipe } from './types';

export type RecipeState =
  | { status: 'loading'; message: string }
  | { status: 'error'; message: string; retry?: () => void }
  | { status: 'ready'; recipe: Recipe };

/** A copy of the recipe kept on this device (saved or recently viewed). */
function findStored(id: string): Recipe | undefined {
  const { saved, recent } = cookbookStore.get();
  return saved.find((e) => e.recipe.id === id)?.recipe ?? recent.find((e) => e.recipe.id === id)?.recipe;
}

/** Load a recipe from the library, falling back to a saved copy when offline. */
export function useRecipe(id: string, { trackRecent = true } = {}): RecipeState {
  const [state, setState] = useState<RecipeState>({ status: 'loading', message: 'Loading recipe…' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const done = (recipe: Recipe) => {
      if (cancelled) return;
      setState({ status: 'ready', recipe });
      if (trackRecent) addRecent(recipe);
    };
    const fail = (e: unknown) => !cancelled && setState({ status: 'error', message: (e as Error).message, retry: () => setAttempt((a) => a + 1) });

    setState({ status: 'loading', message: 'Loading recipe…' });
    getLibraryRecipe(id)
      .then((r) => {
        // Not in the library (e.g. saved from an older version of the app): use the saved copy.
        const found = r ?? findStored(id);
        if (found) done(found);
        else fail(new Error('We couldn’t find that recipe.'));
      })
      .catch((e) => {
        // Offline? A saved copy is better than an error.
        const stored = findStored(id);
        if (stored) done(stored);
        else fail(e);
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt, trackRecent]);

  return state;
}
