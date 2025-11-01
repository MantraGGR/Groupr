import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.GENERATIVE_API_KEY;

// Load allowlist from file if present, else from env
function loadAllowlist() {
  const p = path.resolve('./allowlist.json');
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read allowlist.json', e);
  }
  const env = process.env.ALLOWLIST || '';
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

const allowlist = new Set(loadAllowlist());

app.get('/', (req, res) => res.send({ ok: true }));

// /authorize : verify Google OAuth access token and return whether user's email is allowed
app.post('/authorize', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'missing accessToken' });

  try {
    const g = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!g.ok) return res.status(401).json({ authorized: false, error: 'invalid token' });
    const info = await g.json();
    const email = info.email;
    const authorized = allowlist.has(email);
    return res.json({ authorized, email });
  } catch (err) {
    console.error('authorize error', err);
    return res.status(500).json({ authorized: false, error: 'server error' });
  }
});

// /generate : accept prompt from extension, verify the user via access token, then call Gemini
app.post('/generate', async (req, res) => {
  const { prompt } = req.body;
  const auth = req.headers.authorization || '';
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!accessToken) return res.status(400).json({ error: 'missing Authorization Bearer token' });
  if (!prompt) return res.status(400).json({ error: 'missing prompt' });

  try {
    const g = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!g.ok) return res.status(401).json({ authorized: false, error: 'invalid token' });
    const info = await g.json();
    const email = info.email;
    if (!allowlist.has(email)) return res.status(403).json({ authorized: false, error: 'not allowed' });

    // Call Generative API using server-side API key
    if (!API_KEY) return res.status(500).json({ error: 'server not configured with GENERATIVE_API_KEY' });

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent`;
    const body = { prompt: { text: prompt } };

    // Some Google APIs accept API key in query string; here we pass as Bearer for demo.
    const gResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await gResp.text();
    // Forward raw response body and status
    res.status(gResp.status).set('Content-Type', gResp.headers.get('content-type') || 'application/json').send(data);
  } catch (err) {
    console.error('generate error', err);
    res.status(500).json({ error: 'server error' });
  }
});

app.listen(PORT, () => console.log(`Groupr backend listening on http://localhost:${PORT}`));
