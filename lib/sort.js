"use strict";

/**
 * Triage, by Gemini.
 *
 * Every capture arrives as one blob of speech. Before anything expensive
 * happens, something has to decide: is this a to-do, a fact worth keeping, or
 * a piece of thinking worth developing — and which business is it about?
 * That is a cheap, high-volume judgement, so Gemini Flash makes it and Claude
 * is reserved for the thinking itself.
 *
 * Deciding here rather than in the browser also means the answer improves
 * without shipping new regexes, and the same call cleans up the text: filler
 * words out, the routing phrase ("for Northwind") out of the task itself.
 */

const { env } = require("./env");

const MODEL = env("GEMINI_SORT_MODEL", env("GEMINI_MODEL", "gemini-2.5-flash"));

const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["task", "note", "thought"] },
    text: { type: "string" },
    ventureId: { type: "string" },
    ventureName: { type: "string" },
    // Plain string, not an enum: an empty value is valid here and enums in the
    // response schema do not allow one. Normalised on the way out.
    ventureKind: { type: "string" },
    worthExpanding: { type: "boolean" },
  },
  required: ["kind", "text", "ventureId", "ventureName", "ventureKind", "worthExpanding"],
};

const GUIDE =
  "You are the router inside Lucid, a voice capture app for founders and operators. " +
  "You receive one spoken capture, already transcribed. Decide what it is and where it belongs. " +
  "You are NOT writing anything for the user - you only classify and tidy.\n\n" +
  "kind:\n" +
  '- "task" - an action they intend to take. They asked for a task ("add task...", "remind me to..."), ' +
  "or it is plainly a single actionable item. Prefer this whenever there is one clear action.\n" +
  '- "note" - something to record as-is: a fact, a number, a decision made, something that happened. ' +
  "Nothing to develop, nothing to do.\n" +
  '- "thought" - thinking: an idea, a possibility, a question they are chewing on, a plan taking shape, ' +
  "a problem without an answer yet. These are worth developing.\n" +
  "When genuinely torn between note and thought, choose thought only if there is a real bet or open " +
  "question in it. A log of what happened is a note.\n\n" +
  "text:\n" +
  'For "task": just the action, imperative, no command wrapper and no business name that was only ' +
  'used for routing. "add a task for Northwind to call the mulch supplier" -> "Call the mulch supplier".\n' +
  'For "note": their words, lightly cleaned - drop filler ("um", "you know", "like"), false starts and ' +
  "the command wrapper. Keep their voice, their facts and their numbers. Do not summarise or improve.\n" +
  'For "thought": return the capture unchanged apart from filler and false starts.\n\n' +
  "worthExpanding: true only for a thought with something to pressure-test - a bet, a real question, " +
  "an idea with consequences. False for tasks, logs and anything already settled.";

function ventureBlock(ventures) {
  const list = Array.isArray(ventures) ? ventures.filter((v) => v && v.name) : [];
  if (!list.length) {
    return (
      "\nThey track no businesses yet.\n" +
      "If this capture is clearly about a specific business or idea, name it: set ventureId to \"\", " +
      'ventureName to a short name (1-3 words), and ventureKind to "running" if they are operating it ' +
      'or "idea" if they are still exploring it. Otherwise leave all three empty ("").\n'
    );
  }
  return (
    "\nThe businesses they already track:\n" +
    list.map((v) => `- id=${v.id} | ${v.name} | ${v.kind === "idea" ? "idea" : "running"}`).join("\n") +
    "\n\nRoute this capture to one of them: set ventureId to that exact id, ventureName to that exact " +
    "name, ventureKind to its kind.\n" +
    "If they named one out loud, that is the answer - even in passing.\n" +
    "Only start a new one when the capture is clearly about a different business or idea; then set " +
    'ventureId to "" and give a short ventureName and a ventureKind.\n' +
    'If it fits none of them and is not about a new business, leave all three empty ("").\n' +
    "Never create a near-duplicate of a business listed above.\n"
  );
}

function clean(s, max) {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

/**
 * @returns {{kind:string,text:string,venture:{id,name,kind}|null,worthExpanding:boolean}}
 */
async function sort(raw, ventures) {
  const key = env("GEMINI_API_KEY", "");
  if (!key) {
    const e = new Error("GEMINI_API_KEY is not set");
    e.status = 401;
    throw e;
  }
  const text = String(raw || "").trim();
  if (!text) {
    const e = new Error("empty_capture");
    e.status = 400;
    throw e;
  }

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: GUIDE + ventureBlock(ventures) }] },
        contents: [{ parts: [{ text: "Capture:\n" + text.slice(0, 6000) }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    const e = new Error("gemini_" + res.status + ": " + body.slice(0, 300));
    e.status = res.status;
    throw e;
  }

  const j = await res.json();
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  let p;
  try {
    p = JSON.parse(parts.map((x) => x.text || "").join("") || "{}");
  } catch (e) {
    const err = new Error("bad_json_from_model");
    err.status = 502;
    throw err;
  }

  const kind = ["task", "note", "thought"].indexOf(p.kind) >= 0 ? p.kind : "thought";
  const name = clean(p.ventureName, 60);
  return {
    kind: kind,
    // Never let a tidy-up lose the capture: fall back to what they actually said.
    text: clean(p.text, 4000) || text,
    venture: name
      ? { id: clean(p.ventureId, 60), name: name, kind: p.ventureKind === "idea" ? "idea" : "running" }
      : null,
    worthExpanding: kind === "thought" && p.worthExpanding === true,
  };
}

module.exports = { sort, SORT_MODEL: MODEL };
