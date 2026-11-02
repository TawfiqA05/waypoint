# AGENTS.md

Waypoint is a travel dossier web app. Type a place and it builds an overview, stays, food, sights, events and flight guidance, ranked Budget / Mid-range / Splurge, with history, a trip builder and share links. No login.

This file describes the main branch. Work in progress may sit on other branches, so check `git branch -a` and `git log --oneline main..<branch>` before you assume something is missing or new.

## Stack

- Vite 5 + React 18, plain CSS in src/styles.css.
- Vercel serverless functions in api/:
  - api/gemini.js: proxies prompts to Google Gemini. Model is `GEMINI_MODEL`, default `gemini-3.6-flash`.
  - api/events.js: Ticketmaster Discovery (optional key).
  - api/photos.js: Unsplash (optional key).
- Keyless data from the browser: OpenStreetMap Nominatim and Overpass, Open-Meteo, REST Countries, Frankfurter. See src/lib/apis.js.
- Storage is localStorage only (src/lib/storage.js). Share links carry the trip in the URL hash.
- Hosting: Vercel, built from git. A push to main deploys production. A push to another branch makes a preview.

## Run it

- Install: `npm install`
- Full local app with functions: `npx vercel dev`
- Frontend only: `npm run dev` (AI, events and photo calls will 404 without the functions)
- Build: `npm run build`
- Preview a build: `npm run preview`
- Tests: main has no test script yet.
- Env vars (set in Vercel, never in the repo): `GEMINI_API_KEY` (required), `GEMINI_MODEL`, `TICKETMASTER_API_KEY`, `UNSPLASH_ACCESS_KEY` (optional). `.env.example` lists them with placeholder values.

## Project rules

- API keys stay server-side. The browser only POSTs prompts to /api/gemini and calls /api/events and /api/photos. Never call a keyed API from src/.
- Keep the app on free tiers. Every API and AI answer is cached per location (AI and places 14 days, geocoding 90 days, weather 6 hours, currency and events 1 day). Don't add calls that bypass the cache.
- AI calls are scarce. Don't send real Gemini requests in loops or tests. When loading saved storage in a browser check, block /api/gemini, because cached answers expire and would trigger new requests.
- AI picks are matched against OpenStreetMap places. Keep the "verified" and "AI-researched" badges honest: only a real match is verified.
- Flights is guidance plus prefilled search links. It does not show live fares; the prompt says prices are estimates.
- Never delete or rewrite a visitor's saved data in localStorage. A value that fails a new rule stays saved and is treated as not set.
- Use neutral examples in UI copy, prompts, tests and fixtures: a well-known airport like JFK, "a US airport" as the fallback, well-known cities. No personal locations.
- No em or en dashes in README, UI copy, AI prompts or commit messages.
- Plain, first-person voice in public text. No buzzwords.
- Don't add or upgrade dependencies without asking.
- The function file is named gemini.js. To change AI provider, change only api/gemini.js.

## Git rules

- Never force-push. Never rewrite pushed history.
- Don't delete branches, files or the repo unless told to in that session.
- No AI co-author trailers and no "Generated with" lines in commits, PRs or the README.
- Commit author is "Tawfiq Abulail".
- Keep .env, .env*.local, .vercel, dist and node_modules out of commits. Scan the diff for keys before pushing.
- Branch for new work. main deploys production on push, so push to main only when asked.

Status and decisions are in the private brain repo under projects/waypoint/.
