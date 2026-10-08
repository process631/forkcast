import { useCallback, useEffect, useRef, useState } from 'react';
import { CUISINES, DIETS, MOODS, SKILLS, TIMES, getCategory, getMeal } from '../data/taxonomy';
import { describeStatus, loadLibrary, resetLibrary } from '../lib/library';
import { matchLibrary } from '../lib/match';
import { answersFingerprint, answersStore, resultsStore, useStore } from '../lib/store';
import type { Answers } from '../lib/types';
import { href, navigate } from '../router';
import { SkeletonCard, SuggestionCard } from './RecipeCard';
import { Chip, ErrorBox } from './ui';

const COUNT = 6;

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

export function Results() {
  const answers = useStore(answersStore);
  const results = useStore(resultsStore);
  const fp = answersFingerprint(answers);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [libraryNote, setLibraryNote] = useState('');
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const runRef = useRef(0);

  const search = useCallback(
    async (fresh: boolean) => {
      const run = ++runRef.current;
      const prev = resultsStore.get();
      const shown = fresh ? [] : prev.shown;
      const shownTitles = fresh ? [] : prev.suggestions.map((s) => s.recipe.title);
      const round = fresh ? 0 : prev.round + 1;
      setError('');
      setLoading(true);
      resultsStore.set({ forAnswers: fp, suggestions: [], shown, round });
      try {
        const lib = await loadLibrary();
        if (run !== runRef.current) return;
        setLibraryNote(describeStatus());
        let res = matchLibrary(lib, answers, { count: COUNT, exclude: shown, excludeTitles: shownTitles, seed: round });
        // Shown everything that fits? Start over with a fresh shuffle.
        if (!res.suggestions.length && shown.length) res = matchLibrary(lib, answers, { count: COUNT, seed: round });
        setPoolSize(res.poolSize);
        resultsStore.set({ forAnswers: fp, suggestions: res.suggestions, shown: [...shown, ...res.suggestions.map((s) => s.recipe.id)], round });
      } catch (e) {
        if (run === runRef.current) setError((e as Error).message);
      } finally {
        if (run === runRef.current) setLoading(false);
      }
    },
    [answers, fp],
  );

  useEffect(() => {
    if (!answers.meal) {
      navigate('/plan', { replace: true });
      return;
    }
    if (results.forAnswers !== fp) void search(true);
  }, [fp]); // only re-run when the answers change, not on every results update

  const { suggestions } = results;
  const nothing = !loading && !error && !suggestions.length;
  const allClose = suggestions.length > 0 && suggestions.every((s) => s.close);

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

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">📚 Recipes that match</h2>
          {!loading && suggestions.length > 0 && <span className="muted small">With photos{suggestions.some((s) => s.recipe.youtube) ? ' & videos' : ''}</span>}
        </div>
        {error && (
          <ErrorBox title="Couldn’t load the recipe library." action={<button type="button" className="btn btn-sm" onClick={() => search(true)}>Try again</button>}>
            {error}
          </ErrorBox>
        )}
        {libraryNote && !loading && (
          <p className="notice">
            {libraryNote}{' '}
            <button type="button" className="link-btn" onClick={() => { resetLibrary(); void search(true); }}>
              Try again
            </button>
          </p>
        )}
        {allClose && !loading && <p className="notice">Nothing in the library matches every answer exactly, so these are the closest picks.</p>}
        <div className="card-grid">
          {loading && !suggestions.length
            ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
            : suggestions.map((s, i) => <SuggestionCard key={s.recipe.id} suggestion={s} index={i} />)}
        </div>
        {!loading && poolSize !== null && poolSize > 0 && poolSize <= COUNT && !allClose && (
          <p className="notice">That’s every library recipe that fits ({poolSize}). Try changing an answer for more ideas.</p>
        )}
      </section>

      {nothing && (
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
        <button type="button" className="btn btn-primary btn-lg" onClick={() => search(false)} disabled={loading}>
          🔀 Show me different options
        </button>
        <a href={href('/plan')} className="btn btn-ghost btn-lg">
          Start over
        </a>
      </div>
    </div>
  );
}
