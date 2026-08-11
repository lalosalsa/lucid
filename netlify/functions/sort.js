"use strict";

/**
 * Netlify function backing POST /api/sort (see netlify.toml redirect).
 * Shares its triage logic with the local server via lib/sort.js.
 */

const { sort } = require("../../lib/sort");
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

  const raw = typeof body.raw === "string" ? body.raw.trim() : "";
  if (!raw) return json(400, { error: "empty_capture" });
  if (!hasEnv("GEMINI_API_KEY")) return json(503, { error: "no_key" });

  try {
    return json(200, await sort(raw, body.ventures));
  } catch (err) {
    console.error("[sort] failed:", (err && err.message) || err);
    // The client falls back to its own rules, so this is never fatal.
    return json(502, { error: "sort_failed" });
  }
};
