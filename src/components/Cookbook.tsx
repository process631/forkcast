import { useState } from 'react';
import { cookbookStore, toggleSaved, useStore } from '../lib/store';
import { href } from '../router';
import { RecipeTile } from './RecipeCard';

export function Cookbook() {
  const { saved, recent } = useStore(cookbookStore);
  const [tab, setTab] = useState<'saved' | 'recent'>(saved.length || !recent.length ? 'saved' : 'recent');
  const list = tab === 'saved' ? saved : recent;

  return (
    <div className="container page">
      <p className="eyebrow">Your collection</p>
      <h1>My cookbook</h1>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'saved'} className={`tab${tab === 'saved' ? ' active' : ''}`} onClick={() => setTab('saved')}>
          ❤️ Saved ({saved.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'recent'} className={`tab${tab === 'recent' ? ' active' : ''}`} onClick={() => setTab('recent')}>
          🕘 Recently viewed ({recent.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">{tab === 'saved' ? '📖' : '🕘'}</div>
          <h2>{tab === 'saved' ? 'No saved recipes yet' : 'Nothing viewed yet'}</h2>
          <p className="muted">{tab === 'saved' ? 'Tap “Save” on any recipe to keep it here.' : 'Recipes you open will show up here.'}</p>
          <a href={href('/plan')} className="btn btn-primary">
            Find something to cook
          </a>
        </div>
      ) : (
        <div className="tile-grid">
          {list.map((e) => (
            <RecipeTile key={e.recipe.id} recipe={e.recipe} onRemove={tab === 'saved' ? () => toggleSaved(e.recipe) : undefined} />
          ))}
        </div>
      )}
      {tab === 'recent' && recent.length > 0 && (
        <button type="button" className="link-btn small" onClick={() => cookbookStore.set((p) => ({ ...p, recent: [] }))}>
          Clear history
        </button>
      )}
    </div>
  );
}
