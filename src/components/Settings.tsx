import { useState } from 'react';
import { resetLibrary } from '../lib/library';
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
      <h1>Make Forkcast yours</h1>

      <section className="panel">
        <h2>🧹 Data on this device</h2>
        <p className="muted">Your cookbook, history and the downloaded recipe library are stored only in this browser.</p>
        <div className="row wrap">
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={async () => {
              await idbClear('library:');
              resetLibrary();
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
        {note && <p className="form-ok">{note}</p>}
      </section>

      <section className="panel">
        <h2>🙏 Credits</h2>
        <ul className="credits-list">
          <li>
            Recipes, dish photos, ingredient pictures and videos: <a href="https://www.themealdb.com" target="_blank" rel="noreferrer">TheMealDB</a> (free API)
          </li>
        </ul>
      </section>
    </div>
  );
}
