import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CUISINES, DIETS, MEALS, MOODS, QUICK_INGREDIENTS, SKILLS, TIMES, categoriesForMeal, getCategory, getMeal, type Option } from '../data/taxonomy';
import { buildScreens, type Screen } from '../lib/questions';
import { answersStore, dietMemory, useStore } from '../lib/store';
import type { Answers, MealId } from '../lib/types';
import { goBack, navigate } from '../router';

/** Routes: /plan (meal) → /plan/kind (category) → /plan/details (every optional question) → /results */
export function Wizard({ params }: { params: string[] }) {
  const answers = useStore(answersStore);
  const update = (patch: Partial<Answers>) => answersStore.set((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    const step = params[0];
    if (!step) return;
    if (!answers.meal) {
      navigate('/plan', { replace: true });
      return;
    }
    if (step === 'q') {
      navigate(answers.category ? '/plan/details' : '/plan/kind', { replace: true });
      return;
    }
    if ((step === 'kind' || step === 'details') && step === 'details' && !answers.category) {
      navigate('/plan/kind', { replace: true });
    }
  }, [params, answers.meal, answers.category]);

  if (params[0] === 'kind') {
    return (
      <WizardFrame step={1}>
        <CategoryStep answers={answers} onPick={(category) => {
          update({ category, styles: category === answers.category ? answers.styles : [] });
          navigate('/plan/details');
        }} />
      </WizardFrame>
    );
  }

  if (params[0] === 'details' || params[0] === 'q') {
    if (!answers.meal || !answers.category) return null;
    return (
      <WizardFrame step={2} dock>
        <Preferences answers={answers} update={update} />
      </WizardFrame>
    );
  }

  return (
    <WizardFrame step={0}>
      <StepHeading title="What are you cooking?" subtitle="Start with a meal. You can refine it on the next two screens." />
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

function WizardFrame({ step, dock, children }: { step: number; dock?: boolean; children: ReactNode }) {
  const total = 3;
  const pct = Math.round(((step + 1) / total) * 100);
  return (
    <div className="container page wizard">
      <div className="wizard-top">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => goBack('/')}>
          Back
        </button>
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${total}`}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-text">
          {step + 1} of {total}
        </span>
      </div>
      <div className="wizard-body">{children}</div>
      {dock && (
        <div className="wizard-bar">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/results')}>
            See recipes
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

function OptionButton({ option, selected, onClick }: { option: Option; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`option-card${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onClick}>
      {option.emoji && <span className="option-emoji" aria-hidden="true">{option.emoji}</span>}
      <span className="option-label">{option.label}</span>
      {option.hint && <span className="option-hint">{option.hint}</span>}
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
      <StepHeading title={meal?.id === 'dessert' ? 'What kind of dessert?' : 'What kind of food?'} subtitle={meal ? `${meal.label}. Pick one, then set any preferences.` : undefined} />
      <div className="option-grid">
        {main.map((c) => (
          <OptionButton key={c.id} option={c} selected={answers.category === c.id} onClick={() => onPick(c.id)} />
        ))}
      </div>
      {more.length > 0 && (
        <div className="more-block">
          <button type="button" className="link-btn" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore}>
            {showMore ? 'Show fewer' : `More ideas (${more.length})`}
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

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function Preferences({ answers, update }: { answers: Answers; update: (p: Partial<Answers>) => void }) {
  const screens = buildScreens(answers);
  return (
    <>
      <StepHeading title="Any preferences?" subtitle="Everything here is optional. See recipes whenever you are ready." />
      {screens.map((screen) => (
        <PreferenceSection key={screen.id === 'style' ? `style-${screen.question.id}` : screen.id} screen={screen} answers={answers} update={update} />
      ))}
    </>
  );
}

function PreferenceSection({ screen, answers, update }: { screen: Screen; answers: Answers; update: (p: Partial<Answers>) => void }) {
  switch (screen.id) {
    case 'style': {
      const q = screen.question;
      const cat = getCategory(answers.category);
      return (
        <ChoiceGroup label={q.title} hint={cat ? `${cat.label}${q.multi ? ' · choose any' : ' · choose one'}` : undefined}>
          {q.options.map((o) => (
            <Choice
              key={o.id}
              selected={o.id === 'either' ? answers.styles.length === 0 : answers.styles.includes(o.id)}
              onClick={() => {
                if (q.multi) update({ styles: toggle(answers.styles, o.id) });
                else update({ styles: o.id === 'either' ? [] : [o.id] });
              }}
            >
              {o.label}
            </Choice>
          ))}
        </ChoiceGroup>
      );
    }
    case 'mood':
      return (
        <ChoiceGroup label="Flavors" hint="Choose any that sound good">
          {MOODS.map((o) => (
            <Choice key={o.id} selected={answers.moods.includes(o.id)} onClick={() => update({ moods: toggle(answers.moods, o.id) })}>
              {o.label}
            </Choice>
          ))}
        </ChoiceGroup>
      );
    case 'time':
      return (
        <ChoiceGroup label="How much time do you have?">
          {TIMES.map((o) => (
            <Choice key={o.id} selected={answers.time === o.id} onClick={() => update({ time: o.id })}>
              {o.label}
            </Choice>
          ))}
        </ChoiceGroup>
      );
    case 'skill':
      return (
        <ChoiceGroup label="How involved should it be?">
          {SKILLS.map((o) => (
            <Choice key={o.id} selected={answers.skill === o.id} onClick={() => update({ skill: o.id })}>
              {o.label}
            </Choice>
          ))}
        </ChoiceGroup>
      );
    case 'cuisine':
      return (
        <ChoiceGroup label="Cuisine" hint="Leave this open for anything">
          <Choice selected={answers.cuisines.length === 0} onClick={() => update({ cuisines: [] })}>
            Anything
          </Choice>
          {CUISINES.map((o) => (
            <Choice key={o.id} selected={answers.cuisines.includes(o.id)} onClick={() => update({ cuisines: toggle(answers.cuisines, o.id) })}>
              {o.label}
            </Choice>
          ))}
        </ChoiceGroup>
      );
    case 'diet':
      return (
        <ChoiceGroup label="Diets and allergies" hint="These are strict filters, and Forkcast remembers them. Matching uses ingredient names, so check labels for a serious allergy.">
          <Choice
            selected={answers.diets.length === 0}
            onClick={() => {
              update({ diets: [] });
              dietMemory.set((d) => ({ ...d, diets: [] }));
            }}
          >
            None
          </Choice>
          {DIETS.map((o) => (
            <Choice
              key={o.id}
              selected={answers.diets.includes(o.id)}
              onClick={() => {
                const diets = toggle(answers.diets, o.id);
                update({ diets });
                dietMemory.set((d) => ({ ...d, diets }));
              }}
            >
              {o.label}
            </Choice>
          ))}
        </ChoiceGroup>
      );
    case 'pantry':
      return (
        <fieldset className="pref-group">
          <legend>Ingredients</legend>
          <p className="pref-hint">Type an ingredient and press Enter, or tap a suggestion.</p>
          <ChipInput
            label="Use up"
            values={answers.include}
            suggestions={QUICK_INGREDIENTS}
            onChange={(include) => update({ include })}
            placeholder="spinach, chicken"
          />
          <ChipInput
            label="Avoid"
            values={answers.avoid}
            suggestions={['mushrooms', 'olives', 'cilantro', 'onions', 'shellfish', 'coconut', 'blue cheese']}
            onChange={(avoid) => {
              update({ avoid });
              dietMemory.set((d) => ({ ...d, avoid }));
            }}
            placeholder="olives, cilantro"
          />
        </fieldset>
      );
  }
}

function ChoiceGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="pref-group">
      <legend>{label}</legend>
      {hint && <p className="pref-hint">{hint}</p>}
      <div className="choice-row">{children}</div>
    </fieldset>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`choice${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
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
              <span aria-hidden="true">×</span>
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
              {s}
            </button>
          ))}
      </div>
    </div>
  );
}
