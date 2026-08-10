"use strict";

/**
 * Netlify function backing POST /api/refine (see netlify.toml redirect).
 * Shares its refinement logic with the local server via lib/refine.js.
 */

const { LENSES, refine } = require("../../lib/refine");

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

  const raw = typeof body.raw === "string" ? body.raw : "";
  const lens = LENSES[body.lens] ? body.lens : "operator";
  const ventures = Array.isArray(body.ventures) ? body.ventures : [];
  if (!raw.trim()) return json(400, { error: "empty_thought" });

  try {
    return json(200, await refine(raw, lens, ventures));
  } catch (err) {
    if (err && err.status === 401) console.error("[refine] Anthropic auth failed — check ANTHROPIC_API_KEY.");
    else console.error("[refine] failed:", (err && err.message) || err);
    // The frontend falls back to a local quick-format when this fails.
    return json(502, { error: "refine_failed" });
  }
};
