"use strict";

const { modelFor, MODE } = require("../../lib/model");
const { env, hasEnv } = require("../../lib/env");

// Netlify function backing GET /api/health - which keys and models are live.
exports.handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ok: true,
    keyConfigured: hasEnv("ANTHROPIC_API_KEY"),
    geminiKeyConfigured: hasEnv("GEMINI_API_KEY"),
    costMode: MODE,
    models: {
      refine: modelFor("refine"),
      develop: modelFor("develop"),
      standup: modelFor("standup"),
      transcribe: env("GEMINI_MODEL", "gemini-2.5-flash"),
      sort: env("GEMINI_SORT_MODEL", env("GEMINI_MODEL", "gemini-2.5-flash")),
    },
  }),
});
