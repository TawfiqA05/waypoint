// GET /api/events?lat=..&lon=..&start=YYYY-MM-DD&end=YYYY-MM-DD
// Proxies Ticketmaster Discovery API (free key) so the key stays server-side.

export default async function handler(req, res) {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return res.status(200).json({ events: [], unavailable: true });

  const { lat, lon, start, end } = req.query || {};
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  const params = new URLSearchParams({
    apikey: key,
    latlong: `${lat},${lon}`,
    radius: '60',
    unit: 'miles',
    size: '30',
    sort: 'date,asc'
  });
  if (start) params.set('startDateTime', `${start}T00:00:00Z`);
  if (end) params.set('endDateTime', `${end}T23:59:59Z`);

  try {
    const r = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    const data = await r.json();
    const events = (data?._embedded?.events || []).map(e => ({
      name: e.name,
      url: e.url,
      date: e.dates?.start?.localDate || '',
      time: e.dates?.start?.localTime || '',
      venue: e._embedded?.venues?.[0]?.name || '',
      genre: e.classifications?.[0]?.segment?.name || ''
    }));
    return res.status(200).json({ events });
  } catch (e) {
    return res.status(200).json({ events: [], unavailable: true });
  }
}
