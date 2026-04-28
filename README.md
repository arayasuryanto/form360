# Formure

A minimalist, Typeform-inspired questionnaire builder with a focused respondent experience.

- **Editor** (`index.html`) — sign-in gated form builder.
- **Viewer** (`viewer.html`) — public, single-question-at-a-time respondent UI.
- **Backend** — Supabase (Postgres + Auth + Storage).
- **Hosting** — Netlify (static).

## Concept

A clean, focused form experience that guides users through questions one at a time:

- **Single-task focus** — one question visible at a time, centered on screen.
- **Minimal distractions** — neutral broken-white background, no clutter.
- **Smooth transitions** — animated question transitions and option reveals.
- **Keyboard-friendly** — full keyboard navigation (A/B/…, Enter, ↑/↓, Shift+Enter).

## Question types

- `multiple_choice` — single select, A–H letter shortcuts.
- `checkbox` — multi-select, A–H letter shortcuts.
- `text_input` — free-form textarea.
- `section` — divider screen with title, subtitle, and continue button.

Per question you can also set a color tint, an image (uploaded to Supabase Storage), and a placeholder.

## Files

```
sistempakar/
├── index.html         # Editor (auth-gated)
├── viewer.html        # Respondent form
├── editor.js          # Editor logic
├── script.js          # Viewer logic
├── styles.css         # Shared styles
├── editor-styles.css  # Editor + auth gate styles
├── config.js          # Runtime config (Supabase URL/key)
├── supabase-schema.sql # Tables, RLS, functions
├── netlify.toml       # Hosting + CSP headers
├── xlsx.full.min.js   # SheetJS (lazy-loaded for Excel export)
├── formure-logo.png
└── favicon.png
```

## Setup

### 1. Create the Supabase project

Apply `supabase-schema.sql` in the Supabase SQL editor. It creates:

- Tables: `forms`, `questions`, `responses`, `answers`.
- RLS policies that scope reads/writes to the authenticated owner.
- A `submit_response` RPC for atomically saving a response + answers.
- A `form-images` Storage bucket should be created and made public for question images.

### 2. Configure keys

Edit `config.js`:

```js
window.FORMURE_CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_KEY: 'your-anon-key'
};
```

The anon key is safe to ship — Supabase RLS policies enforce ownership.

### 3. Enable email auth

In Supabase Auth settings, enable email/password sign-up. Existing users sign in with email + password from the editor's auth gate.

### 4. Deploy

Drag `sistempakar/` to Netlify or `netlify deploy --prod --dir sistempakar`.

## Sharing forms

The editor's **Share** button validates the form, persists it to Supabase, and produces a link of the form `viewer.html?form=<uuid>`. The shorthand redirects `/f/<uuid>` and `/s/<uuid>` are configured in `netlify.toml`.

## Security model

- **Auth** — Supabase email/password. Editor is gated; viewer is public.
- **Ownership** — `forms.owner_id` references `auth.users`. RLS lets only the owner read/write the form, its questions, and its responses.
- **Public submissions** — anyone (no auth) can submit a response to a published form, but only the owner can read responses back.
- **XSS** — all user-authored content is rendered via `textContent` / DOM APIs in both editor and viewer. CSP headers in `netlify.toml` are defense-in-depth.
- **Respondent data on form delete** — `responses.form_id` uses `ON DELETE SET NULL` and snapshots the form name, so deleting a form does not destroy historical respondent data.

## Keyboard shortcuts (viewer)

| Key | Action |
|-----|--------|
| A–H | Select / toggle option |
| Enter | Continue |
| Shift+Enter | New line in text input |
| ↑ / ↓ | Previous / next question |

## Excel export

The editor's per-form export button generates a workbook with three sheets: Summary, Respondents, Distribution. SheetJS is lazy-loaded only when the button is clicked.
