import { describe, expect, it } from 'vitest';
import { normalizeMeal, type RawMeal } from './mealdb';
import { httpUrl, safeImageSrc, YOUTUBE_ID } from './urls';

describe('httpUrl', () => {
  it('keeps http and https links', () => {
    expect(httpUrl('https://www.themealdb.com/meal/52772')).toBe('https://www.themealdb.com/meal/52772');
    expect(httpUrl(' http://example.com/a ')).toBe('http://example.com/a');
  });

  it('drops other schemes and junk', () => {
    expect(httpUrl('javascript:alert(1)')).toBeUndefined();
    expect(httpUrl('data:text/html,hi')).toBeUndefined();
    expect(httpUrl('not a url')).toBeUndefined();
    expect(httpUrl(null)).toBeUndefined();
  });
});

describe('safeImageSrc', () => {
  it('allows remote images, blobs, and image data urls', () => {
    expect(safeImageSrc('https://www.themealdb.com/images/media/meals/x.jpg')).toMatch(/^https:/);
    expect(safeImageSrc('blob:https://example.com/8c3c')).toMatch(/^blob:/);
    expect(safeImageSrc('data:image/png;base64,aaaa')).toMatch(/^data:image\/png/);
  });

  it('drops scriptable sources', () => {
    expect(safeImageSrc('javascript:alert(1)')).toBeUndefined();
    expect(safeImageSrc('data:text/html,<script>alert(1)</script>')).toBeUndefined();
  });
});

describe('normalizeMeal links', () => {
  it('does not keep a javascript source or thumbnail', () => {
    const raw: RawMeal = {
      idMeal: '1',
      strMeal: 'Toast',
      strCategory: 'Breakfast',
      strArea: 'British',
      strInstructions: 'Toast the bread for 2 minutes.',
      strMealThumb: 'javascript:alert(1)',
      strTags: null,
      strYoutube: 'javascript:alert(1)',
      strSource: 'javascript:alert(1)',
    };
    const item = normalizeMeal(raw);
    expect(item.recipe.image).toBeUndefined();
    expect(item.recipe.sourceUrl).toBeUndefined();
    expect(item.recipe.youtube).toBeUndefined();
    expect(YOUTUBE_ID.test('1IszT_guI08')).toBe(true);
    expect(YOUTUBE_ID.test('javascript:alert(1)')).toBe(false);
  });
});
