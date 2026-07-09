# Waypoint — personal travel intelligence

Type a city, state, country, or address and get a full trip dossier: overview, hotels, food, sights, events, and flight guidance — ranked within Budget / Mid-range / Splurge tiers — plus automatic search history and a drag-and-drop itinerary builder.

Runs entirely on free tiers. No login required for you or anyone you share it with. All AI calls happen server-side with your own Gemini key — nobody using the site ever touches an Anthropic or Google account.

## Deploy (10 minutes, free)

1. **Get a Gemini API key** (free): https://aistudio.google.com → "Get API key". No card needed.
2. **(Optional) Ticketmaster key** for live event listings: https://developer.ticketmaster.com (free). Skip it and the Events tab still shows the AI seasonal-festival guide.
3. **(Optional) Unsplash key** for a header photo per destination: https://unsplash.com/developers (free demo tier). Skip it and the header just renders without a photo.
4. Push this folder to a GitHub repo.
5. Go to https://vercel.com (free Hobby plan), "Add New Project", import the repo. Vercel auto-detects Vite; the `api/` folder becomes serverless functions automatically. No config needed.
6. In Vercel → Project → Settings → Environment Variables, add:
   - `GEMINI_API_KEY` (required)
   - `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`)
   - `TICKETMASTER_API_KEY` (optional)
   - `UNSPLASH_ACCESS_KEY` (optional)
7. Deploy. Done — you get a `*.vercel.app` URL you can open on your phone and share.

Local dev: `npm install`, then `npx vercel dev` (runs the serverless functions too). Plain `npm run dev` runs the frontend only — AI/events/photos calls will 404 without the functions.

## Decisions I made (and why)

**Frontend + hosting: Vite + React on Vercel Hobby.** Static frontend, three tiny serverless functions in `api/`. Vercel's free tier (100 GB bandwidth, generous function invocations) is far beyond personal use, deploys from git automatically, and — unlike GitHub Pages — gives you server-side functions so API keys never reach the browser. Cloudflare Pages is the backup option if Vercel's terms ever change.

**LLM: Gemini 2.5 Flash free tier, proxied through `/api/gemini`.** The key lives only in a Vercel env var. The model name is an env var too, so when Google rotates model names you change one setting, not code. To switch to Claude later, only `api/gemini.js` changes — the client just POSTs prompts.

**Storage: localStorage, not a database.** For one user (and read-only sharing), a database adds setup, another free-tier dependency, and a failure mode — for zero benefit. Every saved record (history, trips, settings) already carries a `user_id` field, so migrating to Supabase free tier later is a data copy, not a rebuild. Sharing works today via encoded links (below), which need no backend at all.

**Caching: aggressive, client-side, per location.** Every API and LLM response is cached in localStorage with TTLs — LLM research and place data for 14 days, geocoding 90 days, weather 6 hours, currency and events 1 day. Revisiting a destination (or reopening it from History) costs zero API calls. This is what keeps you comfortably inside the Gemini free tier: a brand-new destination costs ~6 Gemini calls total (one per tab, and only when you open the tab); a revisit costs 0.

**Data sources (all validated as keyless or free-tier as of mid-2026 — re-check if something breaks):**
| Feature | Source | Key? |
|---|---|---|
| Geocoding (the search bar) | OSM Nominatim | none |
| Weather now + monthly climate | Open-Meteo forecast + archive | none |
| Country, currency, languages | REST Countries | none |
| Exchange rates | Frankfurter | none |
| Place verification layer | Overpass (OpenStreetMap) | none |
| Live ticketed events | Ticketmaster Discovery | free key, server-side |
| Destination photo | Unsplash | free key, server-side, optional |
| Rankings, packing, visa, customs, flights guidance | Gemini free tier | your key, server-side |

**Flights: guidance + deep links, not live prices, in v1.** Amadeus free tier requires OAuth token juggling and Kiwi's Tequila API now gates key issuance behind partner approval — both are fragile foundations for a free personal site. Instead the Flights tab gives AI trend guidance (cheapest months, booking tips, nearest airports from your saved home airport) plus one-click prefilled searches on Google Flights and Kiwi. If you later get an Amadeus key, it slots in as a fourth serverless function.

**"Verified" vs "AI-researched" badges.** Gemini's recommendations are cross-checked by name against real places pulled from OpenStreetMap around the destination. Matches get a green **✓ verified** badge (the place demonstrably exists); everything else is amber **~ AI-researched** so you know to double-check before booking. Richer verification (ratings, photos) via Google Places' monthly free credit is a clean upgrade path — it would slot into `withOsm()` in `src/components/Ranked.jsx`.

**Sharing without accounts.** "Copy share link" in My Trip encodes the itinerary + notes into the URL itself (base64 in the hash). Anyone opening it sees a read-only itinerary view — no backend, no login, works today. "Export PDF" uses the browser's print-to-PDF with a print stylesheet that strips the chrome.

## Free-tier math

Gemini free tier allows ~250+ requests/day on Flash-class models. Worst case here is 6 requests per *new* destination. You'd have to research 40+ brand-new places in a day to feel a limit, and cached destinations cost nothing. Nominatim/Overpass ask for light, non-commercial use — a personal site with 14–90-day caching is well within that. Vercel Hobby limits are effectively unreachable for a handful of users.

## Later, when friends join

- Swap localStorage for Supabase free tier: the `user_id` field is already on every record; add Supabase auth + a `trips`/`history` table and point `src/lib/storage.js` at it.
- Add Google Places for ratings/photos inside the monthly free credit.
- Add an Amadeus function for live fares.
