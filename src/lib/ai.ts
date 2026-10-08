import { CATEGORIES, CUISINES, DIETS, MOODS, SKILLS, TIMES, getCategory, getMeal } from '../data/taxonomy';
import { IMAGE_MODEL_FALLBACKS, TEXT_MODEL_FALLBACKS, compressDataUrl, generateImage, generateJson, parseJsonLoose } from './gemini';
import { ingredientImage } from './parse';
import { idbGet, idbSet } from './storage';
import { settingsStore } from './store';
import type { AiIdea, Answers, Difficulty, Recipe } from './types';

const SYSTEM = `You are Forkcast's AI chef: a warm, practical home-cooking expert.
- Suggest realistic, reliable home recipes that use ingredients from a normal supermarket.
- Dietary restrictions and allergies are strict rules, never break them.
- Use US measurements (cups, tbsp, oz, °F) and add metric in parentheses for weights and oven temperatures.
- Write clearly for the cook's skill level. Be specific about heat levels, visual cues and timings.`;

/** Describe the wizard answers in plain words for the prompt. */
export function describeAnswers(a: Answers): string {
  const cat = getCategory(a.category);
  const lines: string[] = [];
  const meal = getMeal(a.meal);
  if (meal) lines.push(`Meal: ${meal.label}`);
  if (cat) {
    const styles = cat.question?.options.filter((o) => a.styles.includes(o.id) && o.ai).map((o) => o.ai) ?? [];
    lines.push(`Kind of food: ${cat.ai}${styles.length ? ` — specifically ${styles.join(' or ')}` : ''}`);
  }
  const moods = MOODS.filter((m) => a.moods.includes(m.id)).map((m) => m.ai);
  if (moods.length) lines.push(`Flavor mood: ${moods.join(', ')}`);
  const time = TIMES.find((t) => t.id === a.time);
  if (time && time.id !== 'any') lines.push(`Time available: ${time.ai}`);
  const skill = SKILLS.find((s) => s.id === a.skill);
  if (skill && skill.id !== 'any') lines.push(`Cook's skill: ${skill.ai}`);
  const cuisines = CUISINES.filter((c) => a.cuisines.includes(c.id)).map((c) => c.label);
  if (cuisines.length) lines.push(`Cuisine: ${cuisines.join(' or ')}`);
  const diets = DIETS.filter((d) => a.diets.includes(d.id)).map((d) => d.ai);
  if (diets.length) lines.push(`MUST be: ${diets.join(', ')}`);
  if (a.include.length) lines.push(`Wants to use up: ${a.include.join(', ')}`);
  if (a.avoid.length) lines.push(`MUST NOT contain: ${a.avoid.join(', ')}`);
  lines.push(`Servings: ${a.servings}`);
  return lines.map((l) => `- ${l}`).join('\n');
}

function models(kind: 'text' | 'image'): string[] {
  const s = settingsStore.get();
  return kind === 'text' ? [s.textModel, ...TEXT_MODEL_FALLBACKS] : [s.imageModel, ...IMAGE_MODEL_FALLBACKS];
}

/** Remember a fallback model that worked so later calls go straight to it. */
function rememberModel(kind: 'text' | 'image', model: string) {
  const s = settingsStore.get();
  if (kind === 'text' && s.textModel !== model) settingsStore.set({ ...s, textModel: model });
  if (kind === 'image' && s.imageModel !== model) settingsStore.set({ ...s, imageModel: model });
}

function key(): string {
  const k = settingsStore.get().geminiKey.trim();
  if (!k) throw new Error('Add your Gemini API key in Settings to use the AI chef.');
  return k;
}

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];
const asDifficulty = (d: unknown): Difficulty => (DIFFICULTIES.includes(d as Difficulty) ? (d as Difficulty) : 'Medium');
const asInt = (n: unknown, fallback: number) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.round(Number(n)) : fallback);
const str = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/* ------------------------------------------------------------------ */
/* Ideas                                                               */
/* ------------------------------------------------------------------ */

const IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Appetizing dish name, max 6 words' },
          emoji: { type: 'string', description: 'One food emoji' },
          description: { type: 'string', description: 'One mouth-watering sentence, max 25 words' },
          cuisine: { type: 'string' },
          totalMinutes: { type: 'integer', minimum: 5 },
          difficulty: { type: 'string', enum: DIFFICULTIES },
          reasons: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3, description: 'Why it fits their answers, 2-4 words each' },
          keyIngredients: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
        },
        required: ['title', 'emoji', 'description', 'cuisine', 'totalMinutes', 'difficulty', 'reasons', 'keyIngredients'],
      },
    },
  },
  required: ['ideas'],
};

export async function suggestIdeas(answers: Answers, avoidTitles: string[] = [], signal?: AbortSignal): Promise<AiIdea[]> {
  const prompt = `Suggest 4 dishes this person would love to cook right now.

Their answers:
${describeAnswers(answers)}

Make the 4 ideas clearly different from each other (different main ingredient, technique or cuisine). Include one familiar classic and one more adventurous idea.${
    avoidTitles.length ? `\nDon't suggest any of these, they've already seen them: ${avoidTitles.slice(-30).join('; ')}.` : ''
  }`;
  const { data, model } = await generateJson<{ ideas: Partial<AiIdea>[] }>({ key: key(), models: models('text'), system: SYSTEM, prompt, schema: IDEAS_SCHEMA, signal });
  rememberModel('text', model);
  return (data.ideas ?? [])
    .filter((i) => str(i.title))
    .slice(0, 4)
    .map((i) => {
      const title = str(i.title);
      return {
        key: `${hash(title + JSON.stringify(answers))}`,
        title,
        emoji: str(i.emoji) || '🍽️',
        description: str(i.description),
        cuisine: str(i.cuisine),
        totalMinutes: asInt(i.totalMinutes, 30),
        difficulty: asDifficulty(i.difficulty),
        reasons: (i.reasons ?? []).map(str).filter(Boolean).slice(0, 3),
        keyIngredients: (i.keyIngredients ?? []).map(str).filter(Boolean).slice(0, 6),
      };
    });
}

/* ------------------------------------------------------------------ */
/* Full recipe                                                         */
/* ------------------------------------------------------------------ */

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string', description: '1-2 sentences' },
    cuisine: { type: 'string' },
    servings: { type: 'integer', minimum: 1 },
    totalMinutes: { type: 'integer', minimum: 5 },
    difficulty: { type: 'string', enum: DIFFICULTIES },
    equipment: { type: 'array', items: { type: 'string' } },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Plain ingredient name only, e.g. "garlic" or "chicken thighs"' },
          measure: { type: 'string', description: 'Amount and prep, e.g. "3 cloves, minced"' },
        },
        required: ['name', 'measure'],
      },
    },
    steps: {
      type: 'array',
      minItems: 3,
      maxItems: 12,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short step title, 2-5 words' },
          text: { type: 'string', description: '1-3 clear sentences with heat levels, times and visual cues' },
          minutes: { type: 'integer', minimum: 0, description: 'Cooking/waiting time for this step, 0 if none' },
          imagePrompt: { type: 'string', description: 'One sentence describing a photo of this step: what is in the pan/bowl and how it looks. No people, no text.' },
        },
        required: ['title', 'text', 'minutes', 'imagePrompt'],
      },
    },
    tips: { type: 'array', items: { type: 'string' }, description: '2-4 tips, including at least one substitution' },
  },
  required: ['title', 'description', 'cuisine', 'servings', 'totalMinutes', 'difficulty', 'equipment', 'ingredients', 'steps', 'tips'],
};

interface RawRecipe {
  title?: string;
  description?: string;
  cuisine?: string;
  servings?: number;
  totalMinutes?: number;
  difficulty?: string;
  equipment?: string[];
  ingredients?: { name?: string; measure?: string }[];
  steps?: { title?: string; text?: string; minutes?: number; imagePrompt?: string }[];
  tips?: string[];
}

export async function writeRecipe(idea: AiIdea, answers: Answers, signal?: AbortSignal): Promise<Recipe> {
  const prompt = `Write the complete recipe for "${idea.title}": ${idea.description}
Key ingredients: ${idea.keyIngredients.join(', ')}.

The cook's answers (respect every "MUST"):
${describeAnswers(answers)}

Requirements:
- Ingredient quantities for exactly ${answers.servings} serving${answers.servings === 1 ? '' : 's'}.
- 5-10 steps in cooking order. Merge tiny steps and split long ones.
- totalMinutes must be realistic, including prep.`;
  const { data, model } = await generateJson<RawRecipe>({ key: key(), models: models('text'), system: SYSTEM, prompt, schema: RECIPE_SCHEMA, signal });
  rememberModel('text', model);
  return normalizeRecipe(data, idea, answers);
}

/** Turn the AI's raw JSON into a clean Recipe, filling gaps from the idea. */
function normalizeRecipe(data: RawRecipe, idea: AiIdea, answers: Answers): Recipe {
  const ingredients = (data.ingredients ?? [])
    .map((i) => ({ name: str(i.name), measure: str(i.measure) }))
    .filter((i) => i.name)
    .map((i) => ({ ...i, image: ingredientImage(i.name) }));
  const steps = (data.steps ?? [])
    .map((s) => ({ title: str(s.title) || undefined, text: str(s.text), minutes: asInt(s.minutes, 0) || undefined, imagePrompt: str(s.imagePrompt) || undefined }))
    .filter((s) => s.text);
  if (!ingredients.length || !steps.length) throw new Error('The AI chef returned an incomplete recipe. Please try again.');

  return {
    id: `ai-${idea.key}`,
    source: 'ai',
    title: str(data.title) || idea.title,
    description: str(data.description) || idea.description,
    cuisine: str(data.cuisine) || idea.cuisine,
    tags: [],
    servings: asInt(data.servings, answers.servings),
    totalMinutes: asInt(data.totalMinutes, idea.totalMinutes),
    difficulty: asDifficulty(data.difficulty ?? idea.difficulty),
    ingredients,
    steps,
    equipment: (data.equipment ?? []).map(str).filter(Boolean),
    tips: (data.tips ?? []).map(str).filter(Boolean),
    emoji: idea.emoji,
    category: CATEGORIES.find((c) => c.id === answers.category)?.label,
  };
}

/* ------------------------------------------------------------------ */
/* Gemini app hand-off (copy & paste, uses the person's own Gemini plan) */
/* ------------------------------------------------------------------ */

const HANDOFF_SHAPE = `{
  "recipes": [
    {
      "title": "Dish name (max 6 words)",
      "emoji": "🍝",
      "description": "One mouth-watering sentence.",
      "cuisine": "Italian",
      "servings": 2,
      "totalMinutes": 30,
      "difficulty": "Easy | Medium | Hard",
      "reasons": ["why it fits them, 2-4 words", "another reason"],
      "equipment": ["Large skillet"],
      "ingredients": [{ "name": "garlic", "measure": "3 cloves, minced" }],
      "steps": [
        {
          "title": "Short step title",
          "text": "1-3 clear sentences with heat levels, times and visual cues.",
          "minutes": 5,
          "imagePrompt": "One sentence describing a photo of this step (what's in the pan and how it looks)."
        }
      ],
      "tips": ["A tip", "A substitution"]
    }
  ]
}`;

/** One prompt that asks the Gemini app for complete recipes, so it's a single copy & paste. */
export function buildHandoffPrompt(answers: Answers, avoidTitles: string[] = []): string {
  return `You are a warm, practical home-cooking expert. Suggest 3 complete recipes this person would love to cook right now.

Their answers (every "MUST" is a strict rule):
${describeAnswers(answers)}

Rules:
- Make the 3 recipes clearly different (different main ingredient, technique or cuisine). One familiar classic, one more adventurous.
- Realistic home recipes with normal supermarket ingredients. US measurements, with metric in parentheses for weights and oven temperatures.
- Ingredient amounts for exactly ${answers.servings} serving${answers.servings === 1 ? '' : 's'}. 5-10 steps each, in cooking order. Realistic total times including prep.${
    avoidTitles.length ? `\n- Don't suggest any of these, I've already seen them: ${avoidTitles.slice(-20).join('; ')}.` : ''
  }

Reply with ONLY one JSON code block, no other text, in exactly this shape:
\`\`\`json
${HANDOFF_SHAPE}
\`\`\``;
}

/**
 * Read the reply pasted back from the Gemini app. Accepts the whole reply (with or without
 * the code fence), a bare array, or a single recipe.
 */
export function parseHandoffReply(text: string, answers: Answers): { recipe: Recipe; reasons: string[] }[] {
  if (!text.trim()) throw new Error('Paste Gemini’s reply first.');
  let data: unknown;
  try {
    data = parseJsonLoose<unknown>(text);
  } catch {
    throw new Error('That doesn’t look like Gemini’s recipe reply. Copy its whole answer (the JSON code block) and paste it again.');
  }
  const obj = data as { recipes?: unknown; title?: unknown };
  const raw: (RawRecipe & Partial<AiIdea>)[] = Array.isArray(data) ? data : Array.isArray(obj.recipes) ? obj.recipes : obj && obj.title ? [obj as RawRecipe] : [];
  const recipes: { recipe: Recipe; reasons: string[] }[] = [];
  for (const r of raw) {
    const title = str(r?.title);
    if (!title) continue;
    const idea: AiIdea = {
      key: hash(title + JSON.stringify(answers)),
      title,
      emoji: str(r.emoji) || '🍽️',
      description: str(r.description),
      cuisine: str(r.cuisine),
      totalMinutes: asInt(r.totalMinutes, 30),
      difficulty: asDifficulty(r.difficulty),
      reasons: (Array.isArray(r.reasons) ? r.reasons : []).map(str).filter(Boolean).slice(0, 3),
      keyIngredients: [],
    };
    try {
      recipes.push({ recipe: normalizeRecipe(r, idea, answers), reasons: idea.reasons });
    } catch {
      // Skip an incomplete recipe but keep the others.
    }
  }
  if (!recipes.length) throw new Error('No complete recipes found in that reply. Make sure you copied all of it, then paste again.');
  return recipes;
}

/** The short idea card for a recipe that came from the Gemini app. */
export function ideaFromRecipe(recipe: Recipe, reasons: string[] = []): AiIdea {
  return {
    key: recipe.id.replace(/^ai-/, ''),
    title: recipe.title,
    emoji: recipe.emoji || '🍽️',
    description: recipe.description ?? '',
    cuisine: recipe.cuisine ?? '',
    totalMinutes: recipe.totalMinutes,
    difficulty: recipe.difficulty,
    reasons,
    keyIngredients: recipe.ingredients.slice(0, 4).map((i) => i.name),
  };
}

/** A prompt to paste into the Gemini app to make a picture. */
export function pictureHandoffPrompt(recipe: Recipe, slot: ImageSlot): string {
  return `Create an image: ${imagePrompt(recipe, slot)} Landscape 4:3.`;
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

export type ImageSlot = 'dish' | `step-${number}`;

export function imageCacheKey(recipeId: string, slot: ImageSlot) {
  return `img:${recipeId}:${slot}`;
}

export function getCachedImage(recipeId: string, slot: ImageSlot): Promise<string | undefined> {
  return idbGet<string>(imageCacheKey(recipeId, slot));
}

export function imagePrompt(recipe: Recipe, slot: ImageSlot): string {
  const base = 'Realistic, appetizing food photography, natural window light, home kitchen, shallow depth of field. No text, no watermarks, no people or hands.';
  if (slot === 'dish') {
    return `${recipe.title}${recipe.description ? `: ${recipe.description}` : ''}${recipe.cuisine ? ` (${recipe.cuisine} cuisine)` : ''}. Plated and ready to eat, shot from a 45-degree angle. ${base}`;
  }
  const index = Number(slot.split('-')[1]);
  const step = recipe.steps[index];
  const what = step.imagePrompt || `This moment while making ${recipe.title}: "${step.text.slice(0, 320)}"`;
  return `Step-by-step cooking photo for ${recipe.title}, step ${index + 1} of ${recipe.steps.length}. ${what}. Show the ingredients and cookware at this exact stage, from overhead or a close angle. ${base}`;
}

const inFlight = new Map<string, Promise<string>>();

/** Generate (or reuse) an AI image for a recipe slot and cache it locally. */
export function generateRecipeImage(recipe: Recipe, slot: ImageSlot, force = false): Promise<string> {
  const cacheKey = imageCacheKey(recipe.id, slot);
  const running = inFlight.get(cacheKey);
  if (running && !force) return running;
  const job = (async () => {
    if (!force) {
      const cached = await idbGet<string>(cacheKey);
      if (cached) return cached;
    }
    const { dataUrl, model } = await generateImage({
      key: key(),
      models: models('image'),
      prompt: imagePrompt(recipe, slot),
      aspectRatio: '4:3',
    });
    rememberModel('image', model);
    const small = await compressDataUrl(dataUrl);
    await idbSet(cacheKey, small);
    return small;
  })().finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, job);
  return job;
}
