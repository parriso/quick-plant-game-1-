// Vercel serverless function. Keeps your Anthropic API key on the server, never in the browser.
// Set ANTHROPIC_API_KEY in your Vercel project settings (Settings > Environment Variables).

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });

  const { prompt, image } = req.body || {};
  if (typeof prompt !== 'string' || !prompt || prompt.length > 4000)
    return res.status(400).json({ error: 'Bad prompt' });
  if (image && (typeof image !== 'string' || image.length > 4000000))
    return res.status(400).json({ error: 'Bad image' });

  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  content.push({ type: 'text', text: prompt });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content }]
      })
    });
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: 'Upstream error' });
    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: 'Request failed' });
  }
};
