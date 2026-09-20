# formure — Typeform-style questionnaire builder

Product name: **Formure** (repo/GitHub legacy name: `form360`, old internal name: `sistempakar`).
Lives in starlabs = product workspace. **Backend moved from Supabase (project died / free-tier
deletion) to our own PocketBase on the dockbay VPS on 2026-09-20 — Supabase is fully detached.**

## Stack
- **Vanilla JS/HTML/CSS — no build step.** Static files served by nginx (Hestia) as-is.
- **Backend: PocketBase on kg-vps** (our Hestia box), public at `https://formureapi.dockbay.xyz`
  (admin UI at `/_/`; superuser creds in `/root/formure-pocketbase-creds.txt` on the box).
  - Client config in `config.js` (`API_URL`).
  - Collections: users, forms, questions, responses, answers, form_images — API rules mirror the
    old RLS (public read published forms, owner-only writes/reads of responses). Field names kept
    identical to the old Postgres schema (`owner_id`, `form_id`, …) so the client code stayed lean.
  - `supabase/migrations/*.sql` is now LEGACY REFERENCE only (the RLS source it was ported from).
- **Frontend hosting: `https://formure.dockbay.xyz`** (Hestia web-domain under `rays-dockbay`,
  LE cert, `/f/*` and `/s/*` share rewrites → `viewer.html?form=:splat`, CSP in the
  `nginx.ssl.conf_static` include). Old `formure.netlify.app` is deprecated.
- **AI form generation:** ✨ Generate button in the editor → `POST /ai/generate` on
  formureapi.dockbay.xyz → GLM (Z.ai Anthropic-compatible lane, same as intelligence project).
  Server: `server/ai-server.mjs` (systemd `formure-ai`), auth-gated by Formure user token.
- **SheetJS** (`xlsx.full.min.js`, vendored) for spreadsheet handling.

## Surfaces
- `index.html` + `editor.js` — sign-in gated form builder (editor + ✨ AI generate).
- `viewer.html` + `script.js` — public respondent UI: one question at a time, keyboard-friendly
  (A–H shortcuts, Enter, ↑/↓).
- `vibe.html` / `vibe.js` — "Vibe Check" generative form prototype (standalone experiment).
- Question types: multiple_choice, checkbox, text_input, section.

## Notes
- README.md sections about Supabase are outdated — this file is the source of truth for backend.
- Security posture carried over: CSP headers on both domains, XSS-safe rendering
  (textContent/DOM APIs) in editor and viewer, PB rules instead of RLS. Preserve all three.
- Share links use PocketBase 15-char record ids (`/f/<id>`).
