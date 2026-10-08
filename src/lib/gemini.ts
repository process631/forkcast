/**
 * Minimal Gemini API client (REST, runs in the browser with the user's own API key).
 *
 * Uses the generateContent endpoint, which Google keeps "fully supported" alongside the newer
 * Interactions API. Model names change often, so every call walks a fallback list and remembers
 * the first model that works.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const TEXT_MODEL_FALLBACKS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];
export const IMAGE_MODEL_FALLBACKS = ['gemini-3.1-flash-image', 'gemini-nano-banana-2.1', 'gemini-3.1-flash-lite-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image'];

export class GeminiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.code = code;
  }
}

// Gemini responses are loosely typed JSON.
type Json = any;

async function post(model: string, body: Json, key: string, signal?: AbortSignal): Promise<Json> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new GeminiError('Couldn’t reach Gemini. Check your internet connection.', 0, 'NETWORK');
  }
  const text = await res.text();
  let json: Json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const e = json?.error;
    throw new GeminiError(e?.message || `Gemini returned HTTP ${res.status}`, res.status, e?.status);
  }
  return json;
}

function isModelUnavailable(e: unknown): boolean {
  if (!(e instanceof GeminiError)) return false;
  if (e.status === 404) return true;
  return e.status === 400 && /model.*(not found|not supported|unsupported|is not available|does not exist)|not supported for generateContent|does not support|response modalit/i.test(e.message);
}

/** Request options some models reject. If a model complains, retry without them. */
const OPTIONAL_FIELDS: { re: RegExp; path: [string, string] }[] = [
  { re: /thinking/i, path: ['generationConfig', 'thinkingConfig'] },
  { re: /image_?config|aspect/i, path: ['generationConfig', 'imageConfig'] },
  { re: /json_?schema|response_?schema|schema/i, path: ['generationConfig', 'responseJsonSchema'] },
];

export function friendlyError(e: unknown): Error {
  if (!(e instanceof GeminiError)) return e instanceof Error ? e : new Error(String(e));
  const m = e.message;
  if (/API key not valid|API_KEY_INVALID|invalid api key/i.test(m) || e.code === 'UNAUTHENTICATED')
    return new GeminiError('Your Gemini API key isn’t valid. Check it in Settings.', e.status, e.code);
  if (e.status === 403)
    return new GeminiError('This API key doesn’t have access to Gemini (403). Make sure the key is from Google AI Studio.', e.status, e.code);
  if (e.status === 429)
    return new GeminiError(
      'Gemini says you’ve hit a rate limit or quota. Wait a minute and try again. (Image generation usually needs a key with billing turned on.)',
      e.status,
      e.code,
    );
  if (isModelUnavailable(e))
    return new GeminiError('The Gemini models we tried aren’t available for your key. Open Settings → “Test connection” to pick one.', e.status, e.code);
  if (e.status >= 500) return new GeminiError('Gemini is having trouble right now. Please try again in a moment.', e.status, e.code);
  return e;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST to the preferred model, falling back to others when a model is retired/unavailable,
 * dropping optional fields a model rejects, and retrying once on a server hiccup.
 */
export async function generate(opts: {
  key: string;
  models: string[];
  body: Json;
  signal?: AbortSignal;
}): Promise<{ json: Json; model: string }> {
  const models = [...new Set(opts.models.filter(Boolean))];
  let lastError: unknown;
  for (const model of models) {
    const body = structuredClone(opts.body);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return { json: await post(model, body, opts.key, opts.signal), model };
      } catch (e) {
        lastError = e;
        if ((e as Error)?.name === 'AbortError') throw e;
        if (e instanceof GeminiError && e.status === 400) {
          const fix = OPTIONAL_FIELDS.find((f) => f.re.test(e.message) && body[f.path[0]]?.[f.path[1]] !== undefined);
          if (fix) {
            delete body[fix.path[0]][fix.path[1]];
            continue;
          }
        }
        if (isModelUnavailable(e)) break; // try the next model
        if (e instanceof GeminiError && (e.status >= 500 || e.status === 0) && attempt === 0) {
          await sleep(1200);
          continue;
        }
        throw friendlyError(e);
      }
    }
  }
  throw friendlyError(lastError);
}

function checkBlocked(json: Json) {
  const block = json?.promptFeedback?.blockReason;
  if (block) throw new GeminiError(`Gemini declined this request (${block}). Try different wording.`, 400, 'BLOCKED');
  const finish = json?.candidates?.[0]?.finishReason;
  if (!json?.candidates?.length || (finish && /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(finish) && !json.candidates[0].content?.parts?.length))
    throw new GeminiError(`Gemini returned no result${finish ? ` (${finish})` : ''}. Please try again.`, 400, 'EMPTY');
}

/** Visible text of the first candidate (skips "thought" parts). */
export function extractText(json: Json): string {
  checkBlocked(json);
  const parts: Json[] = json.candidates[0].content?.parts ?? [];
  return parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
}

/** The final generated image as a data URL (skips interim "thought" images). */
export function extractImage(json: Json): string {
  checkBlocked(json);
  const parts: Json[] = json.candidates[0].content?.parts ?? [];
  const images = parts.filter((p) => (p.inlineData || p.inline_data) && !p.thought);
  const img = images[images.length - 1];
  if (!img) {
    const said = parts.find((p) => typeof p.text === 'string')?.text;
    throw new GeminiError(said ? `No image came back. Gemini said: “${said.slice(0, 160)}”` : 'No image came back from Gemini. Please try again.', 400, 'NO_IMAGE');
  }
  const data = img.inlineData ?? img.inline_data;
  return `data:${data.mimeType ?? data.mime_type ?? 'image/png'};base64,${data.data}`;
}

/** Parse JSON that might be wrapped in ``` fences or have stray text around it. */
export function parseJsonLoose<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start >= 0 && end > start) {
      const inner = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(inner) as T;
      } catch {
        // Chat replies sometimes leave trailing commas or use curly quotes around keys.
        const repaired = inner.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
        try {
          return JSON.parse(repaired) as T;
        } catch {
          /* fall through */
        }
      }
    }
    throw new GeminiError('Gemini’s answer wasn’t valid JSON. Please try again.', 400, 'BAD_JSON');
  }
}

export async function generateJson<T>(opts: {
  key: string;
  models: string[];
  system: string;
  prompt: string;
  schema: Json;
  signal?: AbortSignal;
}): Promise<{ data: T; model: string }> {
  const { json, model } = await generate({
    key: opts.key,
    models: opts.models,
    signal: opts.signal,
    body: {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: opts.schema,
        thinkingConfig: { thinkingLevel: 'low' },
      },
    },
  });
  return { data: parseJsonLoose<T>(extractText(json)), model };
}

export async function generateImage(opts: {
  key: string;
  models: string[];
  prompt: string;
  aspectRatio?: string;
  signal?: AbortSignal;
}): Promise<{ dataUrl: string; model: string }> {
  const { json, model } = await generate({
    key: opts.key,
    models: opts.models,
    signal: opts.signal,
    body: {
      contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: opts.aspectRatio ?? '4:3' },
      },
    },
  });
  return { dataUrl: extractImage(json), model };
}

export interface ModelInfo {
  id: string;
  name: string;
  kind: 'text' | 'image';
}

/** List the models this key can use with generateContent. Also works as a connection test. */
export async function listModels(key: string): Promise<ModelInfo[]> {
  const out: ModelInfo[] = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    let res: Response;
    try {
      res = await fetch(`${BASE}/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, {
        headers: { 'x-goog-api-key': key },
      });
    } catch {
      throw new GeminiError('Couldn’t reach Gemini. Check your internet connection.', 0, 'NETWORK');
    }
    const json: Json = await res.json().catch(() => null);
    if (!res.ok) throw friendlyError(new GeminiError(json?.error?.message || `HTTP ${res.status}`, res.status, json?.error?.status));
    for (const m of json?.models ?? []) {
      const id = String(m.name || '').replace(/^models\//, '');
      if (!id.startsWith('gemini') || !(m.supportedGenerationMethods ?? []).includes('generateContent')) continue;
      if (/embedding|tts|audio|live|robotics|computer-use|aqa/i.test(id)) continue;
      out.push({ id, name: m.displayName || id, kind: /image|banana/i.test(id) ? 'image' : 'text' });
    }
    pageToken = json?.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/** Shrink a generated image to a JPEG so the local cache stays small. */
export async function compressDataUrl(dataUrl: string, maxWidth = 1024, quality = 0.86): Promise<string> {
  if (typeof document === 'undefined') return dataUrl;
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUrl;
  }
}
