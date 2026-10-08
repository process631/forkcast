# Forkcast — "What should I cook?" app

## Goal

An app that helps you decide what to cook or which new recipe to try:

1. **Pick the meal**: Breakfast & Brunch, Lunch, Dinner, Side Dish, Snack & Appetizer, or Dessert.
2. **Pick the kind of food**: Savory, Sweet Treats, Sandwiches, Pasta, Meat, Chicken, Seafood, and so on.
3. **Answer a few quick questions**, such as cooking style, flavor mood, time, skill, cuisine, diet and allergies, and ingredients to use up or avoid.
4. **Choose from a few tailored options.** Each one says why it matches your answers.
5. **Cook it step by step** with pictures, timers, an ingredient checklist and a hands-free cook mode.

## Research: how recipe apps organize food

Big recipe sites (Allrecipes, BBC Good Food, NYT Cooking) and TheMealDB all organize food along roughly the same five axes. Forkcast uses each axis at a different point in the flow:

| Axis | Examples | Where it shows up in Forkcast |
|---|---|---|
| **Meal / course** | breakfast, lunch, dinner, sides, snacks, dessert | Step 1 |
| **Dish type / main ingredient** | pasta, sandwiches, soups, chicken, seafood, baking | Step 2 (categories) |
| **Cuisine** | Italian, Mexican, Indian, Southeast Asian… | Question |
| **Diet & allergies** | vegetarian, vegan, gluten-free, nut-free… | Question (hard filter) |
| **Time & effort** | under 20 min, beginner-friendly… | Questions |

The step 2 categories are filtered by meal. For example, Breakfast shows Eggs, Pancakes & Waffles, Sweet Treats, Baking, Sandwiches and Savory first. Every category also has its own follow-up question. Pasta asks creamy, tomato, garlic & oil, baked, or noodles. Meat asks beef, pork, lamb, or goat.

## Data & image sources

| Need | Source | Cost / key |
|---|---|---|
| Real recipes (790+), photos, YouTube videos | [TheMealDB](https://www.themealdb.com/api.php), free dev key `1` | Free, no signup |
| Ingredient pictures (used for step visuals) | TheMealDB ingredient images | Free |
| Photos for AI-invented dishes | Wikimedia Commons, with Openverse as a backup. Both are Creative Commons and the app shows credits | Free, no key |
| Tailored AI recipe ideas + full recipes | Google Gemini text model (`gemini-3.8-flash` by default) | Your Gemini API key |
| AI photos of the dish and of each step | Gemini image model, "Nano Banana" (`gemini-3.1-flash-image` by default) | Your key (image generation usually needs billing enabled) |

The app works **fully without a key** by using the free library. A Gemini key adds unlimited AI-tailored ideas and generated pictures.

**Update: Gemini app mode (the default).** A Gemini Pro subscription only works inside Google's own apps, and other apps can't call it. So Forkcast can also hand off to the Gemini app:

1. It copies one ready-made prompt.
2. You paste it into gemini.google.com and paste the reply back.
3. Forkcast reads 3 complete recipes from that reply.

Pictures work the same way: Forkcast copies a picture prompt, Gemini makes the image, and you drop or paste it into Forkcast. This uses your own Gemini plan, with no key and no cost. The API-key mode stays available, and it is free as long as the key has no billing account. AI pictures through the API are paid-only, so they're off by default.

## Architecture

```
Browser (React + TypeScript, built with Vite)
 ├─ Wizard: meal → category → adaptive questions        src/components/Wizard.tsx
 ├─ Taxonomy: meals, categories, questions, cuisines   src/data/taxonomy.ts
 ├─ Matching engine (free mode)                        src/lib/match.ts
 │    TheMealDB library cached in IndexedDB (7 days)   src/lib/mealdb.ts
 │    Recipe parsing: steps, timers, time & difficulty src/lib/parse.ts
 │    Diet / allergy filters                           src/lib/diet.ts
 ├─ AI chef (optional)                                 src/lib/ai.ts, src/lib/gemini.ts
 │    ideas → full recipe (JSON schema output)
 │    dish + step images, cached in IndexedDB
 ├─ Free photos (Wikimedia / Openverse)                src/lib/photos.ts
 └─ Pages: Home, Results, Recipe, Cook mode, Cookbook, Settings
```

* **No backend.** The app is static, so it runs locally with `npm run dev` and can be deployed for free (Netlify, Vercel, GitHub Pages).
* **Gemini key.** You paste it into Settings. It stays in your browser's localStorage and is only sent to Google.
* **Model choice.** Model names change often, so Settings lists the models your key can actually use, and the app automatically falls back to another model if one is retired.

### Matching engine (free mode)

1. **Hard filters**: diet and allergies (vegetarian, vegan, pescatarian, gluten-free, dairy-free, nut-free, low-carb, no pork, no alcohol) and "avoid" ingredients.
2. **Category match**: keyword and category rules per food type. If fewer than 4 recipes match, the engine relaxes the rules and labels those results "close match".
3. **Score**:
   * how well it fits the meal
   * the category's style answer
   * flavor mood
   * cuisine
   * "use up" ingredients
   * estimated time vs. your time budget
   * estimated difficulty vs. your skill
   * a little randomness, so "show me different options" gives fresh picks
4. **Variety**: top picks avoid near-duplicates. Each card lists *why it matches*.

Time and difficulty are estimated from the instructions (for example "simmer for 20 minutes", "chill overnight", step count, ingredient count, and techniques like kneading or deep-frying).

### AI mode

* **Ideas**: Gemini gets all your answers and returns 4 ideas as strict JSON (title, why it matches, time, difficulty, key ingredients). They are shown next to real library recipes.
* **Full recipe**: picking an idea generates the recipe as JSON:
  * ingredients scaled to your servings
  * equipment
  * steps, each with a duration and an image prompt
  * tips and substitutions
* **Images**:
  * The dish photo is generated automatically when AI images are on.
  * Step photos are generated on demand, with a "Generate all step photos" button. Each image costs money, so this is your choice.
  * Library recipes can also get AI step photos.

## Features checklist

- [x] Meal → category → adaptive question wizard (skip any question, or jump straight to results)
- [x] 3–6 options with photo, time, difficulty, cuisine and "why it matches" chips, plus a "Show different options" button
- [x] Recipe page:
  - hero photo
  - ingredient checklist with ingredient pictures
  - numbered steps with pictures
  - auto-detected timers
  - embedded YouTube video
  - source link
- [x] Cook mode: one step at a time, big text, timers with alarm, keyboard/swipe navigation, screen kept awake
- [x] Cookbook: saved favorites + recently viewed
- [x] Settings: Gemini key, model pickers, AI image level, connection test, cache clearing
- [x] Light/dark theme, mobile-friendly layout
- [x] Unit tests for parsing, diet filters, matching, and Gemini response handling

## Build phases

1. **Foundation**: Vite + React + TS scaffold, design tokens, hash router, storage helpers.
2. **Data**: taxonomy, TheMealDB loader + cache, recipe parser, diet filters, matching engine, plus tests.
3. **UI flow**: Home → Wizard → Results → Recipe → Cook mode → Cookbook.
4. **Images**: ingredient visuals, YouTube embed, free CC photos with credits.
5. **AI**: Gemini client (JSON + images, model fallback, friendly errors), ideas, full recipes, image generation and caching.
6. **Polish & verify**: run the app in a browser, test every flow at desktop and phone widths, fix issues, write the README.

## Future ideas

* Pantry mode: "here's what's in my fridge, what can I make?" (partly covered by "use up" ingredients)
* Shopping list export, weekly meal planner
* Nutrition estimates (AI)
* Installable PWA with offline cookbook
* Optional tiny backend so the Gemini key never touches the browser (needed if you publish it for other people)
