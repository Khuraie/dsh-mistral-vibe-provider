/**
 * Wire-option fixes (0.1.4):
 * 1. map GenerateOptions.stop to Mistral's stop field (the contract documents
 *    it; the adapter refused it). Live-verified: single + multi stop accepted.
 * 2. stored/discovered models had no `wire` map, so reasoning_effort was never
 *    sent even though the picker advertised levels. models.dev's
 *    reasoning_options ARE the wire values, so identity (off -> "none") is the
 *    honest fallback; shipped catalogue wire maps still win.
 */
import { readFileSync, writeFileSync } from "node:fs";

const HOST = new URL("../lib/index.js", import.meta.url);
const PKG = new URL("../package.json", import.meta.url);

function readText(url) {
  const raw = readFileSync(url, "utf8");
  return { text: raw.split("\r\n").join("\n"), crlf: raw.includes("\r\n") };
}
function writeText(url, text, crlf) {
  writeFileSync(url, crlf ? text.split("\n").join("\r\n") : text);
}
function replaceOnce(text, label, from, to) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: ${count} matches, expected 1`);
  return text.replace(from, to);
}

const host = readText(HOST);
let h = host.text;

h = replaceOnce(
  h,
  "drop the stop refusal",
  `    if (options.stop !== undefined) {
      throw mistralFailure("Mistral Vibe does not support GenerateOptions.stop", "UNSUPPORTED_OPTION");
    }`,
  `    // GenerateOptions.stop is part of the contract ("adapters map to the
    // provider's stop field"); Mistral accepts it and halts at the string.`,
);

h = replaceOnce(
  h,
  "stop mapping",
  `    const tools = toMistralTools(options.tools);
    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
      // Mistral declares this flag; Vibe sends it with every tool set.
      body.parallel_tool_calls = true;
    }`,
  `    const tools = toMistralTools(options.tools);
    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
      // Mistral declares this flag; Vibe sends it with every tool set.
      body.parallel_tool_calls = true;
    }
    if (options.stop !== undefined) {
      const stops = (Array.isArray(options.stop) ? options.stop : []).filter(
        (value) => typeof value === "string" && value.length > 0,
      );
      if (stops.length > 0) body.stop = stops.slice(0, 16);
    }`,
);

h = replaceOnce(
  h,
  "reasoning wire fallback",
  `    const level = options.reasoningEffort;
    if (typeof level === "string" && entry.wire !== undefined) {
      const wire = entry.wire[level];
      if (typeof wire === "string" && wire.length > 0) body.reasoning_effort = wire;
    }`,
  `    const level = options.reasoningEffort;
    if (typeof level === "string" && level.length > 0) {
      const wire = entry.wire?.[level];
      if (typeof wire === "string" && wire.length > 0) {
        body.reasoning_effort = wire;
      } else if (entry.wire === undefined && Array.isArray(entry.levels) && entry.levels.includes(level)) {
        // A stored row (a live-discovered model) carries levels but no wire
        // map: models.dev's reasoning_options are the wire values, so identity
        // is the honest mapping. 'off' is Mistral's "none".
        body.reasoning_effort = level === "off" ? "none" : level;
      }
    }`,
);

h = replaceOnce(h, "build stamp", 'const BUILD = "0.1.3+vibe-code";', 'const BUILD = "0.1.4+vibe-code";');
writeText(HOST, h, host.crlf);

const pkg = readText(PKG);
writeText(PKG, replaceOnce(pkg.text, "version", '"version": "0.1.3"', '"version": "0.1.4"'), pkg.crlf);

console.log("wire-option fixes applied");
