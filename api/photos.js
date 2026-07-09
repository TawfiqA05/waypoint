// GET /api/photos?q=Kyoto — returns one destination photo. Optional feature:
// if UNSPLASH_ACCESS_KEY is not set, the UI simply renders without a photo.

export default async function handler(req, res) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  const q = (req.query?.q || '').slice(0, 80);
  if (!key || !q) return res.status(200).json({ photo: null });

  try {
    const r = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q + ' travel')}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    const data = await r.json();
    const p = data?.results?.[0];
    return res.status(200).json({
      photo: p
        ? { url: p.urls?.regular, credit: p.user?.name, link: p.links?.html }
        : null
    });
  } catch {
    return res.status(200).json({ photo: null });
  }
}
