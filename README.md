# 🍴 Forkcast: "What should I cook?"

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

It works **free out of the box** with 790+ real recipes from [TheMealDB](https://www.themealdb.com). Turn on the **Gemini AI chef** to get recipes made for your exact answers, plus pictures of the dish and each step. It can run on your own Gemini app plan (copy & paste, no key, no cost) or automatically with a free API key.

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

1. Run `npm run dev:host`. (With plain npm, the flag needs `--` first: `npm run dev -- --host`.)
2. Vite prints a **Network** address, e.g. `http://192.168.1.4:5173`. Open it on your phone. It must be on the same Wi-Fi.
3. If it doesn't load, Windows Firewall is probably blocking Node.js. Allow it on **private** networks.

On a local-network address, phone browsers limit two features. Copy buttons may not work, so Forkcast then shows the text for you to copy by hand. Cook mode can't keep the screen awake. To get both, deploy the site to an https host such as Netlify or Vercel.

## Use Gemini (optional, free)

Forkcast can use Google Gemini in three ways. Choose one in **Settings → AI chef**.

### 💬 Gemini app (default): uses your Gemini plan, no key, no cost

Best if you have Gemini Pro (or just a Google account).

1. After the questions, press **Copy prompt & open Gemini**. Paste the prompt into a new chat on [gemini.google.com](https://gemini.google.com/app) and send it.
2. Press the copy button under Gemini's answer and paste the reply into Forkcast. You get **3 complete recipes** made for your answers.
3. **Pictures:** on a recipe, press **Make a Gemini picture** (or **Picture this step**).
   - Paste the picture prompt into Gemini.
   - Then drag Gemini's picture into Forkcast, paste it with Ctrl+V, or choose the downloaded file.
   - Pictures are saved on your device.

This runs on your normal Gemini app usage, so your plan's limits apply and there's nothing extra to pay. Other apps can't use a Gemini Pro plan directly; Google only allows that inside its own apps. That's why this mode uses copy & paste.

### 🔑 API key: automatic

1. Create a key at [Google AI Studio → API keys](https://aistudio.google.com/apikey).
2. Paste it in **Settings** and press **Save**. Forkcast tests it and picks models your key can use.

- **Free as long as you don't add billing.** A key whose Google Cloud project has no billing account can't be charged. When you reach the daily limit, Gemini just answers "quota reached".
- **Free tier covers recipes, not pictures.** AI recipe ideas work on the free tier. AI pictures through the API are paid-only, so keep **AI photos: Off** (the default) unless you turn on billing. Google AI Pro includes a monthly Google Cloud credit that can pay for this, but it requires a billing account.
- **Where the key lives.** It's stored only in your browser and sent only to Google.
- **Models.** Model names change often. Forkcast falls back automatically (for example `gemini-3.8-flash` → `gemini-3.5-flash`) and remembers the first one that works.

### 📚 Off

Only the free recipe library.

## Where the pictures come from

| Picture | Source |
|---|---|
| Library recipe photos and videos | TheMealDB |
| Ingredient pictures (in the checklist and each step) | TheMealDB ingredient images |
| Photos for AI recipes when AI images are off | Wikimedia Commons / Openverse (credited under the photo) |
| AI dish and step pictures | Made in the Gemini app and dropped in, or the Gemini API (paid). Saved on your device |

## How it picks recipes (free mode)

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
    gemini.ts           Gemini REST client (JSON + images, model fallback, errors)
    ai.ts               AI chef prompts, schemas, Gemini-app hand-off, image prompts & caching
    images.ts           live AI image state + a small request queue
    photos.ts           free Creative Commons photo search
    store.ts            app state (settings, answers, results, cookbook, timers)
    useRecipe.ts        loads a recipe from the library, the device, or the AI chef
  components/           Home, Wizard, Results, RecipePage, CookMode, Cookbook, Settings, GeminiHandoff…
PLAN.md                 the original plan and research notes
```

## Troubleshooting

- **The page didn't change after editing code.** On Windows, Vite's file watcher occasionally misses quick edits. Stop the dev server (Ctrl+C) and run `npm run dev` again.
- **"Couldn't load the recipe library."** Check your internet connection. After the first load, the library is cached for a week.
- **Gemini’s reply won’t paste in.** Use the copy button under Gemini’s whole answer (not just part of it). If Gemini answered in plain text, ask it: “Please reply with only the JSON code block”.
- **The AI chef shows an error (API mode).** Open **Settings → Test connection**. Common causes:
  - mistyped key
  - rate limit, so wait a minute
  - image generation without billing turned on (use the Gemini app for pictures instead)

## Credits

- Recipes, photos, ingredient pictures and videos: [TheMealDB](https://www.themealdb.com). Its free developer key is for personal and educational use.
- Free photos: [Wikimedia Commons](https://commons.wikimedia.org) and [Openverse](https://openverse.org).
- AI: [Google Gemini API](https://ai.google.dev).
