import { cacheGet, cacheSet } from './storage.js';

async function ask(prompt, json = true) {
  const r = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, json })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'AI request failed');
  if (!json) return data.text;
  try {
    return JSON.parse(data.text.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('AI returned an unreadable answer. Try again.');
  }
}

async function cachedAsk(cacheKey, prompt) {
  const hit = cacheGet('llm', cacheKey);
  if (hit) return hit;
  const out = await ask(prompt);
  cacheSet('llm', cacheKey, out);
  return out;
}

const placeLine = (p) => `${p.displayName} (lat ${p.lat}, lon ${p.lon})`;

export function markVerified(items, osm) {
  const names = new Set(osm.map(o => o.name.toLowerCase()));
  return items.map(it => {
    const n = (it.name || '').toLowerCase();
    const verified = names.has(n) || [...names].some(x => x.includes(n) || n.includes(x));
    return { ...it, verified };
  });
}

const RANKS = 'rank must be exactly one of: "must" | "solid" | "skip"';
const TIERS = 'tier must be exactly one of: "budget" | "mid" | "splurge"';

export function overviewPrompt(p, weatherSummary, trip) {
  return `You are a meticulous travel researcher. Destination: ${placeLine(p)}.
Traveler window: ${trip.start || 'unspecified'} to ${trip.end || 'unspecified'}, ${trip.days || 'unknown'} days, style: ${trip.style || 'general'}.
Climate data (real, from Open-Meteo): ${weatherSummary}.
Respond ONLY with JSON matching:
{
 "bestTime": {"months": "e.g. Mar-May and Oct", "why": "1-2 sentences weighing weather, prices, crowds"},
 "budgetPerDayUSD": {"budget": number, "mid": number, "splurge": number, "note": "what these cover"},
 "packing": ["8-14 items tailored to the season, trip length, and destination"],
 "safety": {"level": "low|moderate|elevated concern", "notes": ["3-6 short items: areas to be careful in, common scams, health/vaccine notes"]},
 "visa": {"summary": "entry requirements for a US passport holder, 2-3 sentences", "confidence": "note this changes often and should be confirmed on the official government site"},
 "connectivity": {"esim": "best eSIM/SIM options and rough cost", "wifi": "wifi availability"},
 "customs": {"tipping": "...", "dress": "...", "phrases": [{"phrase":"local phrase","meaning":"english"} x3-5]},
 "gettingAround": {"summary": "transit, rideshare, walkability", "airportTransfer": "options + rough cost"}
}`;
}

export function stayPrompt(p, osmSample) {
  return `You are a hotel researcher for ${placeLine(p)}.
Real hotels known to exist here (from OpenStreetMap): ${osmSample}.
Recommend 9-12 total places to stay across tiers. Prefer real, well-known properties; you may include others you are confident exist. Respond ONLY with JSON:
{
 "neighborhoods": [{"name":"...", "why":"1 sentence on who should stay here"} x3-5],
 "hotels": [{"name":"...", "tier":"budget|mid|splurge", "rank":"must|solid|skip", "pricePerNightUSD":"rough range", "why":"1-2 sentences", "neighborhood":"..."}]
}
${TIERS}. ${RANKS}. Include at least one "skip" per tier so rankings are honest.`;
}

export function eatPrompt(p, osmSample) {
  return `You are a food researcher for ${placeLine(p)}.
Real restaurants/cafes known to exist here (from OpenStreetMap): ${osmSample}.
Recommend 10-14 places across tiers with a genuine mix of cuisines (local staples first, not just tourist-famous spots). Respond ONLY with JSON:
{"restaurants":[{"name":"...","tier":"budget|mid|splurge","rank":"must|solid|skip","cuisine":"...","dish":"one thing to order","why":"1 sentence"}]}
${TIERS}. ${RANKS}. Include at least one "skip" per tier.`;
}

export function seeDoPrompt(p, osmSample) {
  return `You are a sightseeing researcher for ${placeLine(p)}.
Real attractions known to exist here (from OpenStreetMap): ${osmSample}.
Respond ONLY with JSON:
{
 "iconic": [{"name":"...","unmissable":true|false,"why":"1 sentence","timeNeeded":"e.g. 2h"} x4-7],
 "sightseeing": [{"name":"...","rank":"must|solid|skip","why":"1 sentence"} x5-8],
 "outdoors": [{"name":"...","type":"hike|park|beach|other","difficulty":"easy|moderate|hard","why":"1 sentence"} x2-5],
 "dayTrips": [{"name":"...","travelTime":"e.g. 1h by train","why":"1 sentence"} x2-4]
}
${RANKS}.`;
}

export function eventsPrompt(p, windowText) {
  return `Destination: ${placeLine(p)}. Travel window: ${windowText || 'unspecified'}.
List recurring seasonal festivals/holidays a visitor should plan around (worth attending, or worth avoiding for crowds/closures). Respond ONLY with JSON:
{"seasonal":[{"name":"...","when":"month/season","attendOrAvoid":"attend|avoid|depends","why":"1 sentence"} x4-8]}`;
}

export function flightsPrompt(p, homeAirport) {
  return `Flight-planning guidance from ${homeAirport || 'a mid-size US airport'} to ${p.city || p.name}, ${p.country}.
You cannot see live prices; give trend guidance only. Respond ONLY with JSON:
{
 "nearestAirports": [{"code":"XXX","name":"..."} x1-3],
 "typicalRoundTripUSD": "realistic range from ${homeAirport || 'the US Midwest'}",
 "cheapestMonths": "...",
 "priciestMonths": "...",
 "bookingTips": ["3-5 short, concrete tips (days to fly, layover hubs, how far ahead to book)"]
}`;
}

const MORE_SPECS = {
  stay: {
    field: 'hotels', cachePrefix: 'st',
    item: '{"name":"...","tier":"budget|mid|splurge","rank":"must|solid|skip","pricePerNightUSD":"rough range","why":"1-2 sentences","neighborhood":"..."}'
  },
  eat: {
    field: 'restaurants', cachePrefix: 'ea',
    item: '{"name":"...","tier":"budget|mid|splurge","rank":"must|solid|skip","cuisine":"...","dish":"one thing to order","why":"1 sentence"}'
  },
  seedo: {
    field: 'sightseeing', cachePrefix: 'sd',
    item: '{"name":"...","rank":"must|solid|skip","why":"1 sentence"}'
  }
};

export async function runMore(kind, p, existingNames) {
  const spec = MORE_SPECS[kind];
  const prompt = `You are a travel researcher for ${placeLine(p)}.
Already recommended (do NOT repeat any of these): ${existingNames.join('; ')}.
Suggest 6-8 MORE genuinely different options across tiers. Real places you are confident exist. Respond ONLY with JSON:
{"items":[${spec.item}]}
${spec.item.includes('tier') ? TIERS + '. ' : ''}${RANKS}.`;
  const data = await ask(prompt);
  const items = (data.items || []).filter(it => it && it.name);
  const cacheKey = `${spec.cachePrefix}:${p.placeId}`;
  const cached = cacheGet('llm', cacheKey);
  if (cached && items.length) {
    cached[spec.field] = [...(cached[spec.field] || []), ...items];
    cacheSet('llm', cacheKey, cached);
  }
  return items;
}

export const runOverview = (p, w, t) => cachedAsk(`ov:${p.placeId}:${t.start || ''}:${t.days || ''}`, overviewPrompt(p, w, t));
export const runStay = (p, s) => cachedAsk(`st:${p.placeId}`, stayPrompt(p, s));
export const runEat = (p, s) => cachedAsk(`ea:${p.placeId}`, eatPrompt(p, s));
export const runSeeDo = (p, s) => cachedAsk(`sd:${p.placeId}`, seeDoPrompt(p, s));
export const runSeasonal = (p, w) => cachedAsk(`ev:${p.placeId}`, eventsPrompt(p, w));
export const runFlights = (p, home) => cachedAsk(`fl:${p.placeId}:${home || ''}`, flightsPrompt(p, home));
