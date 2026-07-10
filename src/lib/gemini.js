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

// Mark items "verified" when the name matches something that exists on OpenStreetMap.
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
 "bestTime":
