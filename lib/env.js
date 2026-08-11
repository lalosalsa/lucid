"use strict";

/**
 * Environment lookup that tolerates casing mistakes.
 *
 * Env var names are case-sensitive, so a key saved as "Gemini_API_Key" is
 * invisible to code reading "GEMINI_API_KEY" - the app then behaves exactly as
 * if no key were set, with nothing pointing at the real cause. Hosting dashboards
 * make this easy to get wrong, so match case-insensitively and say so loudly.
 */

const warned = new Set();

function env(name, fallback) {
  const exact = process.env[name];
  if (exact !== undefined && exact !== "") return exact;

  const target = name.toLowerCase();
  for (const key of Object.keys(process.env)) {
    if (key.toLowerCase() === target) {
      const val = process.env[key];
      if (val === undefined || val === "") break;
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(
          '[env] Found "' + key + '" - reading it as "' + name +
          '". Rename it to "' + name + '" to avoid surprises.'
        );
      }
      return val;
    }
  }
  return fallback;
}

/** True when a value is present under the exact name or any casing of it. */
function hasEnv(name) {
  return env(name, "") !== "";
}

module.exports = { env, hasEnv };
