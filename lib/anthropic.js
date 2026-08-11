"use strict";

/**
 * The shared Anthropic client.
 *
 * The SDK reads process.env.ANTHROPIC_API_KEY itself, but that lookup is
 * case-sensitive - so a key saved as "Anthropic_API_Key" would pass our own
 * hasEnv() check and still leave the client unauthenticated. Resolve the key
 * through lib/env.js so both agree on what "configured" means.
 */

const Anthropic = require("@anthropic-ai/sdk");
const { env } = require("./env");

// undefined (not "") lets the SDK keep its own null-key behaviour: construction
// succeeds and the failure surfaces as a 401 on the first request.
const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY", undefined) });

module.exports = { client };
