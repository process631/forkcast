import { useEffect, useState } from 'react';
import { imageCacheKey } from '../lib/ai';
import { imagesStore, requestImage } from '../lib/images';
import { aiEnabled, cookbookStore, settingsStore, toggleSaved, useStore } from '../lib/store';
import type { Recipe } from '../lib/types';
import { useRecipe } from '../lib/useRecipe';
import { goBack, href } from '../router';
import { DishHero, StepVisual, VideoEmbed } from './RecipeVisuals';
import { StepTimerButtons } from './Timers';
import { ErrorBox, Img, RecipeMeta, Spinner } from './ui';

export function RecipePage({ id }: { id: string }) {
  const state = useRecipe(id);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (state.status === 'loading') {
    return (
      <div className="container page center-page">
        <div className="cooking-loader" aria-hidden="true">🍳</div>
        <Spinner label={state.message} />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="container page">
        <ErrorBox
          title="Couldn’t open this recipe"
          action={
            <div className="row">
              {state.retry && (
                <button type="button" className="btn btn-primary btn-sm" onClick={state.retry}>
                  Try again
                </button>
              )}
              <a href={href('/results')} className="btn btn-ghost btn-sm">
                Back to options
              </a>
            </div>
          }
        >
          {state.message}
        </ErrorBox>
      </div>
    );
  }
  return <RecipeView recipe={state.recipe} />;
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  const settings = useStore(settingsStore);
  const { saved } = useStore(cookbookStore);
  const images = useStore(imagesStore);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const isSaved = saved.some((e) => e.recipe.id === recipe.id);
  const hasKey = aiEnabled(settings);
  const stepImages = recipe.steps.map((_, i) => images[imageCacheKey(recipe.id, `step-${i}`)]);
  const drawn = stepImages.filter((s) => s?.url).length;
  const drawing = stepImages.some((s) => s?.status === 'loading');

  const toggleCheck = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const copyList = async () => {
    const text = [`${recipe.title} — shopping list`, ...recipe.ingredients.map((i) => `☐ ${i.measure ? `${i.measure} ` : ''}${i.name}`)].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy your shopping list:', text);
    }
  };

  return (
    <article className="container page recipe">
      <button type="button" className="btn btn-ghost btn-sm back-btn no-print" onClick={() => goBack('/results')}>
        ← Back
      </button>

      <header className="recipe-header">
        <DishHero recipe={recipe} />
        <div className="recipe-intro">
          <p className="eyebrow">
            {recipe.source === 'ai' ? '✨ Written by your AI chef' : `📚 ${recipe.category ?? 'Recipe'} · TheMealDB`}
          </p>
          <h1 className="recipe-title">{recipe.title}</h1>
          {recipe.description && <p className="lead">{recipe.description}</p>}
          <RecipeMeta recipe={recipe} />
          <div className="recipe-actions no-print">
            <a href={href(`/cook/${recipe.id}`)} className="btn btn-primary btn-lg">
              👩‍🍳 Start cooking
            </a>
            <button type="button" className={`btn btn-lg ${isSaved ? 'btn-saved' : 'btn-ghost'}`} onClick={() => toggleSaved(recipe)} aria-pressed={isSaved}>
              {isSaved ? '❤️ Saved' : '🤍 Save'}
            </button>
          </div>
          <div className="recipe-actions-secondary no-print">
            {hasKey && (
              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={drawing || drawn === recipe.steps.length}
                onClick={() => recipe.steps.forEach((_, i) => requestImage(recipe, `step-${i}`))}
                title="Uses your Gemini key to draw a picture for each step"
              >
                {drawing ? `✨ Drawing steps… (${drawn}/${recipe.steps.length})` : drawn === recipe.steps.length ? '✨ All steps illustrated' : `✨ Picture every step (${recipe.steps.length})`}
              </button>
            )}
            {recipe.youtube && (
              <a href="#video" className="btn btn-soft btn-sm" onClick={(e) => { e.preventDefault(); document.getElementById('video')?.scrollIntoView({ behavior: 'smooth' }); }}>
                ▶ Watch the video
              </a>
            )}
            <button type="button" className="btn btn-soft btn-sm" onClick={copyList}>
              {copied ? '✓ Copied!' : '🛒 Copy shopping list'}
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => window.print()}>
              🖨️ Print
            </button>
          </div>
        </div>
      </header>

      <div className="recipe-body">
        <aside className="ingredients-panel">
          <h2>Ingredients</h2>
          {recipe.servings && <p className="muted small">For {recipe.servings} serving{recipe.servings === 1 ? '' : 's'}</p>}
          <ul className="ingredient-list">
            {recipe.ingredients.map((ing, i) => (
              <li key={`${ing.name}-${i}`} className={checked.has(i) ? 'checked' : ''}>
                <label>
                  <input type="checkbox" checked={checked.has(i)} onChange={() => toggleCheck(i)} />
                  <Img src={ing.image} alt="" className="ing-img" fallback={<span className="ing-img ing-img-fallback">🥄</span>} />
                  <span className="ing-text">
                    {ing.measure && <strong>{ing.measure} </strong>}
                    {ing.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {recipe.equipment && recipe.equipment.length > 0 && (
            <>
              <h3>Equipment</h3>
              <ul className="equipment-list">
                {recipe.equipment.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <section className="steps-panel">
          <h2>Step by step</h2>
          <ol className="step-list">
            {recipe.steps.map((step, i) => (
              <li key={i} className="step-card">
                <div className="step-num" aria-hidden="true">
                  {i + 1}
                </div>
                <div className="step-content">
                  {step.title && <h3 className="step-title">{step.title}</h3>}
                  <p className="step-text">{step.text}</p>
                  <StepTimerButtons text={step.text} minutes={recipe.source === 'ai' ? step.minutes : undefined} label={`Step ${i + 1}: ${step.title ?? recipe.title}`} />
                  <StepVisual recipe={recipe} index={i} />
                </div>
              </li>
            ))}
          </ol>

          {recipe.tips && recipe.tips.length > 0 && (
            <div className="tips">
              <h2>Chef’s tips</h2>
              <ul>
                {recipe.tips.map((t) => (
                  <li key={t}>💡 {t}</li>
                ))}
              </ul>
            </div>
          )}

          {recipe.youtube && (
            <div className="video-block no-print" id="video">
              <h2>Watch it being made</h2>
              <VideoEmbed id={recipe.youtube} title={recipe.title} />
            </div>
          )}

          <footer className="recipe-footer">
            {recipe.source === 'ai' ? (
              <p className="fine-print">This recipe was written by Google Gemini based on your answers. Check allergens and cooking temperatures, since AI can make mistakes.</p>
            ) : (
              <p className="fine-print">
                Recipe from <a href="https://www.themealdb.com" target="_blank" rel="noreferrer">TheMealDB</a>
                {recipe.sourceUrl && (
                  <>
                    {' '}· <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">Original source</a>
                  </>
                )}
                . Times and difficulty are Forkcast estimates.
              </p>
            )}
          </footer>
        </section>
      </div>
    </article>
  );
}
