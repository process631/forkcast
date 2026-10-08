import { generateRecipeImage, getCachedImage, imageCacheKey, type ImageSlot } from './ai';
import { compressDataUrl } from './gemini';
import { idbSet } from './storage';
import { createStore } from './store';
import type { Recipe } from './types';

/** Live state of AI images, keyed by cache key, so every view of a step updates together. */
export interface ImageState {
  status: 'loading' | 'done' | 'error';
  url?: string;
  error?: string;
}

export const imagesStore = createStore<Record<string, ImageState>>({});

function setImage(key: string, state: ImageState) {
  imagesStore.set((prev) => ({ ...prev, [key]: state }));
}

/** Load an already-generated image from the local cache into the store (no API call). */
export async function loadCachedImage(recipe: Recipe, slot: ImageSlot): Promise<boolean> {
  const key = imageCacheKey(recipe.id, slot);
  const current = imagesStore.get()[key];
  if (current?.status === 'done' || current?.status === 'loading') return true;
  const url = await getCachedImage(recipe.id, slot);
  if (url) setImage(key, { status: 'done', url });
  return Boolean(url);
}

/* A small queue so "generate all step photos" doesn't fire 10 requests at once. */
const CONCURRENCY = 2;
let active = 0;
const queue: (() => Promise<void>)[] = [];

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const job = queue.shift()!;
    active++;
    job().finally(() => {
      active--;
      pump();
    });
  }
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Couldn’t read that picture.'));
    reader.readAsDataURL(file);
  });
}

/** Save a picture the person made elsewhere (e.g. in the Gemini app) for a recipe slot. */
export async function saveUserImage(recipe: Recipe, slot: ImageSlot, file: Blob): Promise<void> {
  if (!file.type.startsWith('image/')) throw new Error('That isn’t a picture. Try a PNG or JPG.');
  if (file.size > 25 * 1024 * 1024) throw new Error('That picture is too big (over 25 MB).');
  const url = await compressDataUrl(await readAsDataUrl(file));
  await idbSet(imageCacheKey(recipe.id, slot), url);
  setImage(imageCacheKey(recipe.id, slot), { status: 'done', url });
}

export function requestImage(recipe: Recipe, slot: ImageSlot, force = false) {
  const key = imageCacheKey(recipe.id, slot);
  const current = imagesStore.get()[key];
  if (current?.status === 'loading') return;
  if (current?.status === 'done' && !force) return;
  setImage(key, { status: 'loading', url: current?.url });
  queue.push(async () => {
    try {
      const url = await generateRecipeImage(recipe, slot, force);
      setImage(key, { status: 'done', url });
    } catch (e) {
      setImage(key, { status: 'error', url: current?.url, error: (e as Error).message });
    }
  });
  pump();
}
