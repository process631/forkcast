import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { buildHandoffPrompt, parseHandoffReply, pictureHandoffPrompt, type ImageSlot } from '../lib/ai';
import { copyText } from '../lib/clipboard';
import { saveUserImage } from '../lib/images';
import type { Answers, Recipe } from '../lib/types';

const GEMINI_URL = 'https://gemini.google.com/app';

function openGemini() {
  window.open(GEMINI_URL, '_blank', 'noopener');
}

/**
 * Two steps: copy a ready-made prompt into the Gemini app, then paste its reply back.
 * Runs on the person's own Gemini plan, so there's no API key and no cost.
 */
export function RecipeHandoff({ answers, avoidTitles, onRecipes }: { answers: Answers; avoidTitles: string[]; onRecipes: (r: { recipe: Recipe; reasons: string[] }[]) => void }) {
  const prompt = buildHandoffPrompt(answers, avoidTitles);
  const [copied, setCopied] = useState<boolean | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const id = useId();

  const start = () => {
    // Start the copy and open Gemini in the same click, so pop-up blockers allow the new tab.
    const copying = copyText(prompt);
    openGemini();
    void copying.then((ok) => {
      setCopied(ok);
      if (!ok) setShowPrompt(true); // e.g. on a phone over plain http: copy it by hand
    });
  };

  const submit = (text = reply) => {
    setError('');
    try {
      onRecipes(parseHandoffReply(text, answers));
      setReply('');
      setCopied(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="handoff">
      <ol className="handoff-steps">
        <li className="handoff-step">
          <span className="handoff-num" aria-hidden="true">1</span>
          <div className="handoff-body">
            <strong>Copy the prompt and open Gemini</strong>
            <p className="muted small">Paste it into a new Gemini chat (Ctrl+V) and send it. Your Gemini plan does the work, so there’s no key and no cost.</p>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={start}>
                📋 Copy prompt &amp; open Gemini
              </button>
              {copied === true && <span className="form-ok small">✓ Prompt copied</span>}
              {copied === false && <span className="form-error small">Couldn’t copy automatically. Copy the prompt below by hand.</span>}
            </div>
            <details className="prompt-preview" open={showPrompt} onToggle={(e) => setShowPrompt(e.currentTarget.open)}>
              <summary>See the prompt</summary>
              <textarea readOnly value={prompt} rows={8} onFocus={(e) => e.currentTarget.select()} aria-label="Prompt for Gemini" />
            </details>
          </div>
        </li>
        <li className="handoff-step">
          <span className="handoff-num" aria-hidden="true">2</span>
          <div className="handoff-body">
            <label htmlFor={id}>
              <strong>Paste Gemini’s reply</strong>
            </label>
            <p className="muted small">Use the copy button under Gemini’s answer, then paste the whole thing here.</p>
            <textarea
              id={id}
              className="reply-box"
              rows={4}
              value={reply}
              placeholder="Paste Gemini’s reply here…"
              onChange={(e) => setReply(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text.trim()) {
                  e.preventDefault();
                  setReply(text);
                  submit(text);
                }
              }}
            />
            <div className="row">
              <button type="button" className="btn btn-soft" onClick={() => submit()} disabled={!reply.trim()}>
                Add these recipes
              </button>
            </div>
            {error && <p className="form-error small">{error}</p>}
          </div>
        </li>
      </ol>
    </div>
  );
}

/* The most recently opened picture panel receives Ctrl+V. */
let activePanel: string | null = null;

/** Make a picture in the Gemini app, then drop / paste / choose it here. */
export function PictureHandoff({ recipe, slot, onDone }: { recipe: Recipe; slot: ImageSlot; onDone?: () => void }) {
  const panelId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const save = async (file: Blob | null | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await saveUserImage(recipe, slot, file);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveRef = useRef(save);
  saveRef.current = save;

  // Ctrl+V anywhere on the page while this panel is the active one.
  useEffect(() => {
    activePanel = panelId;
    const onPaste = (e: ClipboardEvent) => {
      if (activePanel !== panelId) return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        void saveRef.current(file);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('paste', onPaste);
      if (activePanel === panelId) activePanel = null;
    };
  }, [panelId]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void save([...e.dataTransfer.files].find((f) => f.type.startsWith('image/')) ?? e.dataTransfer.files[0]);
  };

  return (
    <div className="pic-handoff">
      <div className="row">
        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={() => {
            const copying = copyText(pictureHandoffPrompt(recipe, slot));
            openGemini();
            void copying.then(setCopied);
          }}
        >
          📋 Copy picture prompt &amp; open Gemini
        </button>
        {copied === true && <span className="form-ok small">✓ Copied, paste it into Gemini</span>}
      </div>
      {copied === false && (
        <textarea className="reply-box" readOnly rows={4} value={pictureHandoffPrompt(recipe, slot)} onFocus={(e) => e.currentTarget.select()} aria-label="Picture prompt to copy" />
      )}
      <div
        className={`drop-zone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {busy ? (
          <span>Saving picture…</span>
        ) : (
          <span>
            🖼️ Then drop Gemini’s picture here, paste it (Ctrl+V), or{' '}
            <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
              choose the file
            </button>
          </span>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void save(e.target.files?.[0])} />
      </div>
      {error && <p className="form-error small">{error}</p>}
    </div>
  );
}
