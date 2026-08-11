"use strict";

/**
 * Speech-to-text via Google Gemini. Takes base64 audio (WAV from the browser)
 * and returns a plain-text transcript. Uses the REST API directly — no SDK
 * dependency. The GEMINI_API_KEY lives only server-side.
 */

const { env } = require("./env");

const MODEL = env("GEMINI_MODEL", "gemini-2.5-flash");

const PROMPT =
  "Transcribe this audio recording verbatim into plain text. Output only the " +
  "exact words spoken, with normal punctuation and capitalization. Do not add " +
  "commentary, labels, timestamps, or quotation marks. If there is no " +
  "discernible speech, output nothing at all.";

async function transcribe(audioBase64, mime) {
  const key = env("GEMINI_API_KEY", "");
  if (!key) {
    const e = new Error("GEMINI_API_KEY is not set");
    e.status = 401;
    throw e;
  }
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      MODEL +
      ":generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mime || "audio/wav", data: audioBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
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
  return parts.map((p) => p.text || "").join("").trim();
}

module.exports = { transcribe, GEMINI_MODEL: MODEL };
