import { useState } from 'react';
import { IMAGE_MODEL_FALLBACKS, TEXT_MODEL_FALLBACKS, listModels, type ModelInfo } from '../lib/gemini';
import { imagesStore } from '../lib/images';
import { idbClear } from '../lib/storage';
import { DEFAULT_IMAGE_MODEL, DEFAULT_TEXT_MODEL, aiEnabled, cookbookStore, resultsStore, settingsStore, useStore } from '../lib/store';
import type { Settings as SettingsT } from '../lib/types';

export function Settings() {
  const settings = useStore(settingsStore);
  const [keyDraft, setKeyDraft] = useState(settings.geminiKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [note, setNote] = useState('');
  const connected = aiEnabled(settings);
  const status =
    settings.aiMode === 'app'
      ? { on: true, text: 'Using the Gemini app' }
      : settings.aiMode === 'api'
        ? { on: connected, text: connected ? 'Connected' : 'Needs a key' }
        : { on: false, text: 'Off' };

  const update = (patch: Partial<SettingsT>) => settingsStore.set((s) => ({ ...s, ...patch }));

  const setMode = (aiMode: SettingsT['aiMode']) => {
    update({ aiMode });
    resultsStore.set((r) => ({ ...r, forAnswers: '' })); // refresh results for the new mode
  };

  const saveKey = async () => {
    const key = keyDraft.trim();
    update({ geminiKey: key });
    resultsStore.set((r) => ({ ...r, forAnswers: '' })); // refresh results with AI ideas next time
    if (key) await runTest(key);
    else setTest(null);
  };

  const runTest = async (key = settings.geminiKey) => {
    setTesting(true);
    setTest(null);
    try {
      const list = await listModels(key);
      setModels(list);
      const text = list.filter((m) => m.kind === 'text');
      const image = list.filter((m) => m.kind === 'image');
      // If the saved model isn't available for this key, switch to the best one that is.
      const pick = (current: string, preferred: string[], available: ModelInfo[]) =>
        available.some((m) => m.id === current) ? current : preferred.find((p) => available.some((m) => m.id === p)) ?? available[0]?.id ?? current;
      update({
        textModel: pick(settingsStore.get().textModel, TEXT_MODEL_FALLBACKS, text),
        imageModel: pick(settingsStore.get().imageModel, IMAGE_MODEL_FALLBACKS, image),
      });
      setTest({ ok: true, message: `Connected! Your key can use ${text.length} text model${text.length === 1 ? '' : 's'} and ${image.length} image model${image.length === 1 ? '' : 's'}.` });
    } catch (e) {
      setTest({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const modelOptions = (kind: 'text' | 'image', current: string) => {
    const ids = [...new Set([current, ...models.filter((m) => m.kind === kind).map((m) => m.id), ...(kind === 'text' ? TEXT_MODEL_FALLBACKS : IMAGE_MODEL_FALLBACKS)])];
    return ids.map((id) => (
      <option key={id} value={id}>
        {models.find((m) => m.id === id)?.name ?? id}
        {models.length > 0 && !models.some((m) => m.id === id) ? ' (not available for this key)' : ''}
      </option>
    ));
  };

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(''), 2500);
  };

  return (
    <div className="container page narrow">
      <p className="eyebrow">Settings</p>
      <h1>Make Forkcast yours</h1>

      <section className="panel">
        <div className="panel-head">
          <h2>✨ AI chef (Google Gemini)</h2>
          <span className={`status-pill ${status.on ? 'on' : 'off'}`}>{status.text}</span>
        </div>
        <p className="muted">
          Forkcast always has its free library of 790+ real recipes. Gemini can also <strong>invent recipes made for your exact answers</strong> and{' '}
          <strong>make pictures of the dish and each step</strong>. Choose how Forkcast talks to Gemini:
        </p>
        <div className="segmented mode-picker" role="radiogroup" aria-label="How to use Gemini">
          {(
            [
              ['app', '💬 Gemini app', 'Uses your Gemini plan (like Pro). Copy & paste. No key, no cost.'],
              ['api', '🔑 API key', 'Automatic. Free as long as you don’t add billing.'],
              ['off', '📚 Off', 'Free recipe library only.'],
            ] as const
          ).map(([id, label, hint]) => (
            <button key={id} type="button" role="radio" aria-checked={settings.aiMode === id} className={settings.aiMode === id ? 'active' : ''} onClick={() => setMode(id)}>
              <strong>{label}</strong>
              <span>{hint}</span>
            </button>
          ))}
        </div>

        {settings.aiMode === 'app' && (
          <div className="mode-details">
            <h3>How it works</h3>
            <ol className="how-to">
              <li>
                After the questions, press <strong>Copy prompt &amp; open Gemini</strong>. Paste it into a new chat on{' '}
                <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer">gemini.google.com</a> and send it.
              </li>
              <li>Copy Gemini’s reply and paste it back into Forkcast. You get 3 complete recipes made for your answers.</li>
              <li>
                Want pictures? On a recipe, press <strong>Make a Gemini picture</strong> or <strong>Picture this step</strong>, paste the picture prompt into Gemini, then drop or
                paste Gemini’s picture into Forkcast.
              </li>
            </ol>
            <p className="fine-print">
              This runs on your normal Gemini usage, so your plan’s limits apply and there’s nothing extra to pay. Sign in to gemini.google.com in this browser first.
            </p>
          </div>
        )}

        {settings.aiMode === 'api' && (
          <div className="mode-details">
            <div className="callout">
              <strong>💸 Keeping it free.</strong> A key from Google AI Studio is free as long as you <strong>don’t add a billing account</strong> to its Google Cloud
              project. Without billing Google can’t charge you; when you reach the daily limit, Gemini just answers “quota reached”. AI recipe ideas work on the free tier.
              AI pictures don’t, so keep <em>AI photos</em> off (or switch to Gemini-app mode for pictures).
            </div>
            <ol className="how-to">
              <li>
                Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio → API keys</a> and sign in with your Google account.
              </li>
              <li>Click “Create API key” and copy it. Don’t set up billing if you want it to stay free.</li>
              <li>Paste it below and press Save. The key is stored only in this browser and is sent only to Google.</li>
            </ol>
            <label className="field-label" htmlFor="gemini-key">
              Gemini API key
            </label>
            <div className="key-row">
              <input
                id="gemini-key"
                type={showKey ? 'text' : 'password'}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="Paste your key (starts with AIza…)"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowKey((s) => !s)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={saveKey} disabled={testing || keyDraft.trim() === settings.geminiKey}>
                Save
              </button>
            </div>
            <div className="row">
              {connected && (
                <button type="button" className="btn btn-soft btn-sm" onClick={() => runTest()} disabled={testing}>
                  {testing ? 'Testing…' : 'Test connection'}
                </button>
              )}
              {connected && (
                <button
                  type="button"
                  className="link-btn small"
                  onClick={() => {
                    setKeyDraft('');
                    update({ geminiKey: '' });
                    setTest(null);
                    setModels([]);
                  }}
                >
                  Remove key
                </button>
              )}
            </div>
            {test && <p className={test.ok ? 'form-ok' : 'form-error'}>{test.ok ? '✅ ' : '⚠️ '}{test.message}</p>}

            <fieldset className="settings-group" disabled={!connected}>
              <legend>What should the AI do?</legend>
              <label className="check-row">
                <input type="checkbox" checked={settings.aiIdeas} onChange={(e) => update({ aiIdeas: e.target.checked })} />
                <span>
                  <strong>Suggest AI recipe ideas</strong>
                  <span className="muted small">Shown next to library recipes, written to fit all your answers. Free tier.</span>
                </span>
              </label>
              <div className="field-label">AI photos</div>
              <div className="segmented" role="radiogroup" aria-label="AI photos">
                {(
                  [
                    ['off', 'Off', 'Free photos only (recommended for free keys)'],
                    ['dish', 'Dish photos', 'Auto-draw AI recipes; steps on request'],
                    ['steps', 'Dish + every step', 'Auto-draws every step (uses more)'],
                  ] as const
                ).map(([id, label, hint]) => (
                  <button key={id} type="button" role="radio" aria-checked={settings.aiImages === id} className={settings.aiImages === id ? 'active' : ''} onClick={() => update({ aiImages: id })}>
                    <strong>{label}</strong>
                    <span>{hint}</span>
                  </button>
                ))}
              </div>
              <p className="fine-print">
                AI pictures through the API are paid-only: they need billing on the key and cost a few cents each. If a picture fails, Forkcast uses a free photo instead.
              </p>
              <div className="model-grid">
                <label>
                  <span className="field-label">Text model</span>
                  <select value={settings.textModel} onChange={(e) => update({ textModel: e.target.value })}>
                    {modelOptions('text', settings.textModel)}
                  </select>
                </label>
                <label>
                  <span className="field-label">Image model</span>
                  <select value={settings.imageModel} onChange={(e) => update({ imageModel: e.target.value })}>
                    {modelOptions('image', settings.imageModel)}
                  </select>
                </label>
              </div>
              <button type="button" className="link-btn small" onClick={() => update({ textModel: DEFAULT_TEXT_MODEL, imageModel: DEFAULT_IMAGE_MODEL })}>
                Reset to recommended models
              </button>
            </fieldset>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>🧹 Data on this device</h2>
        <div className="row wrap">
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={async () => {
              await idbClear('img:');
              imagesStore.set({});
              flash('AI images cleared.');
            }}
          >
            Clear AI images
          </button>
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={async () => {
              await idbClear('library:');
              await idbClear('photo:');
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
          <li>
            Free photos: <a href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">Wikimedia Commons</a> and <a href="https://openverse.org" target="_blank" rel="noreferrer">Openverse</a>, with credits shown under each photo
          </li>
          <li>
            AI recipes and images: <a href="https://ai.google.dev" target="_blank" rel="noreferrer">Google Gemini API</a> (your own key)
          </li>
        </ul>
      </section>
    </div>
  );
}
