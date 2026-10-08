import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CUISINES, DIETS, MEALS, MOODS, QUICK_INGREDIENTS, SKILLS, TIMES, categoriesForMeal, getCategory, getMeal, type Option } from '../data/taxonomy';
import { buildScreens, type Screen } from '../lib/questions';
import { answersStore, dietMemory, useStore } from '../lib/store';
import type { Answers, MealId } from '../lib/types';
import { goBack, navigate } from '../router';

/** Routes: /plan (meal) → /plan/kind (category) → /plan/q/0..n (questions) → /results */
export function Wizard({ params }: { params: string[] }) {
  const answers = useStore(answersStore);
  const screens = buildScreens(answers);
  const totalSteps = 2 + screens.length;

  const update = (patch: Partial<Answers>) => answersStore.set((prev) => ({ ...prev, ...patch }));

  // Guard against deep links that skip required steps.
  useEffect(() => {
    if (params[0] === 'kind' && !answers.meal) navigate('/plan', { replace: true });
    if (params[0] === 'q' && (!answers.meal || !answers.category)) navigate(answers.meal ? '/plan/kind' : '/plan', { replace: true });
  }, [params, answers.meal, answers.category]);

  if (params[0] === 'kind') {
    return (
      <WizardFrame step={1} total={totalSteps} canSkip={false}>
        <CategoryStep answers={answers} onPick={(category) => {
          update({ category, styles: category === answers.category ? answers.styles : [] });
          navigate('/plan/q/0');
        }} />
      </WizardFrame>
    );
  }

  if (params[0] === 'q') {
    const i = Math.max(0, Number(params[1]) || 0);
    const screen = screens[i];
    if (!screen) return null;
    const next = () => navigate(i + 1 < screens.length ? `/plan/q/${i + 1}` : '/results');
    return (
      <WizardFrame step={2 + i} total={totalSteps} canSkip>
        <QuestionScreen key={`${screen.id}-${i}`} screen={screen} answers={answers} update={update} next={next} />
      </WizardFrame>
    );
  }

  return (
    <WizardFrame step={0} total={totalSteps} canSkip={false}>
      <StepHeading title="What are you cooking?" subtitle="Pick a meal to get started." />
      <div className="option-grid option-grid-lg">
        {MEALS.map((m) => (
          <OptionButton
            key={m.id}
            option={m}
            selected={answers.meal === m.id}
            onClick={() => {
              const remembered = dietMemory.get();
              const fresh = answers.meal !== m.id;
              update({ meal: m.id as MealId, category: fresh ? null : answers.category, ...(fresh && !answers.diets.length ? { diets: remembered.diets, avoid: remembered.avoid } : {}) });
              navigate('/plan/kind');
            }}
          />
        ))}
      </div>
    </WizardFrame>
  );
}

function WizardFrame({ step, total, canSkip, children }: { step: number; total: number; canSkip: boolean; children: ReactNode }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="container page wizard">
      <div className="wizard-top">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => goBack('/')}>
          ← Back
        </button>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step} aria-label={`Step ${step + 1} of ${total}`}>
          <div className="progress-fill" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
        <span className="progress-text">
          {step + 1}/{total}
        </span>
      </div>
      <div className="wizard-body">{children}</div>
      {canSkip && (
        <div className="wizard-skip">
          <button type="button" className="link-btn" onClick={() => navigate('/results')}>
            Skip the rest — show me options →
          </button>
        </div>
      )}
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [title]);
  return (
    <div className="step-heading">
      <h1 ref={ref} tabIndex={-1}>
        {title}
      </h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </div>
  );
}

function OptionButton({ option, selected, onClick, small }: { option: Option; selected: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button type="button" className={`option-card${small ? ' option-card-sm' : ''}${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onClick}>
      {option.emoji && <span className="option-emoji" aria-hidden="true">{option.emoji}</span>}
      <span className="option-label">{option.label}</span>
      {option.hint && !small && <span className="option-hint">{option.hint}</span>}
      {selected && <span className="option-check" aria-hidden="true">✓</span>}
    </button>
  );
}

function CategoryStep({ answers, onPick }: { answers: Answers; onPick: (id: string) => void }) {
  const { main, more } = categoriesForMeal(answers.meal);
  const [showMore, setShowMore] = useState(false);
  const meal = getMeal(answers.meal);
  return (
    <>
      <StepHeading title={`What kind of ${meal?.id === 'dessert' ? 'dessert' : meal?.id === 'drink' ? 'drink' : 'food'}?`} subtitle={meal ? `${meal.emoji} ${meal.label}` : undefined} />
      <div className="option-grid">
        {main.map((c) => (
          <OptionButton key={c.id} option={c} selected={answers.category === c.id} onClick={() => onPick(c.id)} />
        ))}
      </div>
      {more.length > 0 && (
        <div className="more-block">
          <button type="button" className="link-btn" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore}>
            {showMore ? 'Fewer ideas ▴' : `More ideas (${more.length}) ▾`}
          </button>
          {showMore && (
            <div className="option-grid">
              {more.map((c) => (
                <OptionButton key={c.id} option={c} selected={answers.category === c.id} onClick={() => onPick(c.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function toggle(list: string[], id: string, exclusive?: string): string[] {
  if (id === exclusive) return [];
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function QuestionScreen({ screen, answers, update, next }: { screen: Screen; answers: Answers; update: (p: Partial<Answers>) => void; next: () => void }) {
  const advance = () => setTimeout(next, 160);

  switch (screen.id) {
    case 'style': {
      const q = screen.question;
      const cat = getCategory(answers.category);
      return (
        <>
          <StepHeading title={q.title} subtitle={`${cat?.emoji ?? ''} ${cat?.label ?? ''}${q.multi ? ' · pick any' : ''}`} />
          <div className="option-grid">
            {q.options.map((o) => (
              <OptionButton
                key={o.id}
                option={o}
                selected={answers.styles.includes(o.id)}
                onClick={() => {
                  if (q.multi) update({ styles: toggle(answers.styles, o.id) });
                  else {
                    update({ styles: o.id === 'either' ? [] : [o.id] });
                    advance();
                  }
                }}
              />
            ))}
          </div>
          {q.multi && <NextButton onClick={next} hasSelection={answers.styles.length > 0} />}
        </>
      );
    }
    case 'mood':
      return (
        <>
          <StepHeading title="What flavors are you craving?" subtitle="Pick any that sound good" />
          <div className="option-grid option-grid-sm">
            {MOODS.map((o) => (
              <OptionButton key={o.id} option={o} small selected={answers.moods.includes(o.id)} onClick={() => update({ moods: toggle(answers.moods, o.id) })} />
            ))}
          </div>
          <NextButton onClick={next} hasSelection={answers.moods.length > 0} />
        </>
      );
    case 'time':
      return (
        <>
          <StepHeading title="How much time do you have?" />
          <div className="option-grid">
            {TIMES.map((o) => (
              <OptionButton key={o.id} option={o} selected={answers.time === o.id} onClick={() => { update({ time: o.id }); advance(); }} />
            ))}
          </div>
        </>
      );
    case 'skill':
      return (
        <>
          <StepHeading title="How adventurous are you feeling?" />
          <div className="option-grid">
            {SKILLS.map((o) => (
              <OptionButton key={o.id} option={o} selected={answers.skill === o.id} onClick={() => { update({ skill: o.id }); advance(); }} />
            ))}
          </div>
        </>
      );
    case 'cuisine':
      return (
        <>
          <StepHeading title="Any cuisine in mind?" subtitle="Pick any, or skip for anything goes" />
          <div className="option-grid option-grid-sm">
            <OptionButton option={{ id: 'any', label: 'Anything goes', emoji: '🌎' }} small selected={answers.cuisines.length === 0} onClick={() => update({ cuisines: [] })} />
            {CUISINES.map((o) => (
              <OptionButton key={o.id} option={o} small selected={answers.cuisines.includes(o.id)} onClick={() => update({ cuisines: toggle(answers.cuisines, o.id) })} />
            ))}
          </div>
          <NextButton onClick={next} hasSelection={answers.cuisines.length > 0} />
        </>
      );
    case 'diet':
      return (
        <>
          <StepHeading title="Any diets or allergies?" subtitle="These are strict filters. We’ll remember them for next time." />
          <div className="option-grid option-grid-sm">
            <OptionButton option={{ id: 'none', label: 'None', emoji: '👍' }} small selected={answers.diets.length === 0} onClick={() => { update({ diets: [] }); dietMemory.set((d) => ({ ...d, diets: [] })); }} />
            {DIETS.map((o) => (
              <OptionButton
                key={o.id}
                option={o}
                small
                selected={answers.diets.includes(o.id)}
                onClick={() => {
                  const diets = toggle(answers.diets, o.id);
                  update({ diets });
                  dietMemory.set((d) => ({ ...d, diets }));
                }}
              />
            ))}
          </div>
          <p className="fine-print">Allergy filtering is based on ingredient names. Always double-check labels for serious allergies.</p>
          <NextButton onClick={next} hasSelection={answers.diets.length > 0} />
        </>
      );
    case 'pantry':
      return (
        <>
          <StepHeading title="Anything to use up — or avoid?" subtitle="Optional: type an ingredient and press Enter" />
          <ChipInput
            label="🧺 Ingredients I want to use"
            values={answers.include}
            suggestions={QUICK_INGREDIENTS}
            onChange={(include) => update({ include })}
            placeholder="e.g. spinach, chicken…"
          />
          <ChipInput
            label="🚫 Ingredients to avoid"
            values={answers.avoid}
            suggestions={['mushrooms', 'olives', 'cilantro', 'onions', 'shellfish', 'coconut', 'blue cheese']}
            onChange={(avoid) => {
              update({ avoid });
              dietMemory.set((d) => ({ ...d, avoid }));
            }}
            placeholder="e.g. olives, cilantro…"
          />
          <NextButton onClick={next} hasSelection={answers.include.length + answers.avoid.length > 0} />
        </>
      );
  }
}

function NextButton({ onClick, hasSelection }: { onClick: () => void; hasSelection: boolean }) {
  return (
    <div className="wizard-next">
      <button type="button" className={`btn ${hasSelection ? 'btn-primary' : 'btn-ghost'} btn-lg`} onClick={onClick}>
        {hasSelection ? 'Next →' : 'Skip →'}
      </button>
    </div>
  );
}

function ChipInput({ label, values, onChange, suggestions, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder: string }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const words = raw.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
    const next = [...values];
    for (const w of words) if (!next.includes(w)) next.push(w);
    onChange(next);
    setText('');
  };
  const id = label.replace(/\W+/g, '-').toLowerCase();
  return (
    <div className="chip-input">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="chip-input-box">
        {values.map((v) => (
          <span key={v} className="chip chip-removable">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
              ✕
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          placeholder={values.length ? '' : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
        />
      </div>
      <div className="quick-chips">
        {suggestions
          .filter((s) => !values.includes(s))
          .slice(0, 8)
          .map((s) => (
            <button key={s} type="button" className="chip chip-add" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
      </div>
    </div>
  );
}
