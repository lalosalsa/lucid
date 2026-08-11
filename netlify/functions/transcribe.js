"use strict";

/**
 * Netlify function backing POST /api/transcribe (see netlify.toml redirect).
 * Shares its speech-to-text logic with the local server via lib/transcribe.js.
 */

const { transcribe } = require("../../lib/transcribe");
const { hasEnv } = require("../../lib/env");

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

  if (!hasEnv("GEMINI_API_KEY")) {
    console.error("[transcribe] GEMINI_API_KEY is not set on this deploy.");
    return json(503, { error: "no_key" });
  }

  try {
    return json(200, { text: await transcribe(audio, mime) });
  } catch (err) {
    const msg = (err && err.message) || "";
    const status = err && err.status;
    // Gemini reports a bad key as 400 INVALID_ARGUMENT, not 401/403.
    const badKey = status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(msg);
    if (badKey) {
      console.error("[transcribe] Gemini rejected the key - check GEMINI_API_KEY.");
      return json(503, { error: "bad_key" });
    }
    console.error("[transcribe] failed:", (err && err.message) || err);
    return json(502, { error: "transcribe_failed" });
  }
};
