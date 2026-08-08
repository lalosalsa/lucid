"use strict";

/**
 * Netlify function backing POST /api/transcribe (see netlify.toml redirect).
 * Shares its speech-to-text logic with the local server via lib/transcribe.js.
 */

const { transcribe } = require("../../lib/transcribe");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "bad_json" });
  }

  const audio = typeof body.audio === "string" ? body.audio : "";
  const mime = typeof body.mime === "string" ? body.mime : "audio/wav";
  if (!audio) return json(400, { error: "no_audio" });

  try {
    return json(200, { text: await transcribe(audio, mime) });
  } catch (err) {
    if (err && err.status === 401) console.error("[transcribe] Gemini auth failed — check GEMINI_API_KEY.");
    else console.error("[transcribe] failed:", (err && err.message) || err);
    return json(502, { error: "transcribe_failed" });
  }
};
