import { useCallback, useEffect, useRef, useState } from 'react';
import { CUISINES, DIETS, MOODS, SKILLS, TIMES, getCategory, getMeal } from '../data/taxonomy';
import { ideaFromRecipe, suggestIdeas } from '../lib/ai';
import { loadLibrary } from '../lib/mealdb';
import { matchLibrary } from '../lib/match';
import { aiEnabled, answersFingerprint, answersStore, appMode, ideasStore, rememberAiRecipe, resultsStore, settingsStore, useStore } from '../lib/store';
import type { Answers, Recipe, Suggestion } from '../lib/types';
import { href, navigate } from '../router';
import { RecipeHandoff } from './GeminiHandoff';
import { SkeletonCard, SuggestionCard } from './RecipeCard';
import { Chip, ErrorBox } from './ui';

function summarize(a: Answers): string[] {
  const out: string[] = [];
  const meal = getMeal(a.meal);
  const cat = getCategory(a.category);
  if (meal) out.push(`${meal.emoji} ${meal.label}`);
  if (cat) out.push(`${cat.emoji} ${cat.label}`);
  cat?.question?.options.filter((o) => a.styles.includes(o.id)).forEach((o) => out.push(`${o.emoji ?? ''} ${o.label}`));
  MOODS.filter((m) => a.moods.includes(m.id)).forEach((m) => out.push(`${m.emoji} ${m.label}`));
  const t = TIMES.find((x) => x.id === a.time);
  if (t && t.id !== 'any') out.push(`${t.emoji} ${t.label}`);
  const s = SKILLS.find((x) => x.id === a.skill);
  if (s && s.id !== 'any') out.push(`${s.emoji} ${s.label}`);
  CUISINES.filter((c) => a.cuisines.includes(c.id)).forEach((c) => out.push(`${c.emoji} ${c.label}`));
  DIETS.filter((d) => a.diets.includes(d.id)).forEach((d) => out.push(`${d.emoji} ${d.label}`));
  a.include.forEach((i) => out.push(`🧺 ${i}`));
  a.avoid.forEach((i) => out.push(`🚫 ${i}`));
  return out;
}

function suggestionId(s: Suggestion) {
  return s.kind === 'library' ? s.recipe.id : `ai-${s.idea.key}`;
}

function suggestionTitle(s: Suggestion) {
  return s.kind === 'library' ? s.recipe.title : s.idea.title;
}

export function Results() {
  const answers = useStore(answersStore);
  const settings = useStore(settingsStore);
  const results = useStore(resultsStore);
  const aiOn = aiEnabled(settings) && settings.aiIdeas;
  const app = appMode(settings);
  const noAi = !aiOn && !app;
  const fp = answersFingerprint(answers) + (aiOn ? ':ai' : '');

  const [libLoading, setLibLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [libError, setLibError] = useState('');
  const [aiError, setAiError] = useState('');
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [moreFromGemini, setMoreFromGemini] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (fresh: boolean) => {
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      const prev = resultsStore.get();
      const shown = fresh ? [] : prev.shown;
      const shownTitles = fresh ? [] : prev.suggestions.map(suggestionTitle);
      const round = fresh ? 0 : prev.round + 1;
      setLibError('');
      setAiError('');
      setLibLoading(true);
      setAiLoading(aiOn);
      // Recipes pasted in from the Gemini app stay when reshuffling the library.
      const keep = !fresh && app ? prev.suggestions.filter((s) => s.kind === 'ai') : [];
      resultsStore.set({ forAnswers: fp, suggestions: keep, shown, round });

      // Free recipe library.
      let library: Suggestion[] = [];
      try {
        const lib = await loadLibrary();
        if (abort.signal.aborted) return;
        let res = matchLibrary(lib, answers, { count: aiOn ? 3 : 6, exclude: shown, excludeTitles: shownTitles, seed: round });
        // Shown everything that fits? Start over with a fresh shuffle.
        if (!res.suggestions.length && shown.length) res = matchLibrary(lib, answers, { count: aiOn ? 3 : 6, seed: round });
        library = res.suggestions;
        setPoolSize(res.poolSize);
        resultsStore.set((p) => ({ ...p, suggestions: [...p.suggestions.filter((s) => s.kind === 'ai'), ...library], shown: [...p.shown, ...library.map(suggestionId)] }));
      } catch (e) {
        if (!abort.signal.aborted) setLibError((e as Error).message);
      } finally {
        if (!abort.signal.aborted) setLibLoading(false);
      }

      // AI chef ideas.
      if (aiOn) {
        try {
          const ideas = await suggestIdeas(answers, shownTitles, abort.signal);
          if (abort.signal.aborted) return;
          ideasStore.set((p) => ({ ...p, ...Object.fromEntries(ideas.map((idea) => [idea.key, { idea, answers }])) }));
          const ai: Suggestion[] = ideas.map((idea) => ({ kind: 'ai', idea, reasons: idea.reasons }));
          resultsStore.set((p) => ({ ...p, suggestions: [...ai, ...p.suggestions.filter((s) => s.kind === 'library')], shown: [...p.shown, ...ai.map(suggestionId)] }));
        } catch (e) {
          if (!abort.signal.aborted && (e as Error).name !== 'AbortError') setAiError((e as Error).message);
        } finally {
          if (!abort.signal.aborted) setAiLoading(false);
        }
      }
    },
    [answers, aiOn, app, fp],
  );

  useEffect(() => {
    if (!answers.meal) {
      navigate('/plan', { replace: true });
      return;
    }
    if (results.forAnswers !== fp) void search(true);
  }, [fp]); // only re-run when the answers change, not on every results update

  useEffect(() => () => abortRef.current?.abort(), []);

  const addFromGemini = (list: { recipe: Recipe; reasons: string[] }[]) => {
    list.forEach(({ recipe }) => rememberAiRecipe(recipe));
    const added: Suggestion[] = list.map(({ recipe, reasons }) => ({ kind: 'ai', idea: ideaFromRecipe(recipe, reasons), reasons }));
    const ids = new Set(added.map(suggestionId));
    resultsStore.set((p) => ({
      ...p,
      suggestions: [...added, ...p.suggestions.filter((s) => !ids.has(suggestionId(s)))],
      shown: [...p.shown, ...ids],
    }));
    setMoreFromGemini(false);
  };

  const ai = results.suggestions.filter((s) => s.kind === 'ai');
  const library = results.suggestions.filter((s) => s.kind === 'library');
  const nothing = !libLoading && !aiLoading && !results.suggestions.length;
  const allClose = library.length > 0 && library.every((s) => s.kind === 'library' && s.close);

  return (
    <div className="container page">
      <div className="results-head">
        <p className="eyebrow">Picked for you</p>
        <h1>Here’s what we think you’ll love</h1>
        <div className="summary-chips">
          {summarize(answers).map((s) => (
            <Chip key={s} tone="muted">
              {s}
            </Chip>
          ))}
          <a href={href('/plan/kind')} className="link small">
            Change answers
          </a>
        </div>
      </div>

      {app && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">✨ Recipes made for you by Gemini</h2>
            {ai.length > 0 && !moreFromGemini && (
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setMoreFromGemini(true)}>
                Ask Gemini for 3 more
              </button>
            )}
          </div>
          {ai.length > 0 && (
            <div className="card-grid">
              {ai.map((s, i) => (
                <SuggestionCard key={suggestionId(s)} suggestion={s} index={i} />
              ))}
            </div>
          )}
          {(moreFromGemini || !ai.length) && <RecipeHandoff answers={answers} avoidTitles={results.suggestions.map(suggestionTitle)} onRecipes={addFromGemini} />}
        </section>
      )}

      {aiOn && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">✨ AI chef ideas, made for you</h2>
          </div>
          {aiError && (
            <ErrorBox title="The AI chef couldn’t answer this time." action={<a href={href('/settings')} className="link">Check AI settings</a>}>
              {aiError}
            </ErrorBox>
          )}
          <div className="card-grid">
            {aiLoading && !ai.length ? [0, 1, 2, 3].map((i) => <SkeletonCard key={i} />) : ai.map((s, i) => <SuggestionCard key={suggestionId(s)} suggestion={s} index={i} />)}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">{noAi ? '📚 Recipes that match' : '📚 Real recipes from the library'}</h2>
          {!libLoading && library.length > 0 && <span className="muted small">With photos{library.some((s) => s.kind === 'library' && s.recipe.youtube) ? ' & videos' : ''}</span>}
        </div>
        {libError && (
          <ErrorBox title="Couldn’t load the recipe library." action={<button type="button" className="btn btn-sm" onClick={() => search(true)}>Try again</button>}>
            {libError}
          </ErrorBox>
        )}
        {allClose && !libLoading && (
          <p className="notice">Nothing in the free library matches every answer exactly, so these are the closest picks.{noAi && <> <a href={href('/settings')}>Connect Gemini</a> and the AI chef will invent recipes that fit perfectly.</>}</p>
        )}
        <div className="card-grid">
          {libLoading && !library.length
            ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
            : library.map((s, i) => <SuggestionCard key={suggestionId(s)} suggestion={s} index={i} />)}
        </div>
        {!libLoading && noAi && poolSize !== null && poolSize > 0 && poolSize <= 6 && !allClose && (
          <p className="notice">
            That’s every library recipe that fits ({poolSize}). <a href={href('/settings')}>Connect Gemini</a> for unlimited AI-tailored ideas.
          </p>
        )}
      </section>

      {nothing && !libError && (
        <div className="empty">
          <div className="empty-emoji">🤔</div>
          <h2>No recipes match all of that</h2>
          <p className="muted">Try removing a filter like a cuisine, a diet or an ingredient to avoid.</p>
          <a href={href('/plan/kind')} className="btn btn-primary">
            Change my answers
          </a>
        </div>
      )}

      <div className="results-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => search(false)} disabled={libLoading || aiLoading}>
          🔀 Show me different options
        </button>
        <a href={href('/plan')} className="btn btn-ghost btn-lg">
          Start over
        </a>
      </div>
    </div>
  );
}
