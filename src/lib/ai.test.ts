import { describe, expect, it } from 'vitest';
import { buildHandoffPrompt, ideaFromRecipe, parseHandoffReply, pictureHandoffPrompt } from './ai';
import { EMPTY_ANSWERS } from './store';
import type { Answers } from './types';

const answers: Answers = { ...EMPTY_ANSWERS, meal: 'dinner', category: 'pasta', diets: ['vegetarian'], avoid: ['olives'], servings: 4 };

const recipe = (title: string) => ({
  title,
  emoji: '🍝',
  description: 'Silky and quick.',
  cuisine: 'Italian',
  servings: 4,
  totalMinutes: 25,
  difficulty: 'Easy',
  reasons: ['Creamy', 'Quick'],
  equipment: ['Skillet'],
  ingredients: [
    { name: 'spaghetti', measure: '12 oz' },
    { name: 'garlic', measure: '3 cloves' },
  ],
  steps: [{ title: 'Boil', text: 'Boil the pasta for 9 minutes.', minutes: 9, imagePrompt: 'Pasta boiling' }],
  tips: ['Save some pasta water.'],
});

describe('buildHandoffPrompt', () => {
  it('includes the answers, strict rules, servings and the JSON shape', () => {
    const prompt = buildHandoffPrompt(answers, ['Fettuccine Alfredo']);
    expect(prompt).toContain('MUST be: vegetarian');
    expect(prompt).toContain('MUST NOT contain: olives');
    expect(prompt).toContain('exactly 4 servings');
    expect(prompt).toContain('Fettuccine Alfredo');
    expect(prompt).toContain('"recipes"');
  });
});

describe('parseHandoffReply', () => {
  it('reads a fenced JSON reply with surrounding chatter', () => {
    const reply = `Here you go!\n\`\`\`json\n${JSON.stringify({ recipes: [recipe('Garlic Spaghetti'), recipe('Lemon Orzo')] })}\n\`\`\`\nEnjoy!`;
    const out = parseHandoffReply(reply, answers);
    expect(out.map((r) => r.recipe.title)).toEqual(['Garlic Spaghetti', 'Lemon Orzo']);
    expect(out[0].reasons).toEqual(['Creamy', 'Quick']);
    expect(out[0].recipe).toMatchObject({ source: 'ai', servings: 4, totalMinutes: 25, difficulty: 'Easy' });
    expect(out[0].recipe.id).toMatch(/^ai-/);
    expect(out[0].recipe.ingredients[0].image).toContain('themealdb.com/images/ingredients/spaghetti');
  });

  it('accepts a bare array or a single recipe, and survives trailing commas', () => {
    expect(parseHandoffReply(JSON.stringify([recipe('A Dish')]), answers)).toHaveLength(1);
    expect(parseHandoffReply(JSON.stringify(recipe('One Dish')), answers)).toHaveLength(1);
    const sloppy = JSON.stringify({ recipes: [recipe('Trailing Dish')] }).replace(/\]\}$/, '],}');
    expect(parseHandoffReply(sloppy, answers)[0].recipe.title).toBe('Trailing Dish');
  });

  it('skips incomplete recipes but keeps good ones', () => {
    const broken = { title: 'No Steps', ingredients: [], steps: [] };
    const out = parseHandoffReply(JSON.stringify({ recipes: [broken, recipe('Good One')] }), answers);
    expect(out.map((r) => r.recipe.title)).toEqual(['Good One']);
  });

  it('explains what went wrong for empty or non-recipe text', () => {
    expect(() => parseHandoffReply('   ', answers)).toThrow(/Paste/);
    expect(() => parseHandoffReply('Sorry, I can’t help with that.', answers)).toThrow(/doesn’t look like/);
    expect(() => parseHandoffReply('{"recipes": []}', answers)).toThrow(/No complete recipes/);
  });

  it('gives the same id for the same dish, so pasting twice does not duplicate it', () => {
    const a = parseHandoffReply(JSON.stringify([recipe('Same Dish')]), answers)[0].recipe.id;
    const b = parseHandoffReply(JSON.stringify([recipe('Same Dish')]), answers)[0].recipe.id;
    expect(a).toBe(b);
  });
});

describe('helpers', () => {
  it('builds an idea card and a picture prompt from a recipe', () => {
    const [{ recipe: r }] = parseHandoffReply(JSON.stringify([recipe('Garlic Spaghetti')]), answers);
    expect(ideaFromRecipe(r, ['Creamy'])).toMatchObject({ key: r.id.slice(3), title: 'Garlic Spaghetti', reasons: ['Creamy'] });
    expect(pictureHandoffPrompt(r, 'dish')).toMatch(/^Create an image: Garlic Spaghetti/);
    expect(pictureHandoffPrompt(r, 'step-0')).toContain('Pasta boiling');
  });
});
