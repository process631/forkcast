import { describe, expect, it } from 'vitest';
import { estimateDifficulty, estimateMinutes, formatMinutes, ingredientsInStep, parseDurations, splitInstructions, stepTimers, youtubeId } from './parse';

describe('splitInstructions', () => {
  it('drops "STEP 1" marker lines and numbered prefixes', () => {
    const steps = splitInstructions('STEP 1\r\nHeat the oil.\r\nSTEP 2\r\n2. Add the onions and fry.\r\n3) Serve.');
    expect(steps.map((s) => s.text)).toEqual(['Heat the oil.', 'Add the onions and fry.', 'Serve.']);
  });

  it('turns short "For the sauce:" lines into the next step’s title', () => {
    const steps = splitInstructions('For the sauce:\nWhisk the cream and cheese.\nToss with pasta.');
    expect(steps[0]).toMatchObject({ title: 'For the sauce', text: 'Whisk the cream and cheese.' });
    expect(steps[1].title).toBeUndefined();
  });

  it('splits one long paragraph into bite-sized steps', () => {
    const blob =
      'Cook pasta according to package instructions in a large pot of boiling water and salt. Add heavy cream and butter to a large skillet over medium heat until the cream bubbles. Whisk in parmesan and add seasoning. Let the sauce thicken slightly and then add the pasta and toss until coated. Garnish with parsley, and it is ready.';
    const steps = splitInstructions(blob);
    expect(steps.length).toBeGreaterThan(1);
    expect(steps.every((s) => s.text.length <= 260)).toBe(true);
    expect(steps.map((s) => s.text).join(' ')).toBe(blob);
  });

  it('strips bullet characters, even without a space', () => {
    expect(splitInstructions('*Meanwhile, steam the vegetables.')[0].text).toBe('Meanwhile, steam the vegetables.');
  });

  it('returns nothing for empty text', () => {
    expect(splitInstructions('')).toEqual([]);
  });
});

describe('parseDurations', () => {
  it('reads ranges, words and hours', () => {
    expect(parseDurations('Simmer for 10-15 minutes.')).toMatchObject([{ min: 10, max: 15 }]);
    expect(parseDurations('Cook for one minute')).toMatchObject([{ min: 1, max: 1 }]);
    expect(parseDurations('Bake for 1 1/2 hours')).toMatchObject([{ min: 90, max: 90 }]);
    expect(parseDurations('Roast for 1½ hours')).toMatchObject([{ min: 90, max: 90 }]);
    expect(parseDurations('Leave for half an hour')).toMatchObject([{ min: 30, max: 30 }]);
    expect(parseDurations('Fry for a few minutes')).toMatchObject([{ min: 3, max: 3 }]);
  });

  it('ignores intervals like "every 10 minutes"', () => {
    expect(parseDurations('Stir every 10 minutes for 2 hours')).toMatchObject([{ min: 120, max: 120 }]);
  });

  it('marks long chilling / marinating / overnight time as passive', () => {
    expect(parseDurations('Marinate in the fridge for 4 hours')[0].passive).toBe(true);
    expect(parseDurations('Chill overnight').some((d) => d.passive && d.max === 480)).toBe(true);
    expect(parseDurations('Bake for 20 minutes')[0].passive).toBe(false);
  });
});

describe('stepTimers', () => {
  it('offers one timer per distinct duration, using the lower bound', () => {
    const timers = stepTimers('Bake for 15-20 minutes, then rest for 5 minutes. Bake 15 minutes more.');
    expect(timers.map((t) => t.min)).toEqual([15, 5]);
  });
});

describe('estimates', () => {
  it('estimates time from durations plus prep', () => {
    const steps = [{ text: 'Boil for 10 minutes.' }, { text: 'Bake for 30 minutes.' }];
    expect(estimateMinutes(6, steps)).toEqual({ total: 45, passive: false });
  });

  it('falls back to step count when no durations are written', () => {
    expect(estimateMinutes(4, [{ text: 'Mix.' }, { text: 'Serve.' }]).total).toBeGreaterThanOrEqual(10);
  });

  it('rates technique-heavy recipes as harder', () => {
    expect(estimateDifficulty(5, 3, 'Mix and serve.', 15)).toBe('Easy');
    expect(estimateDifficulty(14, 10, 'Knead the dough, prove, then deep-fry. Make a caramel.', 200)).toBe('Hard');
  });
});

describe('ingredientsInStep', () => {
  const ingredients = [
    { name: 'Red Onions', measure: '2' },
    { name: 'Olive Oil', measure: '2 tbsp' },
    { name: 'Garlic', measure: '3 cloves' },
    { name: 'Chilli Powder', measure: '1 tsp' },
  ];

  it('finds ingredients by full name, plural or last word, in order of appearance', () => {
    const found = ingredientsInStep('Heat the oil, then add the garlic and onion.', ingredients);
    expect(found.map((i) => i.name)).toEqual(['Olive Oil', 'Garlic', 'Red Onions']);
  });

  it('skips generic last words like "powder"', () => {
    expect(ingredientsInStep('Add the baking powder.', ingredients)).toEqual([]);
  });
});

describe('helpers', () => {
  it('formats minutes', () => {
    expect(formatMinutes(25)).toBe('25 min');
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(95)).toBe('1 hr 35 min');
  });

  it('extracts YouTube ids', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=1IszT_guI08')).toBe('1IszT_guI08');
    expect(youtubeId('https://youtu.be/1IszT_guI08')).toBe('1IszT_guI08');
    expect(youtubeId('')).toBeUndefined();
  });
});
