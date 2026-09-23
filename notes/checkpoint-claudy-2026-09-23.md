# Checkpoint — Claudy · 2026-09-23 (respondent-data incident + display fixes + polish round)

Session 09:20–10:25 WIB. Everything below verified live. Previous checkpoint: 2026-09-21.

## The incident (Araya: "people filled but not showing / respondents button dead")
**Data was never lost.** All 4 real submissions were on disk the whole time — verified three
independent ways (app UI, API, raw sqlite on the box). What broke was ADMIN DISPLAY, via two
stacked bugs from the shared-forms feature:

1. **Autosave ownership steal**: `persistFormToBackend` sent `owner_id` on every UPDATE —
   bud's (shared editor) autosave silently rewrote the MEE form's owner to bud. Araya's home
   → zero forms, nothing clickable. **Fix**: owner_id only on CREATE (data repaired server-side
   back to Araya).
2. **Relation-join filter drop**: PocketBase discards relation joins the requester can't read —
   users can't read other users, so `shared_with.id ?=` filters return empty for the form owner
   (worked for bud, who can read his own record). **Fix**: denormalized `shared_ids` JSON field
   for filtering (`shared_ids ~ "uid"`), relation stays for API rules. Fallback to owner-only
   filter on error.

Third display bug found while reproducing: `openResponsesPage` never hid Home — respondents
view stacked below the landing (Araya's "as if clicked, below editor" report). Fixed + Back now
returns to where you opened from.

## Forensic patterns that paid off
- DB-first: counted responses in sqlite directly before touching any code — "data lost" became
  "display broken" in one query.
- Backup inventory (nightly 02:17 WIB zips) answered "which fills existed when" conclusively.
- Playwright request/response tracing caught the autocancel: PocketBase SDK kills duplicate
  in-flight queries (`requestKey: null` fixes the respondents-count button).
- The question set had been deliberately revised 17→10 during bud's session (reworded, "Nama:"
  added) — NOT corruption. Responses link fine to the current set. Original 17 seed still in
  /tmp/mee-form-seed.json if ever needed.

## Shipped after the incident (all pushed through 0d468a7)
- **Viewer**: open-text answers require 2+ words (system standard; "yes"/"-" blocked with a
  live "Minimum 2 words" hint, "yes it is" passes)
- **Respondents**: chronological numbering (#1 = first to fill) + Today/Yesterday/date group
  headers (only non-empty groups render); pie chart removed (unclear meaning), Completion Time
  stays; checkbox answers render as square chip grids instead of text walls
- **Settings panel**: compact wrapping action buttons (Preview · Share · count button) —
  nothing bleeds off the 330px panel
- **Data**: test respondents trimmed; Araya's named sample entry created via API (2jb54y1y —
  #1 under Today, "Araya Suryanto"); his own original test fill was NOT recoverable (fell in
  the cleanup window, after the last backup) — replaced by the sample per his choice

## Live state
- Form: MEE Shalahuddin, slug `ax75t97`, 10 questions (revised set), 1 respondent (Araya sample)
- Accounts: arayassuryanto (owner) + bud.suryanto (shared, co-editor) — both logins verified
- Backups: nightly 02:17 WIB, keep-14 — restore path proven this session (used for forensics)

## Open items
- The 2-word rule doesn't apply retroactively; server-side it's client-enforced only (fine for now)
- form_images not shared-aware; saveCurrentForm() dead code; `shared_ids` must be kept in sync
  with `shared_with` when sharing changes (no share-management UI yet — sharing is API-only)
- Netlify mirror still alive via push; long-term disposition undecided
- If respondents count ever shows "…" → slow network, it resolves; if "—" → check console.warn
