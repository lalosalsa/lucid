"use strict";

/**
 * Netlify function backing POST /api/develop (see netlify.toml redirect).
 * Shares its logic with the local server via lib/develop.js.
 */

const { develop } = require("../../lib/develop");

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

  const msg = typeof body.message === "string" ? body.message.trim() : "";
  if (!msg) return json(400, { error: "empty_message" });

  try {
    return json(200, { reply: await develop(body.note, body.thread, msg) });
  } catch (err) {
    console.error("[develop] failed:", (err && err.message) || err);
    return json(502, { error: "develop_failed" });
  }
};
