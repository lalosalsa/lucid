"use strict";

/**
 * Venture rollup: reads every note captured against one business (or idea) and
 * answers "where does this actually stand right now?" — the thing a founder
 * can't get from a flat list of notes.
 */

const Anthropic = require("@anthropic-ai/sdk");

const { request } = require("./model");

const client = new Anthropic();

function systemFor(kind) {
  const running =
    "This is a business they are RUNNING. Read it like an operator: what is actually moving, what is stalled, what decision is overdue, what is quietly becoming a problem.";
  const idea =
    "This is an IDEA they are exploring, not yet a business. Read it like a co-founder deciding whether it is worth real time: is the thinking converging or drifting, what is still unvalidated, and what is the cheapest next test that would tell them something real.";
  return (
    "You are the thinking partner inside Lucid. You are looking at everything a founder has captured about one venture over time and giving them a straight read on where it stands.\n\n" +
    (kind === "idea" ? idea : running) +
    "\n\nRules:\n" +
    "- Ground every statement in what the notes actually say. Never invent facts, numbers, customers, or events they did not record.\n" +
    "- Notice change over time — what shifted between older and newer notes, what they keep circling without resolving.\n" +
    "- Be direct. No encouragement, no filler, no consultant register. If it looks stalled, say it looks stalled.\n" +
    "- If there is too little captured to judge, say so plainly rather than padding.\n\n" +
    "Return ONLY valid JSON. No markdown, no fences, no preamble. Exact shape:\n" +
    '{"stands":"2-3 sentences on where this venture actually is right now","moving":["0-3 things with real momentum"],"stuck":["0-3 things blocked, unresolved, or repeatedly deferred"],"focus":["1-3 things that deserve attention next, most important first"]}\n' +
    "No emoji. Write like a sharp co-founder giving a straight read."
  );
}

function notesDigest(notes) {
  // Cap what we send: this is the one call whose input scales with history.
  const list = Array.isArray(notes) ? notes.slice(-40) : [];
  if (!list.length) return "(no notes captured yet)";
  return list
    .map((n, i) => {
      const when = n.createdAt ? new Date(n.createdAt).toISOString().slice(0, 10) : "";
      const bit = (label, a) =>
        Array.isArray(a) && a.length ? "\n  " + label + ": " + a.join(" | ").slice(0, 600) : "";
      const open = Array.isArray(n.actions)
        ? n.actions.filter((a) => a && !a.done).map((a) => a.text)
        : [];
      const done = Array.isArray(n.actions)
        ? n.actions.filter((a) => a && a.done).map((a) => a.text)
        : [];
      return (
        `[${i + 1}] ${when} — ${n.title || "Untitled"}` +
        (n.thesis ? "\n  thesis: " + n.thesis : "") +
        bit("said", n.points) +
        bit("open questions", n.questions) +
        bit("risks", n.risks) +
        bit("still to do", open) +
        bit("done", done)
      );
    })
    .join("\n\n");
}

async function standup(venture, notes) {
  const v = venture || {};
  const message = await client.messages.create(request("standup", "medium", {
    max_tokens: 1000,
    system: systemFor(v.kind),
    messages: [
      {
        role: "user",
        content:
          "VENTURE: " + (v.name || "Untitled") + " (" + (v.kind === "idea" ? "idea" : "running business") + ")\n\n" +
          "Everything captured about it, oldest first:\n\n" +
          notesDigest(notes) +
          "\n\nGive me the read. Return the JSON.",
      },
    ],
  }));
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const p = JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
  const arr = (x, n) =>
    Array.isArray(x) ? x.filter((s) => typeof s === "string" && s.trim()).slice(0, n) : [];
  return {
    stands: (p.stands || "").toString(),
    moving: arr(p.moving, 3),
    stuck: arr(p.stuck, 3),
    focus: arr(p.focus, 3),
  };
}

module.exports = { standup };
