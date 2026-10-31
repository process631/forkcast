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
      <p className="eyebrow">Library</p>
      <h1>Cookbook</h1>
      <div
        className="tabs"
        role="tablist"
        aria-label="Cookbook"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const next = tab === 'saved' ? 'recent' : 'saved';
          setTab(next);
          document.getElementById(`cookbook-tab-${next}`)?.focus();
        }}
      >
        <button id="cookbook-tab-saved" type="button" role="tab" aria-selected={tab === 'saved'} tabIndex={tab === 'saved' ? 0 : -1} className={`tab${tab === 'saved' ? ' active' : ''}`} onClick={() => setTab('saved')}>
          Saved ({saved.length})
        </button>
        <button id="cookbook-tab-recent" type="button" role="tab" aria-selected={tab === 'recent'} tabIndex={tab === 'recent' ? 0 : -1} className={`tab${tab === 'recent' ? ' active' : ''}`} onClick={() => setTab('recent')}>
          Recent ({recent.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <h2>{tab === 'saved' ? 'No saved recipes yet' : 'Nothing viewed yet'}</h2>
          <p className="muted">{tab === 'saved' ? 'Save a recipe and it stays in this browser.' : 'Recipes you open will show up here.'}</p>
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
