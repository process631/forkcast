# 🍴 Forkcast: "What should I cook?"

**Live site: <https://process631.github.io/forkcast/>**

Forkcast helps you decide what to cook and then walks you through it step by step:

1. **Pick a meal**: Breakfast & Brunch, Lunch, Dinner, Side Dish, Snack & Appetizer, or Dessert.
2. **Pick a kind of food**: Pasta, Chicken, Sandwiches, Soups, Sweet Treats… The list adapts to the meal you picked.
3. **Answer a few quick questions** (skip any of them):
   - one follow-up for that kind of food ("Which meat?", "What sauce style?", "Happy to turn the oven on?")
   - flavor mood
   - time and skill
   - cuisine
   - diets and allergies
   - ingredients to use up or avoid
4. **Choose from a few options**, each with a photo and the reasons it matches you.
5. **Cook it**:
   - ingredient checklist with pictures
   - numbered steps showing the ingredients each step uses
   - one-tap timers
   - an embedded video
   - a full-screen **cook mode** that keeps your screen on

It's free with no sign-up, using 790+ real recipes from [TheMealDB](https://www.themealdb.com).

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

| Command | What it does |
|---|---|
| `npm run dev` | Start the app with live reload |
| `npm run dev:host` | Same, but also reachable from your phone on the same Wi-Fi |
| `npm test` | Run the unit tests |
| `npm run build` | Type-check and build a static site into `dist/` |
| `npm run preview` | Serve the built site locally |

### Open it on your phone

The easiest way is the live site, which works on any phone. To test your local copy instead:

1. Run `npm run dev:host`. (With plain npm, the flag needs `--` first: `npm run dev -- --host`.)
2. Vite prints a **Network** address, e.g. `http://192.168.1.4:5173`. Open it on your phone. It must be on the same Wi-Fi.
3. If it doesn't load, Windows Firewall is probably blocking Node.js. Allow it on **private** networks.

On a local-network address, phone browsers don't let cook mode keep the screen awake. The live site (https) doesn't have this limit.

## Publishing (GitHub Pages)

Every push to `main` runs `.github/workflows/deploy.yml`, which:

1. installs dependencies
2. runs the tests
3. builds the site
4. publishes it to GitHub Pages

The site uses relative paths (`base: './'` in `vite.config.ts`) and `#/…` page addresses, so it works from the `/forkcast/` sub-folder without any server setup.

## How it picks recipes

All of this lives in `src/lib/match.ts`:

1. **Hard filters.** Diets and allergies (vegetarian, vegan, pescatarian, gluten-free, dairy-free, nut-free, egg-free, low-carb, no pork, no alcohol) and your "avoid" list remove recipes based on ingredient names.
2. **Category rules.** Each food type has keyword and category rules, defined in `src/data/taxonomy.ts`. If too few recipes match, the closest picks are shown and labeled.
3. **Scoring.** Each recipe gets a score for:
   - how well it fits the meal
   - your follow-up answer
   - flavor mood
   - cuisine
   - ingredients to use up
   - time and skill, estimated from the instructions (e.g. "simmer 20 minutes", "chill overnight", knead/deep-fry)
   - a little randomness, so "Show me different options" gives fresh picks
4. **Variety.** Near-duplicates (e.g. "Fettuccine Alfredo" vs. "Fettucine alfredo") are never shown together.

## Project layout

```
src/
  data/taxonomy.ts      meals, categories, follow-up questions, cuisines, diets
  lib/
    mealdb.ts           loads & caches the TheMealDB catalog (IndexedDB, 7 days)
    parse.ts            instructions → steps, timers, time & difficulty estimates
    diet.ts             diet / allergy checks
    match.ts            the recommendation engine
    questions.ts        which question screens to show
    store.ts            app state (answers, results, cookbook, timers)
    useRecipe.ts        loads a recipe from the library (or a saved copy when offline)
  components/           Home, Wizard, Results, RecipePage, CookMode, Cookbook, Settings…
PLAN.md                 the original plan and research notes
```

## AI features (removed for now)

An earlier version had an optional Google Gemini "AI chef":

- AI-written recipes, either by copy & paste with the Gemini app or through the Gemini API
- AI pictures of each dish and step

They were taken out to keep the app simple. The full AI version is saved in git commit `f14113e`.

## Troubleshooting

- **The page didn't change after editing code.** On Windows, Vite's file watcher occasionally misses quick edits. Stop the dev server (Ctrl+C) and run `npm run dev` again.
- **"Couldn't load the recipe library."** Check your internet connection. After the first load, the library is cached for a week.

## Credits

Recipes, photos, ingredient pictures and videos: [TheMealDB](https://www.themealdb.com). Its free developer key is for personal and educational use.
