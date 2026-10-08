# Forkcast: notes for Claude Code

Forkcast is a static React 19 + TypeScript + Vite app ("What should I cook?"). It runs a wizard (meal → kind of food → follow-up questions), recommends recipes, and has a step-by-step cook mode. There is no backend. It is deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

## Commands
- `npm ci`: install
- `npm run dev`: dev server on http://localhost:5173 (`PORT` env var overrides)
- `npm test`: vitest (jsdom)
- `npm run typecheck`: `tsc`
- `npm run build`: tsc + vite build into `dist/`

## Layout
- `src/data/taxonomy.ts`: meals, categories (with matching rules and follow-up questions), moods, cuisines (country → group), diets. Most "more options" work happens here.
- `src/lib/library.ts`: loads all sources, caches each in IndexedDB for 7 days, keeps `libraryStatus()` up to date, and has `getLibraryRecipe(id)`.
- `src/lib/net.ts`: `fetchJson` (12 s timeout, one retry, friendly errors) and `fetchByLetter`.
- `src/lib/item.ts`: `LibraryItem` and `buildItem()`. Every source maps its records into this one shape.
- Sources: `mealdb.ts` (`mdb-` ids), `dummyjson.ts` (`djr-`), `cocktaildb.ts` (`cdb-`, drinks). To add a source, write a `Source` object and add it to `SOURCES` in `library.ts`.
- `src/lib/match.ts`: scoring and filtering. `src/lib/diet.ts`: diet and allergy keyword rules.
- `src/lib/questions.ts`: which wizard screens show for an answer set (drinks skip mood, time, skill and cuisine).
- `src/components/`: UI. Hash routing is in `src/router.ts`.

## Conventions and gotchas
- Sources must be free, keyless and CORS-enabled. Any API key would be public on GitHub Pages.
- Categories use TheMealDB-style names ("Beef", "Dessert", "Side", "Starter"…). Other sources map onto them so one set of rules fits all.
- `LibraryItem.kind` is `food` or `drink`. Food and drinks never mix in results or in "Surprise me".
- Before adding a taxonomy option, check its regexes against the real catalogs (download them with `search.php?f=a..z`). Thin categories fall back to labeled "close matches".
- Saved recipes (localStorage) may lack the `source` or `kind` fields. Treat a missing value as TheMealDB food.
- JS `\b` only understands ASCII letters, so accented words need care in regexes.
- On Windows, Vite's file watcher sometimes misses edits; restart `npm run dev`.
- Writing TS through Python or shell heredocs can turn `\b` into a backspace character. Prefer the editor tools.
