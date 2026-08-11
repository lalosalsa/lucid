"use strict";

/**
 * Model selection, shared by refine / develop / standup.
 *
 * Each job can run on its own model, so you can put a cheap fast model on
 * high-volume capture and keep a stronger one for the reasoning work:
 *
 *   ANTHROPIC_MODEL           default for everything (fallback: claude-sonnet-4-6)
 *   ANTHROPIC_MODEL_FORMAT    tidying a note into a title and clean body
 *   ANTHROPIC_MODEL_REFINE    structuring a captured thought
 *   ANTHROPIC_MODEL_DEVELOP   the "go deeper" conversation
 *   ANTHROPIC_MODEL_STANDUP   the "where it stands" business read
 */

/**
 * Cost presets. "format" and "refine" run on capture, so they dominate spend;
 * "develop" and "standup" run on demand and are where reasoning quality pays off.
 * Formatting is a tidy-up, not a reasoning job - it stays on Haiku even in
 * quality mode, because a bigger model does not write a better note title.
 * Set LUCID_COST_MODE to economy | balanced | quality.
 */
const MODES = {
  economy: {
    format: "claude-haiku-4-5",
    refine: "claude-haiku-4-5",
    develop: "claude-haiku-4-5",
    standup: "claude-haiku-4-5",
  },
  balanced: {
    format: "claude-haiku-4-5",
    refine: "claude-haiku-4-5",
    develop: "claude-sonnet-4-6",
    standup: "claude-sonnet-4-6",
  },
  quality: {
    format: "claude-haiku-4-5",
    refine: "claude-sonnet-4-6",
    develop: "claude-opus-5",
    standup: "claude-opus-5",
  },
};

const { env } = require("./env");

const MODE = env("LUCID_COST_MODE", "balanced").toLowerCase();
const PRESET = MODES[MODE] || MODES.balanced;

const DEFAULT_MODEL = env("ANTHROPIC_MODEL", "");

/**
 * Precedence, most specific first:
 *   ANTHROPIC_MODEL_<ROLE>  ->  ANTHROPIC_MODEL  ->  cost-mode preset
 */
function modelFor(role) {
  const key = String(role).toUpperCase();
  return (
    env("ANTHROPIC_MODEL_" + key, "") ||
    DEFAULT_MODEL ||
    PRESET[String(role).toLowerCase()] ||
    "claude-sonnet-4-6"
  );
}

/**
 * `output_config.effort` is only accepted on some models — Haiku 4.5 and
 * Sonnet 4.5 return a 400 if it's present. Allowlist rather than denylist so an
 * unrecognized model degrades to "no effort hint" instead of erroring.
 */
function supportsEffort(model) {
  return /^(?:anthropic\.)?claude-(?:opus-(?:4-5|4-6|4-7|4-8|5)|sonnet-(?:4-6|5)|fable-5|mythos-5)\b/.test(
    String(model || "")
  );
}

/**
 * Build the request body, including `output_config.effort` only where supported.
 */
function request(role, effort, body) {
  const model = modelFor(role);
  const params = Object.assign({ model: model }, body);
  if (supportsEffort(model)) params.output_config = { effort: effort };
  return params;
}

module.exports = { MODE, MODES, DEFAULT_MODEL, modelFor, supportsEffort, request };
