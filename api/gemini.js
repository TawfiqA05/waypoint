// POST /api/gemini  { prompt: string, json?: boolean }
// Proxies Google Gemini so the API key never reaches the browser.
// Free tier: keep requests modest; the client caches aggressively.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const { prompt, json } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.length > 20000) {
    return res.status(400).json({ error: 'Provide a prompt (string, <20k chars).' });
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096,
            ...(json ? { responseMimeType: 'application/json' } : {})
          }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || 'Gemini request failed.' });
    }
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach Gemini: ' + e.message });
  }
}
