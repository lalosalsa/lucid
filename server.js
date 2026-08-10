"use strict";

/**
 * Lucid Notes — local dev server.
 *
 * Serves the static app in ./public and exposes POST /api/refine. In production
 * on Netlify the same refine logic runs as a serverless function instead (see
 * netlify/functions/refine.js); both share lib/refine.js. The Anthropic API key
 * lives only server-side, never in the browser.
 */

require("dotenv").config();
const path = require("path");
const express = require("express");
const { LENSES, MODEL, refine } = require("./lib/refine");
const { transcribe, GEMINI_MODEL } = require("./lib/transcribe");
const { develop } = require("./lib/develop");

const app = express();
// Audio (base64 WAV) can be a few MB; give the body parser room.
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/transcribe", async (req, res) => {
  const audio = req.body && typeof req.body.audio === "string" ? req.body.audio : "";
  const mime = req.body && typeof req.body.mime === "string" ? req.body.mime : "audio/wav";
  if (!audio) return res.status(400).json({ error: "no_audio" });
  try {
    return res.json({ text: await transcribe(audio, mime) });
  } catch (err) {
    if (err && err.status === 401) console.error("[transcribe] Gemini auth failed — check GEMINI_API_KEY.");
    else console.error("[transcribe] failed:", (err && err.message) || err);
    return res.status(502).json({ error: "transcribe_failed" });
  }
});

app.post("/api/refine", async (req, res) => {
  const raw = req.body && typeof req.body.raw === "string" ? req.body.raw : "";
  const lens = req.body && LENSES[req.body.lens] ? req.body.lens : "operator";
  if (!raw.trim()) return res.status(400).json({ error: "empty_thought" });

  try {
    return res.json(await refine(raw, lens));
  } catch (err) {
    if (err && err.status === 401) console.error("[refine] Anthropic auth failed — check ANTHROPIC_API_KEY.");
    else console.error("[refine] failed:", (err && err.message) || err);
    // The frontend falls back to a local quick-format when this fails.
    return res.status(502).json({ error: "refine_failed" });
  }
});

app.post("/api/develop", async (req, res) => {
  const b = req.body || {};
  const msg = typeof b.message === "string" ? b.message.trim() : "";
  if (!msg) return res.status(400).json({ error: "empty_message" });
  try {
    return res.json({ reply: await develop(b.note, b.thread, msg) });
  } catch (err) {
    console.error("[develop] failed:", (err && err.message) || err);
    return res.status(502).json({ error: "develop_failed" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    keyConfigured: !!process.env.ANTHROPIC_API_KEY,
    sttModel: GEMINI_MODEL,
    geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lucid Notes running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("WARNING: ANTHROPIC_API_KEY is not set — AI refinement will fail and the app will fall back to local quick-format. Copy .env.example to .env and add your key.");
  }
});
