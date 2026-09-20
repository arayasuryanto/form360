// Formure — AI form generator service.
// Same GLM lane as the intelligence project: Z.ai Anthropic-compatible endpoint,
// key read from ~/.glm-coding-key (path overridable via GLM_KEY_PATH).
// One endpoint: POST /ai/generate  { brief }  ->  Formure form JSON.
// Auth: caller must present a valid Formure PocketBase user token (Authorization: Bearer <pb token>).
//
// Run:  PORT=8123 PB_URL=http://127.0.0.1:8090 node ai-server.mjs   (behind nginx at /ai/)

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.PORT || 8123);
const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const KEY_PATH = process.env.GLM_KEY_PATH || join(homedir(), '.glm-coding-key');
const MODEL = process.env.GLM_MODEL || 'glm-5.2';
const ZAI_BASE = 'https://api.z.ai/api/anthropic';
const MAX_BRIEF = 20000;

const GLM_KEY = readFileSync(KEY_PATH, 'utf8').trim();

const SYSTEM_PROMPT = `You build forms for Formure, a Typeform-style one-question-at-a-time form builder.

Given a brief (any language, any shape — docx dumps, bullet lists, a ChatGPT conversation, rough notes), produce a complete Formure form as STRICT JSON. Respond with JSON only, no markdown fences, no commentary.

JSON shape:
{
  "name": string,                    // short form name
  "description": string,             // one line
  "welcome": { "title": string, "subtitle": string },
  "results": { "title": string, "subtitle": string, "buttonText": string },
  "questions": [
    { "type": "multiple_choice", "title": string, "options": [{ "text": string }, ...] },
    { "type": "checkbox",          "title": string, "options": [{ "text": string }, ...] },
    { "type": "text_input",        "title": string, "placeholder": string },
    { "type": "section",           "title": string, "subtitle": string, "buttonText": string }
  ]
}

Rules:
- Use "section" items to group questions into parts (like "A. ...", "B. ...") when the brief has sections; the section title carries the original heading.
- multiple_choice: 2-8 options. checkbox: 2-12 options (use it for "which of these did you try?" style questions). Long rating matrices per item: DO NOT explode into one question per row — adapt: a checkbox for membership, a multiple_choice for the standout rows, a text_input for per-item notes.
- text_input for open answers; put an example in "placeholder".
- Match the brief's language exactly (Bahasa brief -> Bahasa form; keep the brief's own wording for options wherever possible).
- Keep the brief's wording of questions/options faithful — do not paraphrase away specifics.
- 3-20 questions total. buttonText for sections defaults to "Lanjut" in Bahasa forms, "Continue" in English.`;

function send(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(body);
}

async function verifyToken(authHeader) {
    if (!authHeader) return null;
    // PocketBase clients send the token raw; some clients use "Bearer <token>". Accept both.
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    try {
        const r = await fetch(`${PB_URL}/api/collections/users/auth-refresh`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) return null;
        const d = await r.json();
        return (d.record && d.record.id) || null;
    } catch (e) {
        return null;
    }
}

async function generateForm(brief) {
    const r = await fetch(`${ZAI_BASE}/v1/messages`, {
        method: 'POST',
        headers: {
            'x-api-key': GLM_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 4000,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: `Brief:\n\n${brief}` }]
        })
    });
    if (!r.ok) throw new Error(`GLM ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Model returned no JSON');
    return JSON.parse(cleaned.slice(start, end + 1));
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });

    if (req.method === 'POST' && req.url === '/ai/generate') {
        const user = await verifyToken(req.headers.authorization);
        if (!user) return send(res, 401, { error: 'Not authenticated' });

        let body = '';
        for await (const chunk of req) body += chunk;
        let brief;
        try { brief = JSON.parse(body).brief; } catch (e) { return send(res, 400, { error: 'Bad JSON' }); }
        if (typeof brief !== 'string' || brief.trim().length < 3) return send(res, 400, { error: 'Brief too short' });
        if (brief.length > MAX_BRIEF) return send(res, 413, { error: 'Brief too long' });

        try {
            const form = await generateForm(brief);
            return send(res, 200, form);
        } catch (e) {
            console.error('[ai]', e.message);
            return send(res, 502, { error: 'Generation failed' });
        }
    }

    send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => console.log(`formure-ai listening on 127.0.0.1:${PORT}`));
