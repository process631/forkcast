import { formatMinutes } from '../lib/parse';
import type { Recipe, Suggestion } from '../lib/types';
import { href } from '../router';
import { Chip, EmojiArt, Img } from './ui';

/** Photo for a recipe, or colorful emoji art if it's missing. */
export function DishThumb({ recipe, className = '' }: { recipe: Recipe; className?: string }) {
  return <Img src={recipe.image} alt={recipe.title} className={className} fallback={<EmojiArt title={recipe.title} className={className} />} />;
}

export function SuggestionCard({ suggestion, index }: { suggestion: Suggestion; index: number }) {
  const { recipe, reasons, close } = suggestion;
  return (
    <a href={href(`/recipe/${recipe.id}`)} className="card suggestion-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="card-media">
        <DishThumb recipe={recipe} className="card-img" />
        {recipe.youtube && <span className="media-badge">Video</span>}
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
