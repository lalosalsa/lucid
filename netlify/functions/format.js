"use strict";

/**
 * Netlify function backing POST /api/format (see netlify.toml redirect).
 * Shares its note tidy-up logic with the local server via lib/format.js.
 */

const { format } = require("../../lib/format");

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
  if (!raw) return json(400, { error: "empty_note" });

  try {
    return json(200, await format(raw));
  } catch (err) {
    console.error("[format] failed:", (err && err.message) || err);
    // The note is already saved client-side; it just stays as captured.
    return json(502, { error: "format_failed" });
  }
};
