import { useState } from 'react';
import { idbClear } from '../lib/storage';
import { cookbookStore } from '../lib/store';

export function Settings() {
  const [note, setNote] = useState('');

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(''), 2500);
  };

  return (
    <div className="container page narrow">
      <p className="eyebrow">Settings</p>
      <h1>Settings</h1>
      <p className="muted">Cookbook, history, and the recipe library stay in this browser.</p>

      <section className="panel" aria-labelledby="data-heading">
        <h2 id="data-heading">Data on this device</h2>
        <p className="muted">Refreshing the library downloads recipes again. Clearing the cookbook removes saved recipes and recent history.</p>
        <div className="row wrap">
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={async () => {
              await idbClear('library:');
              flash('Recipe library will re-download next time.');
            }}
          >
            Refresh recipe library
          </button>
          <button
            type="button"
            className="btn btn-soft btn-sm danger"
            onClick={() => {
              if (window.confirm('Remove all saved recipes and history from this device?')) {
                cookbookStore.set({ saved: [], recent: [] });
                flash('Cookbook cleared.');
              }
            }}
          >
            Clear cookbook
          </button>
        </div>
        <p className="form-ok" role="status" aria-live="polite">{note}</p>
      </section>

      <section className="panel" aria-labelledby="credits-heading">
        <h2 id="credits-heading">Credits</h2>
        <ul className="credits-list">
          <li>
            Recipes, dish photos, ingredient pictures and videos: <a href="https://www.themealdb.com" target="_blank" rel="noreferrer">TheMealDB</a> (free API)
          </li>
        </ul>
      </section>
    </div>
  );
}
