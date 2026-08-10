"use strict";

/**
 * Shared note-refinement logic, used by both the local Express server
 * (server.js) and the Netlify function (netlify/functions/refine.js).
 *
 * Two jobs: capture what the founder said faithfully, AND develop it —
 * questions, angles, and risks they didn't say. The split matters: thesis and
 * points are theirs; questions/angles/risks are the app's contribution.
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const LENSES = {
  operator: {
    label: "Operator",
    guide:
      "They run things day to day. Bias toward momentum: a crisp thesis, tight points, and concrete next actions. Questions should be the ones blocking a decision this week; angles should be things they could actually do; risks should be operational, not theoretical.",
  },
  analyst: {
    label: "Analyst",
    guide:
      "Be rigorous. Points stay strictly literal — only what was said. Weight your output toward questions and risks over angles: name the assumption doing the heaviest lifting, the number that would settle the argument, and what evidence is missing. Actions stay empty unless clearly stated.",
  },
  meeting: {
    label: "Meeting",
    guide:
      "Treat this as a debrief. Points read like a record of decisions, owners, and follow-ups. Questions are the items left genuinely unresolved; risks are where the room may have agreed too easily; actions name who does what if the speaker said it.",
  },
};

function buildSystem(lens) {
  const l = LENSES[lens] || LENSES.operator;
  return (
    "You are the thinking partner inside Lucid, a capture tool for founders, operators, and entrepreneurs. The user just dumped a rough, unstructured thought about their business.\n\n" +
    "You have two jobs, and the line between them is the whole product:\n\n" +
    "1. CAPTURE IT FAITHFULLY. Organize what they actually said into a thesis and points. Never invent facts, numbers, names, dates, or decisions they did not state. This is their record of their own business — fabricating a detail here is the worst thing you can do.\n\n" +
    "2. DEVELOP IT. This is why they use you instead of a notes app. Push the thinking forward:\n" +
    "   - questions: the sharp questions that would most change their plan if answered. Specific to what they said — the questions a smart co-founder asks, not a generic checklist.\n" +
    "   - angles: directions, opportunities, or reframings they did not mention. Concrete, not motivational.\n" +
    "   - risks: the blind spot, the assumption carrying the most weight, what breaks first.\n\n" +
    "thesis and points are THEIRS — only what they said.\n" +
    "questions, angles, and risks are YOURS — new thinking they did not say.\n" +
    "Never blur those two. Never smuggle a suggestion into points.\n\n" +
    "If the thought is thin, keep thesis and points thin — but still develop it. A half-formed thought usually needs the most pushing.\n\n" +
    "Lens — " + l.label + ": " + l.guide + "\n\n" +
    "Return ONLY valid JSON. No markdown, no fences, no preamble. Exact shape:\n" +
    '{"title":"3-6 word title","project":"1-2 word bucket, inferred (Pricing, Hiring, Product, Fundraising...). If unclear use Inbox.","thesis":"one crisp sentence — their core idea, sharpened","points":["2-5 short bullets, only what they actually said"],"questions":["2-4 sharp questions that pressure-test this"],"angles":["1-3 directions or opportunities they did not mention"],"risks":["1-3 blind spots or load-bearing assumptions"],"actions":["0-3 concrete next steps if implied; empty if none"]}\n' +
    "No emoji. No hedging. No consultant filler. Write like a sharp co-founder talking straight."
  );
}

function arr(v, n) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, n) : [];
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
    points: arr(p.points, 5),
    questions: arr(p.questions, 4),
    angles: arr(p.angles, 3),
    risks: arr(p.risks, 3),
    actions: arr(p.actions, 3),
  };
}

async function refine(raw, lens) {
  const l = LENSES[lens] ? lens : "operator";
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "medium" }, // developing ideas needs more than formatting
    system: buildSystem(l),
    messages: [
      {
        role: "user",
        content:
          'Rough thought:\n"""\n' + raw + '\n"""\n\nReturn the JSON note.',
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
