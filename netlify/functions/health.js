"use strict";

// Netlify function backing GET /api/health — quick check that the key is set.
exports.handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ok: true,
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    keyConfigured: !!process.env.ANTHROPIC_API_KEY,
  }),
});
