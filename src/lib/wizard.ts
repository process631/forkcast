import { navigate } from '../router';
import { EMPTY_ANSWERS, answersStore, dietMemory } from './store';
import type { MealId } from './types';

/** Start a fresh round of questions, keeping remembered diets and dislikes. */
export function startWizard(meal?: MealId) {
  const remembered = dietMemory.get();
  answersStore.set({ ...EMPTY_ANSWERS, diets: remembered.diets, avoid: remembered.avoid, meal: meal ?? null });
  navigate(meal ? '/plan/kind' : '/plan');
}
