"use strict";

/**
 * Netlify function backing POST /api/standup (see netlify.toml redirect).
 * Shares its logic with the local server via lib/standup.js.
 */

const { standup } = require("../../lib/standup");

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
  if (!body.venture) return json(400, { error: "no_venture" });

  try {
    return json(200, await standup(body.venture, body.notes));
  } catch (err) {
    console.error("[standup] failed:", (err && err.message) || err);
    return json(502, { error: "standup_failed" });
  }
};
