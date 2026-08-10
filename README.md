# Lucid Notes

Think out loud, get it back sharp. Speak or type a rough thought and it comes
back as a clean note — title, thesis, bullet points, and next actions — grouped
into smart folders with the tasks pulled out for you.

**How it works:** the browser records your voice → **Gemini Flash** transcribes
it → **Claude** structures it, develops it, and files it under the business or
idea it's about. Typing skips the first two steps.

## What it does

- **Talk, don't type.** One tap on the mic starts recording; stop and the
  thought is transcribed, sharpened, and saved.
- **It thinks with you.** Every note comes back split into what *you* said
  (thesis + points, never embellished) and what Lucid adds — questions worth
  answering, angles you didn't mention, and risks you may be carrying. Tap
  **Go deeper** for a conversation about the note that already has the context.
- **Organized by business.** Notes route themselves to the venture they're
  about — a company you're running or an idea you're exploring. Businesses can
  be renamed, reordered by dragging, and notes can be sorted by business.
- **"Where it stands."** Open a business and Lucid reads everything you've
  captured about it and tells you what's moving, what's stuck, and what deserves
  attention next.
- **Tasks pulled out.** Next steps are extracted from your notes and grouped by
  business in the Tasks tab.

## Why there's a backend

The app is a single-page mobile UI (`public/index.html`). API keys can't live
in client-side code (they'd be visible to everyone), so a small backend holds
them and exposes two endpoints the app calls: `POST /api/transcribe` (Gemini
speech-to-text) and `POST /api/refine` (Claude note structuring). Locally
that's `server.js`; on Netlify the same logic runs as serverless functions.
If refinement is unavailable the app falls back to a local "quick format" so
it never hard-fails; if transcription is unavailable it offers the text box.

## Run it locally

1. **Get an Anthropic API key** — https://console.anthropic.com/
2. **Configure it:**
   ```bash
   cp .env.example .env
   # edit .env and paste your key into ANTHROPIC_API_KEY
   ```
3. **Install and start:**
   ```bash
   npm install
   npm start
   ```
4. Open **http://localhost:3000**. Tap the mic (or "Type instead") and capture a
   thought.

Check `http://localhost:3000/api/health` — `keyConfigured` should be `true`.

## Configuration

| Variable            | Default             | Purpose                                                        |
| ------------------- | ------------------- | -------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | _(required)_        | Your Anthropic key. Without it, refinement falls back to local. |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-6` | Model used to refine notes. Set `claude-opus-5` for more depth. |
| `PORT`              | `3000`              | Port to serve on.                                              |

## Notes about the app

- **Voice capture** uses the browser's Web Speech API — best support is in
  Chrome/Edge and Safari. Where it's unavailable the app offers a text box.
- **Read aloud** uses the browser's speech synthesis.
- **Your notes stay on your device** — they're saved in `localStorage`. Settings
  → "Back up to a file" exports everything; "Restore from a file" imports it.
  There is no server-side database.

## Deploying

### Netlify (recommended — zero config)

`netlify.toml` already sets the publish directory, functions, and routing, so a
connected repo deploys with no manual build settings. The refine endpoint runs
as a serverless function (`netlify/functions/`); the same code serves it locally
via Express.

**The only steps you must do by hand** — because keys are secrets and can't
live in the repo:

1. In Netlify: **Site settings → Environment variables → Add a variable**
2. Add both keys:
   - `ANTHROPIC_API_KEY` — from https://console.anthropic.com/ (note refinement)
   - `GEMINI_API_KEY` — from https://aistudio.google.com/apikey (voice transcription)
3. **Trigger a redeploy** (Deploys → Trigger deploy) so the keys take effect.

That's it. (Optional: `ANTHROPIC_MODEL` = `claude-opus-5` for higher-quality
notes; `GEMINI_MODEL` to change the transcription model.)

Verify at `https://<your-site>.netlify.app/api/health` — `keyConfigured` and
`geminiKeyConfigured` should both be `true`. Netlify serves over HTTPS
automatically, so the mic works.

> Without the keys the site still loads and captures notes — typing always
> works, and refinement falls back to a local "quick format" until the keys
> are set.

### Any Node host (Render, Railway, Fly.io, a VM…)

- Start command: `npm start`
- Set `ANTHROPIC_API_KEY` in the host's environment (don't commit `.env`).
- The server serves both the UI and the API on one port. Put it behind HTTPS —
  the mic requires a secure context.
