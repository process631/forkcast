import { useState, type CSSProperties, type ReactNode } from 'react';
import { formatMinutes } from '../lib/parse';
import type { Recipe } from '../lib/types';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-row" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: 'accent' | 'herb' | 'muted' }) {
  return <span className={`chip${tone ? ` chip-${tone}` : ''}`}>{children}</span>;
}

/** Image that quietly disappears (or shows a fallback) if it fails to load. */
export function Img({ src, alt, className, fallback, loading = 'lazy' }: { src?: string; alt: string; className?: string; fallback?: ReactNode; loading?: 'lazy' | 'eager' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback ?? null}</>;
  return <img src={src} alt={alt} className={className} loading={loading} onError={() => setFailed(true)} />;
}

/** Colorful emoji tile used when a dish has no photo yet. */
export function EmojiArt({ emoji, title, className = '' }: { emoji?: string; title: string; className?: string }) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
  return (
    <div className={`emoji-art ${className}`} style={{ '--hue': h } as CSSProperties} aria-hidden="true">
      <span>{emoji || '🍽️'}</span>
    </div>
  );
}

export function RecipeMeta({ recipe, servings = true }: { recipe: Recipe; servings?: boolean }) {
  return (
    <div className="meta-row">
      <Chip>⏱️ {formatMinutes(recipe.totalMinutes)}{recipe.hasPassiveTime ? ' incl. resting' : ''}</Chip>
      <Chip>{recipe.difficulty === 'Easy' ? '🟢' : recipe.difficulty === 'Medium' ? '🟡' : '🔴'} {recipe.difficulty}</Chip>
      {recipe.cuisine && <Chip>🌍 {recipe.cuisine}</Chip>}
      {servings && recipe.servings && <Chip>🍽️ Serves {recipe.servings}</Chip>}
      <Chip>📝 {recipe.ingredients.length} ingredients</Chip>
    </div>
  );
}

export function ErrorBox({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="error-box" role="alert">
      <strong>{title}</strong>
      {children && <div>{children}</div>}
      {action}
    </div>
  );
}
