// POST /api/gemini  { prompt: string, json?: boolean }
// Despite the filename (kept for compatibility with the rest of the app),
// this now calls Groq's free API. Groq requires no billing/credit card.
// Get a free key at https://console.groq.com -> API Keys.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'GROQ_API_KEY is not set on the server.' });

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const { prompt, json } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.length > 20000) {
    return res.status(400).json({ error: 'Provide a prompt (string, <20k chars).' });
  }

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 4096,
        ...(json ? { response_format: { type: 'json_object' } } : {})
      })
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || 'Groq request failed.' });
    }
    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach Groq: ' + e.message });
  }
}
