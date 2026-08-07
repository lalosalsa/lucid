"use strict";

/**
 * Lucid Notes — backend.
 *
 * Serves the static app in ./public and exposes POST /api/refine, which takes a
 * rough spoken/typed thought and returns a structured note. The Anthropic API
 * key lives only here (server-side), never in the browser.
 */

require("dotenv").config();
const path = require("path");
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// The SDK reads ANTHROPIC_API_KEY from the environment.
const client = new Anthropic();

// Sonnet is the right tier for a high-frequency, latency-sensitive microtask
// like reshaping one note. Override with ANTHROPIC_MODEL (e.g. claude-opus-5)
// if you want higher quality per note.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const LENSES = {
  operator: {
    label: "Operator",
    guide:
      "The user runs things day to day. Bias toward clarity and momentum: crisp thesis, tight bullets, and concrete next actions when the thought implies them.",
  },
  analyst: {
    label: "Analyst",
    guide:
      "Be rigorous and literal. Organize only what was actually said, flag open questions as points, and never infer facts, numbers, or decisions. Actions stay empty unless clearly stated.",
  },
  meeting: {
    label: "Meeting",
    guide:
      "Treat this as a debrief. Pull out decisions made, owners, and follow-ups. Points read like a record; actions name who does what if the speaker said it.",
  },
};

function buildSystem(lens) {
  const l = LENSES[lens] || LENSES.operator;
  return (
    "You are the silent thinking partner inside Lucid Notes, a capture tool for busy operators and founders. The user just spoke a rough, unstructured thought out loud.\n\n" +
    "Return it as a sharp, professional note that feels like it read their mind. Rules that matter most:\n" +
    "- NEVER pad with filler. NEVER invent facts, people, numbers, dates, or decisions they did not say.\n" +
    "- Preserve their intent and voice. You clarify and organize, not rewrite into corporate mush.\n" +
    "- If the thought is thin, keep the note thin.\n" +
    "- Expand only by surfacing structure already implied.\n\n" +
    "Lens — " + l.label + ": " + l.guide + "\n\n" +
    "Return ONLY valid JSON. No markdown, no fences, no preamble. Exact shape:\n" +
    '{"title":"3-6 word title","project":"1-2 word bucket, inferred (Pricing, Hiring, Product, Fundraising...). If unclear use Inbox.","thesis":"one crisp sentence","points":["2-5 short bullets, only what is supported"],"actions":["0-3 concrete next steps if implied; empty if none"]}\n' +
    "No emoji. No hedging. Tight, professional language."
  );
}

function parseNote(text) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const p = JSON.parse(cleaned);
  return {
    title: (p.title || "Untitled note").toString().trim(),
    project: (p.project || "Inbox").toString().trim(),
    thesis: (p.thesis || "").toString(),
    points: Array.isArray(p.points) ? p.points.slice(0, 5) : [],
    actions: Array.isArray(p.actions) ? p.actions.slice(0, 3) : [],
  };
}

app.post("/api/refine", async (req, res) => {
  const raw = req.body && typeof req.body.raw === "string" ? req.body.raw : "";
  const lens = req.body && LENSES[req.body.lens] ? req.body.lens : "operator";
  if (!raw.trim()) return res.status(400).json({ error: "empty_thought" });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      output_config: { effort: "low" }, // fast + cheap; this is a formatting task
      system: buildSystem(lens),
      messages: [
        {
          role: "user",
          content:
            'Rough spoken thought:\n"""\n' + raw + '\n"""\n\nReturn the JSON note.',
        },
      ],
    });
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return res.json(parseNote(text));
  } catch (err) {
    const status = err && err.status;
    if (status === 401) console.error("[refine] Anthropic auth failed — check ANTHROPIC_API_KEY.");
    else console.error("[refine] failed:", (err && err.message) || err);
    // The frontend falls back to a local quick-format when this fails.
    return res.status(502).json({ error: "refine_failed" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, model: MODEL, keyConfigured: !!process.env.ANTHROPIC_API_KEY });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lucid Notes running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("WARNING: ANTHROPIC_API_KEY is not set — AI refinement will fail and the app will fall back to local quick-format. Copy .env.example to .env and add your key.");
  }
});
