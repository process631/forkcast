import { useEffect, useRef, useState } from 'react';
import { ingredientsInStep } from '../lib/parse';
import { cookbookStore, toggleSaved, useStore } from '../lib/store';
import type { Recipe } from '../lib/types';
import { useRecipe } from '../lib/useRecipe';
import { href, navigate } from '../router';
import { DishHero, StepVisual } from './RecipeVisuals';
import { StepTimerButtons } from './Timers';
import { ErrorBox, Img, Spinner } from './ui';

export function CookMode({ id, step }: { id: string; step?: string }) {
  const state = useRecipe(id, { trackRecent: false });
  if (state.status === 'loading') {
    return (
      <div className="cook-mode">
        <div className="center-page">
          <Spinner label={state.message} />
        </div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="container page">
        <ErrorBox title="Couldn’t open cook mode">{state.message}</ErrorBox>
      </div>
    );
  }
  return <CookView recipe={state.recipe} initialStep={Number(step) || 0} />;
}

/** Keep the screen on while cooking (where the browser supports it). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = 'wakeLock' in navigator ? await navigator.wakeLock.request('screen') : null;
      } catch {
        lock = null;
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && void request();
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

function CookView({ recipe, initialStep }: { recipe: Recipe; initialStep: number }) {
  const total = recipe.steps.length;
  const [index, setIndex] = useState(Math.min(Math.max(initialStep, 0), total));
  const [showIngredients, setShowIngredients] = useState(false);
  const { saved } = useStore(cookbookStore);
  const touchX = useRef<number | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  useWakeLock();

  const go = (i: number) => {
    const next = Math.min(Math.max(i, 0), total);
    setIndex(next);
    navigate(`/cook/${recipe.id}/${next}`, { replace: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'Escape') navigate(`/recipe/${recipe.id}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    textRef.current?.focus();
    window.scrollTo(0, 0);
  }, [index]);

  const step = recipe.steps[index];
  const done = index >= total;
  const used = step ? ingredientsInStep(step.text, recipe.ingredients, 8) : [];

  return (
    <div
      className="cook-mode"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 70) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="cook-top">
        <a href={href(`/recipe/${recipe.id}`)} className="btn btn-ghost btn-sm" aria-label="Exit cook mode">
          Exit
        </a>
        <div className="cook-title">
          <span className="cook-recipe">{recipe.title}</span>
          <span className="cook-count">{done ? 'All done!' : `Step ${index + 1} of ${total}`}</span>
        </div>
        <button type="button" className="btn btn-sm btn-soft" onClick={() => setShowIngredients((s) => !s)} aria-expanded={showIngredients}>
          Ingredients
        </button>
      </div>
      <div className="cook-progress">
        {recipe.steps.map((_, i) => (
          <button key={i} type="button" className={`cook-dot${i < index ? ' past' : i === index ? ' current' : ''}`} onClick={() => go(i)} aria-label={`Go to step ${i + 1}`} />
        ))}
      </div>

      {showIngredients && (
        <div className="cook-drawer">
          <ul>
            {recipe.ingredients.map((ing, i) => (
              <li key={`${ing.name}-${i}`} className={used.includes(ing) ? 'in-step' : ''}>
                <Img src={ing.image} alt="" className="ing-img" fallback={<span className="ing-img ing-img-fallback">🥄</span>} />
                <span>
                  {ing.measure && <strong>{ing.measure} </strong>}
                  {ing.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <main className="cook-main">
        {done ? (
          <div className="cook-done">
            <DishHero recipe={recipe} />
            <h1>Enjoy your {recipe.title}</h1>
            <p className="muted">Nice work, chef.</p>
            <div className="row center">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => !saved.some((e) => e.recipe.id === recipe.id) && toggleSaved(recipe)}>
                {saved.some((e) => e.recipe.id === recipe.id) ? 'Saved to cookbook' : 'Save to cookbook'}
              </button>
              <a href={href('/plan')} className="btn btn-ghost btn-lg">
                Cook something else
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="cook-visual">
              <StepVisual recipe={recipe} index={index} large />
            </div>
            <div className="cook-text" ref={textRef} tabIndex={-1} aria-live="polite">
              {step.title && <h2 className="cook-step-title">{step.title}</h2>}
              <p>{step.text}</p>
              {used.length > 0 && (
                <div className="cook-uses">
                  {used.map((u) => (
                    <span key={u.name} className="chip">
                      {u.measure ? `${u.measure} ` : ''}
                      {u.name}
                    </span>
                  ))}
                </div>
              )}
              <StepTimerButtons text={step.text} label={`Step ${index + 1}: ${step.title ?? recipe.title}`} />
            </div>
          </>
        )}
      </main>

      <div className="cook-nav">
        <button type="button" className="btn btn-ghost btn-lg" onClick={() => go(index - 1)} disabled={index === 0}>
          Previous
        </button>
        {!done && (
          <button type="button" className="btn btn-primary btn-lg" onClick={() => go(index + 1)}>
            {index === total - 1 ? 'Finish' : 'Next step'}
          </button>
        )}
      </div>
    </div>
  );
}
