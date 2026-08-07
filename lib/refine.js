"use strict";

/**
 * Shared note-refinement logic, used by both the local Express server
 * (server.js) and the Netlify function (netlify/functions/refine.js).
 */

const Anthropic = require("@anthropic-ai/sdk");

// The SDK reads ANTHROPIC_API_KEY from the environment. Constructing the client
// never throws on a missing key — that surfaces at request time instead.
const client = new Anthropic();

// Sonnet is the right tier for a high-frequency, latency-sensitive microtask
// like reshaping one note. Override with ANTHROPIC_MODEL (e.g. claude-opus-5).
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

/**
 * Refine a rough thought into a structured note. Throws on API/parse failure;
 * callers return a 502 so the frontend can fall back to local quick-format.
 */
async function refine(raw, lens) {
  const l = LENSES[lens] ? lens : "operator";
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    output_config: { effort: "low" }, // fast + cheap; this is a formatting task
    system: buildSystem(l),
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
  return parseNote(text);
}

module.exports = { LENSES, MODEL, refine };
