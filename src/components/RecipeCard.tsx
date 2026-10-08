import { useEffect } from 'react';
import { imageCacheKey } from '../lib/ai';
import { imagesStore, loadCachedImage } from '../lib/images';
import { formatMinutes } from '../lib/parse';
import { useStore } from '../lib/store';
import type { AiIdea, Recipe, Suggestion } from '../lib/types';
import { href } from '../router';
import { Chip, EmojiArt, Img } from './ui';

/** Photo for a recipe: library photo, cached AI photo, free photo, or emoji art. */
export function DishThumb({ recipe, className = '' }: { recipe: Recipe; className?: string }) {
  const images = useStore(imagesStore);
  const ai = images[imageCacheKey(recipe.id, 'dish')];
  useEffect(() => {
    if (recipe.source === 'ai') void loadCachedImage(recipe, 'dish');
  }, [recipe]);
  const src = ai?.url || recipe.image;
  const art = <EmojiArt emoji={recipe.emoji} title={recipe.title} className={className} />;
  return <Img src={src} alt={recipe.title} className={className} fallback={art} />;
}

export function SuggestionCard({ suggestion, index }: { suggestion: Suggestion; index: number }) {
  if (suggestion.kind === 'ai') return <IdeaCard idea={suggestion.idea} index={index} />;
  const { recipe, reasons, close } = suggestion;
  return (
    <a href={href(`/recipe/${recipe.id}`)} className="card suggestion-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="card-media">
        <DishThumb recipe={recipe} className="card-img" />
        {recipe.youtube && <span className="media-badge">▶ Video</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">{recipe.title}</h3>
        <div className="meta-row">
          <Chip>⏱️ {formatMinutes(recipe.totalMinutes)}</Chip>
          <Chip>{recipe.difficulty}</Chip>
          {recipe.cuisine && <Chip>{recipe.cuisine}</Chip>}
        </div>
        {reasons.length > 0 && (
          <ul className="reasons" aria-label="Why it matches">
            {reasons.map((r) => (
              <li key={r} className={close && r === 'Close match' ? 'reason-close' : ''}>
                {close && r === 'Close match' ? '≈' : '✓'} {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </a>
  );
}

function IdeaCard({ idea, index }: { idea: AiIdea; index: number }) {
  return (
    <a href={href(`/recipe/ai-${idea.key}`)} className="card suggestion-card idea-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="card-media">
        <EmojiArt emoji={idea.emoji} title={idea.title} className="card-img" />
        <span className="media-badge media-badge-ai">✨ Gemini</span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{idea.title}</h3>
        <p className="card-desc">{idea.description}</p>
        <div className="meta-row">
          <Chip>⏱️ {formatMinutes(idea.totalMinutes)}</Chip>
          <Chip>{idea.difficulty}</Chip>
          {idea.cuisine && <Chip>{idea.cuisine}</Chip>}
        </div>
        {idea.reasons.length > 0 && (
          <ul className="reasons" aria-label="Why it matches">
            {idea.reasons.map((r) => (
              <li key={r}>✓ {r}</li>
            ))}
          </ul>
        )}
      </div>
    </a>
  );
}

export function SkeletonCard() {
  return (
    <div className="card suggestion-card skeleton" aria-hidden="true">
      <div className="card-media shimmer" />
      <div className="card-body">
        <div className="shimmer line w70" />
        <div className="shimmer line w40" />
        <div className="shimmer line w90" />
      </div>
    </div>
  );
}

/** Small tile used on the home page and in the cookbook. */
export function RecipeTile({ recipe, onRemove }: { recipe: Recipe; onRemove?: () => void }) {
  return (
    <div className="tile">
      <a href={href(`/recipe/${recipe.id}`)} className="tile-link">
        <div className="tile-media">
          <DishThumb recipe={recipe} className="tile-img" />
          {recipe.source === 'ai' && <span className="media-badge media-badge-ai">✨</span>}
        </div>
        <span className="tile-title">{recipe.title}</span>
        <span className="tile-meta">
          {formatMinutes(recipe.totalMinutes)} · {recipe.difficulty}
        </span>
      </a>
      {onRemove && (
        <button type="button" className="icon-btn tile-remove" onClick={onRemove} aria-label={`Remove ${recipe.title}`}>
          ✕
        </button>
      )}
    </div>
  );
}
