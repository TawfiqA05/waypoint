// All saved data carries a user_id from day one so a real multi-user backend
// (e.g. Supabase) can be swapped in later without reshaping the data.

const USER_KEY = 'wp_user_id';
const HISTORY_KEY = 'wp_history';
const TRIPS_KEY = 'wp_trips';
const SETTINGS_KEY = 'wp_settings';
const CACHE_PREFIX = 'wp_cache:';

export function userId() {
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = 'u_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- Settings (home airport, etc.) ----------
export const getSettings = () => read(SETTINGS_KEY, { user_id: userId(), homeAirport: '' });
export const saveSettings = (s) => write(SETTINGS_KEY, { ...getSettings(), ...s, user_id: userId() });

// ---------- Search history ----------
export function getHistory() {
  return read(HISTORY_KEY, []).filter(h => h.user_id === userId());
}
export function addHistory(entry) {
  const all = read(HISTORY_KEY, []);
  const filtered = all.filter(h => !(h.user_id === userId() && h.placeId === entry.placeId));
  filtered.unshift({ ...entry, user_id: userId(), searchedAt: new Date().toISOString() });
  write(HISTORY_KEY, filtered.slice(0, 200));
}
export function removeHistory(placeId) {
  write(HISTORY_KEY, read(HISTORY_KEY, []).filter(h => !(h.user_id === userId() && h.placeId === placeId)));
}

// ---------- Trips (itinerary + notes per destination) ----------
export function getTrip(placeId) {
  const trips = read(TRIPS_KEY, {});
  return trips[`${userId()}:${placeId}`] || { user_id: userId(), placeId, days: [[]], notes: '' };
}
export function saveTrip(placeId, trip) {
  const trips = read(TRIPS_KEY, {});
  trips[`${userId()}:${placeId}`] = { ...trip, user_id: userId(), placeId };
  write(TRIPS_KEY, trips);
}

// ---------- API/LLM response cache (protects free-tier quotas) ----------
const DAY = 24 * 60 * 60 * 1000;
const TTL = {
  geocode: 90 * DAY, country: 30 * DAY, currency: 1 * DAY, weather: 6 * 60 * 60 * 1000,
  places: 14 * DAY, llm: 14 * DAY, events: 1 * DAY, photo: 90 * DAY
};

export function cacheGet(kind, key) {
  const raw = localStorage.getItem(CACHE_PREFIX + kind + ':' + key);
  if (!raw) return null;
  try {
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > (TTL[kind] || DAY)) return null;
    return v;
  } catch { return null; }
}

export function cacheSet(kind, key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + kind + ':' + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // Storage full: drop oldest cache entries and retry once.
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.slice(0, Math.ceil(keys.length / 2)).forEach(k => localStorage.removeItem(k));
    try { localStorage.setItem(CACHE_PREFIX + kind + ':' + key, JSON.stringify({ t: Date.now(), v: value })); } catch {}
  }
}
