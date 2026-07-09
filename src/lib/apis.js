import { cacheGet, cacheSet } from './storage.js';

async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url, location.href).hostname}`);
  return r.json();
}

// ---------- Geocoding: OpenStreetMap Nominatim (free, no key) ----------
export async function geocode(query) {
  const key = query.trim().toLowerCase();
  const hit = cacheGet('geocode', key);
  if (hit) return hit;
  const data = await getJSON(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`
  );
  if (!data.length) return null;
  const d = data[0];
  const a = d.address || {};
  const place = {
    placeId: `${d.osm_type}-${d.osm_id}`,
    name: d.name || query,
    displayName: d.display_name,
    lat: +d.lat, lon: +d.lon,
    city: a.city || a.town || a.village || d.name || '',
    state: a.state || '',
    country: a.country || '',
    countryCode: (a.country_code || '').toUpperCase(),
    kind: d.addresstype || d.type
  };
  cacheSet('geocode', key, place);
  return place;
}

// ---------- Weather: Open-Meteo (free, no key) ----------
export async function weather(place) {
  const key = place.placeId;
  const hit = cacheGet('weather', key);
  if (hit) return hit;
  const now = await getJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    `&current=temperature_2m,precipitation,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=auto`
  );
  // Monthly climate normals from the historical archive (last full 3 years).
  const y = new Date().getFullYear();
  const hist = await getJSON(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${place.lat}&longitude=${place.lon}` +
    `&start_date=${y - 3}-01-01&end_date=${y - 1}-12-31&daily=temperature_2m_max,precipitation_sum&timezone=auto`
  ).catch(() => null);

  let monthly = null;
  if (hist?.daily?.time) {
    const sums = Array.from({ length: 12 }, () => ({ t: 0, p: 0, n: 0 }));
    hist.daily.time.forEach((d, i) => {
      const m = +d.slice(5, 7) - 1;
      sums[m].t += hist.daily.temperature_2m_max[i] ?? 0;
      sums[m].p += hist.daily.precipitation_sum[i] ?? 0;
      sums[m].n++;
    });
    monthly = sums.map((s, i) => ({
      month: i,
      highC: s.n ? +(s.t / s.n).toFixed(1) : null,
      rainMm: s.n ? +(s.p / (s.n / 30)).toFixed(0) : null
    }));
  }
  const out = { current: now.current, daily: now.daily, monthly, units: now.current_units };
  cacheSet('weather', key, out);
  return out;
}

// ---------- Country basics: REST Countries (free, no key) ----------
export async function countryInfo(countryCode) {
  if (!countryCode) return null;
  const hit = cacheGet('country', countryCode);
  if (hit) return hit;
  const data = await getJSON(`https://restcountries.com/v3.1/alpha/${countryCode}?fields=name,currencies,languages,capital,region,timezones,idd,car`);
  const cur = data.currencies ? Object.entries(data.currencies)[0] : null;
  const out = {
    name: data.name?.common,
    capital: data.capital?.[0],
    region: data.region,
    languages: Object.values(data.languages || {}),
    currencyCode: cur?.[0] || null,
    currencyName: cur?.[1]?.name || null,
    currencySymbol: cur?.[1]?.symbol || null,
    drivingSide: data.car?.side,
    callingCode: (data.idd?.root || '') + (data.idd?.suffixes?.[0] || '')
  };
  cacheSet('country', countryCode, out);
  return out;
}

// ---------- Currency: Frankfurter (free, no key) ----------
export async function exchangeRate(toCurrency, base = 'USD') {
  if (!toCurrency || toCurrency === base) return { rate: 1, base, to: toCurrency || base };
  const key = `${base}-${toCurrency}`;
  const hit = cacheGet('currency', key);
  if (hit) return hit;
  try {
    const data = await getJSON(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${toCurrency}`);
    const out = { rate: data.rates?.[toCurrency] ?? null, base, to: toCurrency };
    cacheSet('currency', key, out);
    return out;
  } catch { return { rate: null, base, to: toCurrency }; }
}

// ---------- Places base layer: Overpass / OpenStreetMap (free) ----------
// Used to verify that AI-suggested places actually exist, and as raw material.
export async function osmPlaces(place) {
  const key = place.placeId;
  const hit = cacheGet('places', key);
  if (hit) return hit;
  const r = 6000; // metres
  const q = `[out:json][timeout:25];(
    node(around:${r},${place.lat},${place.lon})[tourism~"hotel|attraction|museum|viewpoint"];
    node(around:${r},${place.lat},${place.lon})[amenity~"restaurant|cafe"][name];
    way(around:${r},${place.lat},${place.lon})[tourism~"hotel|attraction|museum"];
  );out tags center 400;`;
  try {
    const data = await getJSON('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: 'data=' + encodeURIComponent(q),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const names = new Set();
    const items = [];
    for (const el of data.elements || []) {
      const t = el.tags || {};
      if (!t.name || names.has(t.name.toLowerCase())) continue;
      names.add(t.name.toLowerCase());
      items.push({
        name: t.name,
        category: t.tourism || t.amenity || 'place',
        cuisine: t.cuisine || null,
        website: t.website || null
      });
    }
    cacheSet('places', key, items);
    return items;
  } catch { return []; }
}

// ---------- Serverless proxies ----------
export async function events(place, start, end) {
  const key = `${place.placeId}:${start || ''}:${end || ''}`;
  const hit = cacheGet('events', key);
  if (hit) return hit;
  const params = new URLSearchParams({ lat: place.lat, lon: place.lon });
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const data = await getJSON(`/api/events?${params}`).catch(() => ({ events: [], unavailable: true }));
  cacheSet('events', key, data);
  return data;
}

export async function photo(place) {
  const hit = cacheGet('photo', place.placeId);
  if (hit) return hit;
  const data = await getJSON(`/api/photos?q=${encodeURIComponent(place.name + ' ' + place.country)}`).catch(() => ({ photo: null }));
  cacheSet('photo', place.placeId, data);
  return data;
}
