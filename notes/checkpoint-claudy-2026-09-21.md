# Checkpoint — Claudy · 2026-09-21 (formure: Supabase → own dockbay infra + full admin rework)

Session spanned 2026-09-20 18:30 → 2026-09-21 14:00 WIB. Everything below is LIVE and verified.

## What happened (arc)
1. **Backend died**: Supabase free-tier project deleted itself (NXDOMAIN globally) — the "live" formure.netlify.app was a dead shell.
2. **All-in on own infra**: PocketBase v0.40.4 on kg-vps (Lord-Shipwright), static frontend on the same box.
   - App: `https://formure.dockbay.xyz` · API: `https://formureapi.dockbay.xyz` (PB) · AI: `…/ai/generate` (GLM via Z.ai, same lane as intelligence, key at `/home/rays-dockbay/.secrets/glm-coding-key`)
   - Old `formure.netlify.app` mirrors via GitHub push (working, points at our PB).
3. **Client ported**: supabase-js → PocketBase SDK (editor.js + script.js), field names kept identical to the old Postgres schema so the diff stayed surgical. Supabase is 100% detached.
4. **Admin interface rebuilt through ~5 review rounds**: 3-column layout → home dashboard + outline sidebar + right settings panel → ✨ AI wizard → autosave (no Save button) → shared forms.
5. **MEE Shalahuddin questioner** seeded from `~/Downloads/MEE SHALAHUDDIN QUESTIONER.docx` (17 questions, the 11-menu matrix adapted to checkbox+MC+text).

## Live state
- **Accounts**: arayassuryanto@gmail.com / `Formure-Shalahuddin-26!` (owner) · bud.suryanto@gmail.com / `Formure-Shalahuddin-26!` (shared on MEE). PB superuser creds: `/root/formure-pocketbase-creds.txt` on kg-vps (view: `! ssh kg-vps "cat /root/formure-pocketbase-creds.txt"`).
- **MEE form**: slug `ax75t97` → `formure.dockbay.xyz/f/ax75t97` (short slugs, 7-char; legacy 15-char ids still resolve). 0 respondents (test data cleaned on request).
- **Schema**: users, forms (+slug, +shared_with multi-relation), questions, responses, answers, form_images. Rules mirror old RLS + shared-user co-editor rights (delete owner-only).
- **Ops**: PB systemd unit + daily 02:17 WIB backup (keep-14, zip w/ sqlite3 .backup). nginx: rebuild-safe includes for rewrites (/f/, /s/), CSP, open_file_cache off (formure vhost), no-cache client headers. All tenant-checksum-verified untouched.
- **Git**: everything committed + pushed to origin/main through `de1e761` (push = Netlify mirror).

## Feature inventory
- Editor: home dashboard (cards + New Form: blank / ✨ Generate), outline sidebar (click-scroll nav), question canvas, right settings panel, **autosave** (900ms debounce via cacheForms hook, Saving/✓Saved/⚠ topbar indicator, flush on back-home + pagehide), preview, share (short link), respondents FULL PAGE (stats, master-detail, Excel export), image uploads (form_images), ✨ AI wizard (copy prompt → user chats in ChatGPT/Gemini → paste result → GLM structures it).
- Viewer: one-question-at-a-time, adaptive option layouts (grid 2-col short labels / single-col compact long labels / page-scroll fallback — never hidden inner scroll), A–Z option keys, Back/Next bar, atomic batch answer saving, honest error screens (Connection problem + Try again ≠ Form Not Found), auto-retry fetches.

## Decision log (the WHY)
- **PocketBase over new Supabase**: Supabase free tier died from idleness — formure is an on/off product, exactly the profile that pauses again. Owning the box is the whole point of the move. Araya picked "all in for database also".
- **Field names unchanged from Postgres** (owner_id, form_id, …): let the client port stay mechanical instead of a rewrite.
- **`created_at` autodate fields named to match old timestamps**: killed ~8 client diffs for free.
- **v0.40 PB quirks learned**: `auth-with-password` wants `identity` (not email); `auth-refresh` is POST-only; tokens accepted raw or Bearer (ai-server handles both); batch import endpoint gone → per-collection POST; users collection must be PATCHed round-tripping system fields.
- **Layout chosen by label length + viewport, not just option count**: the MEE menu labels are ~45 chars; 2-col grid bled text out of boxes on phones (fixed 32px option key starved the column → key shrunk to 24px + 2-line clamp). ≤4 options also compact on mobile — 4 stacked cards overflowed into hidden scroll.
- **Page-scroll as the last resort** (not inner scroll box): Araya's rule = "respondent must not be unaware of options below". A visible page continuation with fixed Back/Next bar satisfies it; 12 long-label options physically cannot fit a 390px screen at readable size.
- **Viewer errors split by cause**: a flaky home-network path made "Form Not Found" appear on perfectly valid links (Araya hit this; Shipwright hit the same flakiness 4× from the Mac). Network ≠ notfound now, with Try-again. Failed submits NEVER show Thank You — answers held in memory with retry (data-integrity ask from Araya).
- **10-year cache headers** from Hestia's `expires max` served stale supabase-era editor.js to Araya's browser → the "is it still supabase??" scare. Fixed: `proxy_hide_header` + `no-cache` include (rebuild-safe `_nocache` file). Browsers revalidate now.
- **Autosave hooked at cacheForms()**: every mutation path already flowed through it — one interception point, no per-input wiring. 900ms debounce; skip-unchanged question PATCHes make re-saves 2 API calls.
- **AI = prompt-out + result-in wizard** (not "paste your brief"): Araya's framing — users already have ChatGPT/Gemini habits; we hand them a copyable designer prompt, they iterate in THEIR AI, paste the final back, our GLM structures it. The copyable prompt also encodes our layout rules (no matrix explosion, type constraints, language match).
- **Shared forms as a real feature** (shared_with relation + rules across 4 collections), not a one-off data hack — matches his self-serve-admin instinct. Bud gets same form/questions/respondents; delete + ownership stay with Araya.
- **Secrets discipline**: PB superuser token never left the box (auth+curl inside one ssh python heredoc); PB admin password lives in /root on the box; Telegram bot token sourced from `~/playground/mastercontrol/.telegram`.

## Known open items
- Araya never pushed back on: netlify.app long-term (mirror vs redirect vs die).
- form_images not shared-aware (owner-only upload) — fine for now.
- `saveCurrentForm()` now dead code (autosave replaced it) — harmless, cleanup later.
- Mobile topbar hides the user email (nav-user) — acceptable.
- If home-network flakiness recurs: it's the route, not the app (site-down-triage pattern; Shipwright confirmed no server rate-limiting).

## Session patterns worth remembering
- Shipwright (3 rounds + 1 quick fix) owned ALL box/infra changes; I never SSH-mutated nginx directly except the two additive `_nocache`-style include files after his pattern was established. Tenant-checksum proof every round.
- Browser verification (Playwright on real Chrome, 390px + 1440px) caught every bug my API tests missed: relative-path /f/ assets, slug→questions filter, screen.append loss, topNav overlap, grid bleed, backdrop-click position, settings button off-viewport.
- Araya tests on his real phone within minutes of every deploy — his "it bleeds / can't check" reports were always real-device truth.
- Watch nginx open_file_cache after deploys (was fixed vhost-level, but any new vhost needs the same include).
