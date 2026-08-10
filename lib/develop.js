"use strict";

/**
 * The "go deeper" conversation: a founder pushes on a captured note and gets a
 * sharp co-founder back. Keeps the note as context so they never have to
 * re-explain it. Used by server.js and netlify/functions/develop.js.
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM =
  "You are the thinking partner inside Lucid, helping a founder develop a thought they captured about their business.\n\n" +
  "How to talk:\n" +
  "- Be direct and specific. Concrete suggestions, not generic business advice. If something is a bad idea, say so and say why.\n" +
  "- Keep it short. A few sentences to a short paragraph — this is a phone screen, not a report. No headers, no bullet walls unless they ask for a list.\n" +
  "- Ask at most one question at a time, and only when the answer would actually change your advice.\n" +
  "- Challenge the assumption doing the heaviest lifting rather than agreeing pleasantly.\n\n" +
  "Hard rule: never invent facts about their business — their numbers, customers, team, runway, or history. If you need something to answer well, ask for it. You may reason about what they've told you and about the world generally.\n\n" +
  "You are a sharp co-founder in a hallway conversation, not a consultant delivering a deck.";

function noteContext(note) {
  const n = note || {};
  const list = (label, a) =>
    Array.isArray(a) && a.length ? label + ":\n" + a.map((x) => "- " + x).join("\n") + "\n" : "";
  return (
    "The note we're working from:\n\n" +
    "TITLE: " + (n.title || "Untitled") + "\n" +
    (n.thesis ? "THESIS: " + n.thesis + "\n" : "") +
    list("WHAT THEY SAID", n.points) +
    list("OPEN QUESTIONS", n.questions) +
    list("ANGLES", n.angles) +
    list("RISKS", n.risks) +
    (Array.isArray(n.actions) && n.actions.length
      ? "NEXT STEPS:\n" + n.actions.map((a) => "- " + (a && a.text ? a.text : a)).join("\n") + "\n"
      : "") +
    (n.raw ? "\nTHEIR ORIGINAL WORDS:\n" + n.raw + "\n" : "")
  );
}

/**
 * @param {object} note   the note being developed
 * @param {Array}  thread [{role:"user"|"assistant", text}] prior turns
 * @param {string} userMessage the new message
 */
async function develop(note, thread, userMessage) {
  const history = (Array.isArray(thread) ? thread : [])
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .slice(-20)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    }));

  // Lead with the note as context, then the conversation so far.
  const messages = [
    { role: "user", content: noteContext(note) + "\n" + userMessage },
  ];
  if (history.length) {
    messages.length = 0;
    messages.push({ role: "user", content: noteContext(note) + "\nLet's develop this." });
    messages.push({ role: "assistant", content: "Got it — what do you want to push on?" });
    for (const m of history) messages.push(m);
    messages.push({ role: "user", content: userMessage });
  }

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    output_config: { effort: "medium" },
    system: SYSTEM,
    messages,
  });

  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

module.exports = { develop };
