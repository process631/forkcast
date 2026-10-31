import { useState } from 'react';
import { ingredientsInStep } from '../lib/parse';
import type { Recipe } from '../lib/types';
import { YOUTUBE_ID } from '../lib/urls';
import { EmojiArt, Img } from './ui';

/** The big dish photo at the top of a recipe. */
export function DishHero({ recipe }: { recipe: Recipe }) {
  return (
    <figure className="dish-hero">
      <div className="dish-hero-frame">
        <Img src={recipe.image} alt={recipe.title} className="dish-hero-img" loading="eager" fallback={<EmojiArt title={recipe.title} className="dish-hero-img" />} />
      </div>
      <figcaption className="credit">
        <a href="https://www.themealdb.com" target="_blank" rel="noreferrer">
          Photo: TheMealDB
        </a>
      </figcaption>
    </figure>
  );
}

/** The ingredients a step uses, as small pictures. In cook mode: the finished dish with them on top. */
export function StepVisual({ recipe, index, large = false }: { recipe: Recipe; index: number; large?: boolean }) {
  const step = recipe.steps[index];
  if (!step) return null;
  const used = ingredientsInStep(step.text, recipe.ingredients, large ? 6 : 5);
  const thumbs = used.map((ing) => (
    <figure key={ing.name} className="ing-thumb" title={`${ing.measure} ${ing.name}`.trim()}>
      <Img src={ing.image} alt="" className="ing-thumb-img" fallback={<span className="ing-thumb-fallback">🥄</span>} />
      <figcaption>{ing.name}</figcaption>
    </figure>
  ));

  if (large) {
    return (
      <div className="step-fallback">
        <div className="step-fallback-media">
          <Img src={recipe.image} alt={recipe.title} className="step-img" fallback={<EmojiArt title={recipe.title} className="step-img" />} />
          <span className="media-badge">The finished dish</span>
          {used.length > 0 && (
            <div className="step-fallback-strip" aria-label="Ingredients in this step">
              {thumbs}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!used.length) return null;
  return <div className="step-ingredients">{thumbs}</div>;
}

/** Click-to-load YouTube player (no YouTube requests until you press play). */
export function VideoEmbed({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  if (!YOUTUBE_ID.test(id)) return null;
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
