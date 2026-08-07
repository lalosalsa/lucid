# Lucid Notes

Think out loud, get it back sharp. Speak or type a rough thought and Claude
reshapes it into a clean note — title, thesis, bullet points, and next actions —
grouped into smart folders with the tasks pulled out for you.

## Why there's a backend

The app is a single-page mobile UI (`public/index.html`). The one thing it
can't do in the browser is call Claude: an API key in client-side code would be
visible to everyone, and browsers can't call the Anthropic API directly. So a
tiny Node server (`server.js`) holds the key and exposes one endpoint,
`POST /api/refine`, that the app calls. If that endpoint is unavailable, the app
falls back to a local "quick format" so it never hard-fails.

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

Any host that runs Node works (Render, Railway, Fly.io, a VM, etc.):

- Start command: `npm start`
- Set `ANTHROPIC_API_KEY` as an environment variable in the host's dashboard
  (do **not** commit `.env`).
- The server serves both the UI and the API on the same port, so no extra
  routing is needed. Put it behind HTTPS — the mic requires a secure context.
