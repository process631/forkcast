import { useState } from 'react';
import { MEALS } from '../data/taxonomy';
import { loadLibrary } from '../lib/mealdb';
import { randomPick } from '../lib/match';
import { aiEnabled, appMode, cookbookStore, dietMemory, settingsStore, useStore } from '../lib/store';
import type { MealId } from '../lib/types';
import { startWizard } from '../lib/wizard';
import { href, navigate } from '../router';
import { RecipeTile } from './RecipeCard';

export function Home() {
  const settings = useStore(settingsStore);
  const { recent, saved } = useStore(cookbookStore);
  const [surprising, setSurprising] = useState(false);
  const [error, setError] = useState('');

  async function surprise() {
    setSurprising(true);
    setError('');
    try {
      const pick = randomPick(await loadLibrary(), { diets: dietMemory.get().diets });
      if (pick) navigate(`/recipe/${pick.recipe.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSurprising(false);
    }
  }

  const hour = new Date().getHours();
  const suggestedMeal: MealId = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 21 ? 'dinner' : 'snack';

  return (
    <div className="container page">
      <section className="hero">
        <p className="eyebrow">Your kitchen sidekick</p>
        <h1>What should I cook today?</h1>
        <p className="lead">Answer a few quick questions and get recipes picked for you, with step-by-step photos, timers and a hands-free cook mode.</p>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => startWizard()}>
            Help me decide →
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={surprise} disabled={surprising}>
            {surprising ? 'Rolling the dice…' : '🎲 Surprise me'}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        {!aiEnabled(settings) && !appMode(settings) && (
          <p className="hero-note">
            Works free out of the box with 790+ real recipes. <a href={href('/settings')}>Turn on the Gemini AI chef</a> for recipes made for your exact answers.
          </p>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Start with a meal</h2>
        <div className="option-grid option-grid-lg">
          {MEALS.map((m) => (
            <button key={m.id} type="button" className={`option-card${m.id === suggestedMeal ? ' option-suggested' : ''}`} onClick={() => startWizard(m.id as MealId)}>
              <span className="option-emoji" aria-hidden="true">{m.emoji}</span>
              <span className="option-label">{m.label}</span>
              <span className="option-hint">{m.id === suggestedMeal ? 'Perfect for right now' : m.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {(recent.length > 0 || saved.length > 0) && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">{saved.length ? 'Your saved recipes' : 'Recently viewed'}</h2>
            <a href={href('/cookbook')} className="link">Open cookbook →</a>
          </div>
          <div className="tile-row">
            {(saved.length ? saved : recent).slice(0, 8).map((e) => (
              <RecipeTile key={e.recipe.id} recipe={e.recipe} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
