# 🍴 Forkcast: "What should I cook?"

**Live site: <https://process631.github.io/forkcast/>**

Forkcast helps you decide what to cook and then walks you through it step by step:

1. **Pick a meal**: Breakfast & Brunch, Lunch, Dinner, Side Dish, Snack & Appetizer, Dessert, or **Drinks**.
2. **Pick a kind of food**: Pasta, Chicken, Stir-fries, BBQ & Kebabs, Pizza & Flatbreads, Tacos & Empanadas, Dumplings, Soups, Sweet Treats… The list adapts to the meal you picked. Drinks has Mocktails, Shakes & Smoothies, Coffee/Tea/Cocoa, Cocktails (21+) and Punch & Party.
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

It's free with no sign-up, using 1,200+ real recipes and drinks from three free, keyless APIs:

| Source | What it adds | Ids |
|---|---|---|
| [TheMealDB](https://www.themealdb.com) | ~790 recipes with photos, ingredient pictures and videos | `mdb-…` |
| [DummyJSON](https://dummyjson.com/docs/recipes) | ~50 world recipes with real prep/cook times and difficulty | `djr-…` |
| [TheCocktailDB](https://www.thecocktaildb.com) | ~420 drinks: cocktails, mocktails, shakes, coffee & tea | `cdb-…` |

**Version 1.1.0**: stable and live.

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

## Loading the library (and what happens offline)

`src/lib/library.ts` downloads every source once and caches each one in IndexedDB for a week.

- Each request times out after 12 seconds and is retried once (`src/lib/net.ts`).
- If one source is down, the others still load, and the results page says which source is missing, with a **Try again** link.
- If the network fails, an out-of-date saved copy is used rather than nothing. A partial download is used but never cached.
- When the browser comes back online, the library reloads quietly.
- **Settings → Refresh recipe library** forces a fresh download.

## How it picks recipes

All of this lives in `src/lib/match.ts`:

1. **Food or drink.** Drinks only appear under the Drinks meal, and food never does.
2. **Hard filters.** Diets and allergies (vegetarian, vegan, pescatarian, gluten-free, dairy-free, nut-free, egg-free, low-carb, no pork, no alcohol) and your "avoid" list remove recipes based on ingredient names. "No alcohol" also removes every alcoholic drink.
3. **Category rules.** Each food type has keyword and category rules, defined in `src/data/taxonomy.ts`. If too few recipes match, the closest picks are shown and labeled.
4. **Scoring.** Each recipe gets a score for:
   - how well it fits the meal
   - your follow-up answer
   - flavor mood
   - cuisine
   - ingredients to use up
   - time and skill, estimated from the instructions (e.g. "simmer 20 minutes", "chill overnight", knead/deep-fry)
   - a little randomness, so "Show me different options" gives fresh picks
5. **Variety.** Near-duplicates (e.g. "Fettuccine Alfredo" vs. "Fettucine alfredo") are never shown together.

## Project layout

```
src/
  data/taxonomy.ts      meals, categories, follow-up questions, cuisines, diets
  lib/
    library.ts          loads every source, caches each for 7 days, reports partial/offline loads
    net.ts              fetch with timeout + retry and friendly error messages
    item.ts             the shared recipe shape every source is converted into
    mealdb.ts           TheMealDB source
    dummyjson.ts        DummyJSON source
    cocktaildb.ts       TheCocktailDB source (drinks)
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
- **"…couldn't be reached, so you're seeing fewer recipes than usual."** One source was down. Tap **Try again**, or carry on with the others.

## Roadmap

- Done in 1.1: more sources (DummyJSON, TheCocktailDB), a Drinks meal, 5 new kinds of food, more cuisines and moods, sturdier offline/network handling.
- Next ideas: optional keyed sources such as Spoonacular (they would need a small backend to keep the key secret), and maybe bringing back the AI features (see below).

## Credits

Recipes, photos, ingredient pictures and videos: [TheMealDB](https://www.themealdb.com). Drinks: [TheCocktailDB](https://www.thecocktaildb.com). Their free developer key is for personal and educational use. Extra recipes: [DummyJSON](https://dummyjson.com).
