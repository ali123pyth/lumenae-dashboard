// ── Lumenae Dashboard — AI Analyst backend ──────────────────────────────────
// Serves the static dashboard and proxies /api/chat to the Anthropic API,
// keeping the API key server-side only.
//
// Deploy on Railway:
//   1. Add this file + package.json to your dashboard repo (same folder as
//      lumenae_dashboard_v4.html).
//   2. In Railway → your service → Variables, add:
//        ANTHROPIC_API_KEY = sk-ant-...   (get one from console.anthropic.com)
//   3. Railway will detect Node and run `npm start` automatically.

const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

// Serve the dashboard and any static assets from this folder
app.use(express.static(__dirname));

// Default route → the dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'lumenae_dashboard_v4.html'));
});

// ── Chat proxy ───────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'Server is missing ANTHROPIC_API_KEY. Set it in Railway → Variables.'
    });
  }

  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] is required' });
  }

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: system || undefined,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errText);
      return res.status(apiRes.status).json({ error: 'Anthropic API error: ' + errText });
    }

    const data = await apiRes.json();
    const reply = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    res.json({ reply });
  } catch (err) {
    console.error('Chat proxy failed:', err);
    res.status(500).json({ error: 'Chat proxy failed: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Lumenae dashboard + AI Analyst backend running on port ${PORT}`);
});
