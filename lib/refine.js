"use strict";

/**
 * Shared note-refinement logic, used by both the local Express server
 * (server.js) and the Netlify function (netlify/functions/refine.js).
 *
 * Two jobs: capture what the founder said faithfully, AND develop it —
 * questions, angles, and risks they didn't say. The split matters: thesis and
 * points are theirs; questions/angles/risks are the app's contribution.
 */

const { request, modelFor } = require("./model");

const { client } = require("./anthropic");

const MODEL = modelFor("refine");

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

/**
 * Ventures the user already tracks, so a captured thought files itself instead
 * of making them tap through menus. Matching an existing venture by id is
 * strongly preferred over inventing a near-duplicate.
 */
function ventureBlock(ventures) {
  const list = Array.isArray(ventures) ? ventures.filter((v) => v && v.name) : [];
  if (!list.length) {
    return (
      "\nVENTURE ROUTING — they have no ventures yet.\n" +
      'Return "venture": {"id":"","name":"<short name for the business or idea this is about>","kind":"idea" or "running"}.\n' +
      'Use "running" if they speak about it as something already operating (customers, revenue, staff, shipping); "idea" if it is something they are considering or exploring. If the thought is a personal to-do with no business attached, use name "Inbox" and kind "running".\n'
    );
  }
  return (
    "\nVENTURE ROUTING — the ventures they already track:\n" +
    list.map((v) => `- id=${v.id} | ${v.name} (${v.kind === "idea" ? "idea" : "running"})`).join("\n") +
    "\n\nDecide which one this thought belongs to and return it as \"venture\".\n" +
    'If it belongs to an existing venture, return {"id":"<that exact id>","name":"<that exact name>","kind":"<its kind>"}.\n' +
    'Only invent a new venture when the thought is clearly about a different business or idea — then return {"id":"","name":"<short name>","kind":"idea" or "running"}.\n' +
    "Prefer matching an existing venture. Do not create near-duplicates of the list above.\n"
  );
}

function buildSystem(lens, ventures) {
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
    "Lens — " + l.label + ": " + l.guide + "\n" +
    ventureBlock(ventures) + "\n" +
    "Return ONLY valid JSON. No markdown, no fences, no preamble. Exact shape:\n" +
    '{"title":"3-6 word title","project":"1-2 word topic (Pricing, Hiring, Product...). If unclear use Inbox.","venture":{"id":"","name":"","kind":"idea|running"},"thesis":"one crisp sentence — their core idea, sharpened","points":["2-5 short bullets, only what they actually said"],"questions":["2-4 sharp questions that pressure-test this"],"angles":["1-3 directions or opportunities they did not mention"],"risks":["1-3 blind spots or load-bearing assumptions"],"actions":["0-3 concrete next steps if implied; empty if none"]}\n' +
    "No emoji. No hedging. No consultant filler. Write like a sharp co-founder talking straight."
  );
}

function arr(v, n) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, n) : [];
}

function parseVenture(v) {
  const o = v && typeof v === "object" ? v : {};
  const name = (o.name || "").toString().trim();
  if (!name) return null;
  return {
    id: (o.id || "").toString().trim(),
    name: name.slice(0, 60),
    kind: o.kind === "idea" ? "idea" : "running",
  };
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
    venture: parseVenture(p.venture),
    thesis: (p.thesis || "").toString(),
    points: arr(p.points, 5),
    questions: arr(p.questions, 4),
    angles: arr(p.angles, 3),
    risks: arr(p.risks, 3),
    actions: arr(p.actions, 3),
  };
}

async function refine(raw, lens, ventures) {
  const l = LENSES[lens] ? lens : "operator";
  // effort is applied only on models that accept it - see lib/model.js
  const message = await client.messages.create(request("refine", "medium", {
    max_tokens: 1200,
    system: buildSystem(l, ventures),
    messages: [
      {
        role: "user",
        content:
          'Rough thought:\n"""\n' + raw + '\n"""\n\nReturn the JSON note.',
      },
    ],
  }));
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return parseNote(text);
}

module.exports = { LENSES, MODEL, refine };
