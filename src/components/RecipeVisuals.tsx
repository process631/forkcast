import { useEffect, useState } from 'react';
import { imageCacheKey, type ImageSlot } from '../lib/ai';
import { hasFish, hasMeat } from '../lib/diet';
import { imagesStore, loadCachedImage, requestImage } from '../lib/images';
import { ingredientsInStep } from '../lib/parse';
import { findFreePhoto } from '../lib/photos';
import { aiEnabled, appMode, settingsStore, updateRecipeEverywhere, useStore } from '../lib/store';
import type { Recipe } from '../lib/types';
import { PictureHandoff } from './GeminiHandoff';
import { DishThumb } from './RecipeCard';
import { EmojiArt, Img } from './ui';

/** The big dish photo at the top of a recipe. */
export function DishHero({ recipe }: { recipe: Recipe }) {
  const settings = useStore(settingsStore);
  const images = useStore(imagesStore);
  const [photo, setPhoto] = useState<Pick<Recipe, 'image' | 'imageCredit'>>({ image: recipe.image, imageCredit: recipe.imageCredit });
  const [panel, setPanel] = useState(false);
  const ai = images[imageCacheKey(recipe.id, 'dish')];
  const hasKey = aiEnabled(settings);
  const app = appMode(settings);
  const isAi = recipe.source === 'ai';

  useEffect(() => {
    setPhoto({ image: recipe.image, imageCredit: recipe.imageCredit });
  }, [recipe.id, recipe.image, recipe.imageCredit]);

  const fetchFreePhoto = async () => {
    if (recipe.image) return;
    const names = recipe.ingredients.map((i) => i.name);
    const found = await findFreePhoto(recipe.title, { meatFree: !hasMeat(names) && !hasFish(names) }).catch(() => null);
    if (!found) return;
    setPhoto({ image: found.url, imageCredit: found.credit });
    updateRecipeEverywhere({ ...recipe, image: found.url, imageCredit: found.credit });
  };

  useEffect(() => {
    if (!isAi) return;
    let cancelled = false;
    void (async () => {
      const cached = await loadCachedImage(recipe, 'dish');
      if (cancelled || cached) return;
      if (hasKey && settings.aiImages !== 'off') requestImage(recipe, 'dish');
      else void fetchFreePhoto();
    })();
    return () => {
      cancelled = true;
    };
  }, [recipe.id]);

  // If the AI photo fails (e.g. no billing on the key), fall back to a free photo.
  useEffect(() => {
    if (ai?.status === 'error') void fetchFreePhoto();
  }, [ai?.status]);

  const src = ai?.url || photo.image;
  const credit = ai?.url
    ? { text: '✨ Picture made with Google Gemini' }
    : photo.imageCredit ?? (recipe.source === 'library' ? { text: 'Photo: TheMealDB', url: 'https://www.themealdb.com' } : undefined);

  return (
    <figure className="dish-hero">
      <div className="dish-hero-frame">
        <Img src={src} alt={recipe.title} className="dish-hero-img" loading="eager" fallback={<EmojiArt emoji={recipe.emoji} title={recipe.title} className="dish-hero-img" />} />
        {ai?.status === 'loading' && (
          <div className="image-overlay">
            <span className="spinner" aria-hidden="true" /> Plating your dish (AI photo)…
          </div>
        )}
        {isAi && hasKey && ai?.status !== 'loading' && (
          <button type="button" className="btn btn-sm btn-glass hero-regen" onClick={() => requestImage(recipe, 'dish', Boolean(ai?.url))}>
            {ai?.url ? '🔄 New AI photo' : '✨ AI photo'}
          </button>
        )}
        {isAi && app && (
          <button type="button" className="btn btn-sm btn-glass hero-regen no-print" onClick={() => setPanel((p) => !p)} aria-expanded={panel}>
            {panel ? 'Close' : ai?.url ? '🖼️ New Gemini picture' : '🖼️ Make a Gemini picture'}
          </button>
        )}
      </div>
      {panel && <PictureHandoff recipe={recipe} slot="dish" onDone={() => setPanel(false)} />}
      {(credit || ai?.status === 'error') && (
        <figcaption className="credit">
          {ai?.status === 'error' && <span className="credit-error">AI photo failed: {ai.error} </span>}
          {credit && (credit.url ? <a href={credit.url} target="_blank" rel="noreferrer">{credit.text}</a> : credit.text)}
        </figcaption>
      )}
    </figure>
  );
}

/** Picture for one step: an AI image if there is one, otherwise the ingredients used in that step. */
export function StepVisual({ recipe, index, large = false }: { recipe: Recipe; index: number; large?: boolean }) {
  const settings = useStore(settingsStore);
  const images = useStore(imagesStore);
  const [panel, setPanel] = useState(false);
  const slot: ImageSlot = `step-${index}`;
  const state = images[imageCacheKey(recipe.id, slot)];
  const hasKey = aiEnabled(settings);
  const app = appMode(settings);
  const step = recipe.steps[index];

  useEffect(() => {
    setPanel(false);
    let cancelled = false;
    void loadCachedImage(recipe, slot).then((found) => {
      if (!cancelled && !found && hasKey && settings.aiImages === 'steps') requestImage(recipe, slot);
    });
    return () => {
      cancelled = true;
    };
  }, [recipe.id, index]);

  if (!step) return null;

  // With a key the app draws the picture; in Gemini-app mode the person makes it in Gemini and brings it back.
  const draw = () => (hasKey ? requestImage(recipe, slot, Boolean(state?.url)) : setPanel((p) => !p));
  const handoff = panel && <PictureHandoff recipe={recipe} slot={slot} onDone={() => setPanel(false)} />;

  if (state?.url) {
    return (
      <figure className={`step-visual${large ? ' step-visual-lg' : ''}`}>
        <img src={state.url} alt={`Step ${index + 1}: ${step.title ?? step.text.slice(0, 80)}`} className="step-img" />
        <figcaption className="credit">
          ✨ Picture made with Gemini
          {(hasKey || app) && (
            <button type="button" className="link-btn small no-print" onClick={draw} disabled={state.status === 'loading'}>
              {state.status === 'loading' ? 'redrawing…' : panel ? 'close' : '🔄 replace'}
            </button>
          )}
        </figcaption>
        {handoff}
      </figure>
    );
  }

  if (state?.status === 'loading') {
    return (
      <div className={`step-visual step-visual-loading shimmer${large ? ' step-visual-lg' : ''}`}>
        <span className="spinner" aria-hidden="true" /> Drawing step {index + 1}…
      </div>
    );
  }

  const used = ingredientsInStep(step.text, recipe.ingredients, large ? 6 : 5);
  const drawButton = (hasKey || app) && (
    <button type="button" className="btn btn-sm btn-soft step-gen no-print" onClick={draw} aria-expanded={app ? panel : undefined}>
      {panel ? 'Close' : app ? '🖼️ Picture this step' : '✨ Picture this step'}
    </button>
  );
  const error = state?.status === 'error' && <p className="credit-error small">{state.error}</p>;

  // Cook mode has room for a big picture: show the finished dish with this step's ingredients on top.
  if (large) {
    return (
      <div className="step-fallback">
        <div className="step-fallback-media">
          <DishThumb recipe={recipe} className="step-img" />
          <span className="media-badge">The finished dish</span>
          {used.length > 0 && (
            <div className="step-fallback-strip" aria-label="Ingredients in this step">
              {used.map((ing) => (
                <figure key={ing.name} className="ing-thumb" title={`${ing.measure} ${ing.name}`.trim()}>
                  <Img src={ing.image} alt="" className="ing-thumb-img" fallback={<span className="ing-thumb-fallback">🥄</span>} />
                  <figcaption>{ing.name}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
        {drawButton}
        {handoff}
        {error}
      </div>
    );
  }

  if (!used.length && !drawButton) return null;
  return (
    <>
      <div className="step-ingredients">
        {used.map((ing) => (
          <figure key={ing.name} className="ing-thumb" title={`${ing.measure} ${ing.name}`.trim()}>
            <Img src={ing.image} alt="" className="ing-thumb-img" fallback={<span className="ing-thumb-fallback">🥄</span>} />
            <figcaption>{ing.name}</figcaption>
          </figure>
        ))}
        {drawButton}
        {error}
      </div>
      {handoff}
    </>
  );
}

/** Click-to-load YouTube player (no YouTube requests until you press play). */
export function VideoEmbed({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <div className="video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={`Video: ${title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <button type="button" className="video video-facade" onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`}>
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
      <span className="play-btn" aria-hidden="true">▶</span>
    </button>
  );
}
