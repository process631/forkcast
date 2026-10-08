import { useEffect, useState } from 'react';
import { writeRecipe } from './ai';
import { getLibraryRecipe } from './mealdb';
import { addRecent, aiRecipesStore, cookbookStore, ideasStore, rememberAiRecipe } from './store';
import type { Recipe } from './types';

export type RecipeState =
  | { status: 'loading'; message: string }
  | { status: 'error'; message: string; retry?: () => void }
  | { status: 'ready'; recipe: Recipe };

const writing = new Map<string, Promise<Recipe>>();

/** A copy of the recipe kept on this device (AI recipes, saved and recently viewed ones). */
function findStored(id: string): Recipe | undefined {
  return aiRecipesStore.get().byId[id] ?? cookbookStore.get().saved.find((e) => e.recipe.id === id)?.recipe ?? cookbookStore.get().recent.find((e) => e.recipe.id === id)?.recipe;
}

/** AI recipes only exist as stored copies; library recipes are re-read so they stay current. */
function findKnown(id: string): Recipe | undefined {
  return id.startsWith('ai-') ? findStored(id) : undefined;
}

/** Load a recipe by id: from the library, from local AI recipes, or by asking the AI chef to write it. */
export function useRecipe(id: string, { trackRecent = true } = {}): RecipeState {
  const [state, setState] = useState<RecipeState>(() => {
    const known = findKnown(id);
    return known ? { status: 'ready', recipe: known } : { status: 'loading', message: 'Loading recipe…' };
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const done = (recipe: Recipe) => {
      if (cancelled) return;
      setState({ status: 'ready', recipe });
      if (trackRecent) addRecent(recipe);
    };
    const fail = (e: unknown) => !cancelled && setState({ status: 'error', message: (e as Error).message, retry: () => setAttempt((a) => a + 1) });

    const known = findKnown(id);
    if (known) {
      done(known);
      return;
    }

    if (id.startsWith('ai-')) {
      const entry = ideasStore.get()[id.slice(3)];
      if (!entry) {
        setState({ status: 'error', message: 'This AI recipe isn’t saved on this device anymore. Start a new search to get fresh ideas.' });
        return;
      }
      setState({ status: 'loading', message: `The AI chef is writing “${entry.idea.title}”…` });
      let job = writing.get(id);
      if (!job) {
        job = writeRecipe(entry.idea, entry.answers).then((recipe) => {
          rememberAiRecipe(recipe);
          return recipe;
        });
        writing.set(id, job);
        job.catch(() => undefined).finally(() => writing.delete(id));
      }
      job.then(done, fail);
    } else {
      setState({ status: 'loading', message: 'Loading recipe…' });
      getLibraryRecipe(id)
        .then((r) => (r ? done(r) : fail(new Error('We couldn’t find that recipe.'))))
        .catch((e) => {
          // Offline? A saved copy is better than an error.
          const stored = findStored(id);
          if (stored) done(stored);
          else fail(e);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [id, attempt, trackRecent]);

  return state;
}
