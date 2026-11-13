/**
 * Fix the tier mark: the served set must be the ids a live read actually
 * returned, not the upstream `discoveredModels` list (which only means
 * "row that is not in the shipped catalogue").
 */
import { readFileSync, writeFileSync } from "node:fs";

const HOST = new URL("../lib/index.js", import.meta.url);
const CLIENT = new URL("../lib/client.js", import.meta.url);
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

/* ---------- host ---------- */
const host = readText(HOST);
let h = host.text;

h = replaceOnce(
  h,
  "served set",
  `const DISCOVERED = new Map();`,
  `const DISCOVERED = new Map();
/**
 * The ids the last live /v1/models read reported for this credential.
 *
 * Distinct from DISCOVERED (ids that are not in the shipped catalogue): this is
 * the whole served surface, aliases included, and it is what the picker uses to
 * mark a row the key cannot call. Empty means "no live read has run", which is
 * not the same as "nothing is served".
 */
const LIVE_SERVED = new Set();`,
);

h = replaceOnce(
  h,
  "config field",
  `  discoveredModels: Schema.array(Schema.string())
    .default([])
    .description(
      "Model ids a live /v1/models read reported; they are advertised ahead of the built-in catalogue.",
    )
    .volatile(),`,
  `  discoveredModels: Schema.array(Schema.string())
    .default([])
    .description(
      "Model ids a live /v1/models read reported; they are advertised ahead of the built-in catalogue.",
    )
    .volatile(),
  servedModels: Schema.array(Schema.string())
    .default([])
    .description(
      "Every id the last live /v1/models read served for this credential, aliases included; a row outside it is marked as not covered by the plan.",
    )
    .volatile(),`,
);

h = replaceOnce(
  h,
  "record served ids",
  `  const findAliasRoot = aliasGroups(entries);`,
  `  const findAliasRoot = aliasGroups(entries);
  // Remember the whole served surface (rows plus their aliases), so the page can
  // tell a tier-gated model from one that just is not in this bundle yet.
  LIVE_SERVED.clear();
  for (const entry of entries) {
    if (typeof entry?.id !== "string" || entry.id.length === 0) continue;
    LIVE_SERVED.add(entry.id);
    for (const alias of Array.isArray(entry?.aliases) ? entry.aliases : []) {
      if (typeof alias === "string" && alias.length > 0) LIVE_SERVED.add(alias);
    }
    LIVE_SERVED.add(findAliasRoot(entry.id));
  }`,
);

h = replaceOnce(
  h,
  "persist served ids",
  `          discoveredModels: payload.filter((row) => row.discovered === true).map((row) => row.id),`,
  `          discoveredModels: payload.filter((row) => row.discovered === true).map((row) => row.id),
          servedModels: [...LIVE_SERVED],`,
);

h = replaceOnce(
  h,
  "configReply served",
  `      discoveredModels: Array.isArray(settings.discoveredModels) ? settings.discoveredModels : [],`,
  `      discoveredModels: Array.isArray(settings.discoveredModels) ? settings.discoveredModels : [],
      servedModels: Array.isArray(settings.servedModels) ? settings.servedModels : [],`,
);

h = replaceOnce(h, "build stamp", 'const BUILD = "0.1.0+vibe-code";', 'const BUILD = "0.1.1+vibe-code";');
writeText(HOST, h, host.crlf);

/* ---------- client ---------- */
const client = readText(CLIENT);
let c = client.text;
c = replaceOnce(
  c,
  "tier gating signal",
  `\t\t\t\ttierGated:
\t\t\t\t\tArray.isArray(state.discoveredModels) &&
\t\t\t\t\tstate.discoveredModels.length > 0 &&
\t\t\t\t\tstate.discoveredModels.indexOf(model.id) === -1,`,
  `\t\t\t\ttierGated:
\t\t\t\t\tArray.isArray(state.servedModels) &&
\t\t\t\t\tstate.servedModels.length > 0 &&
\t\t\t\t\tstate.servedModels.indexOf(model.id) === -1,`,
);
writeText(CLIENT, c, client.crlf);

/* ---------- version ---------- */
const pkg = readText(PKG);
writeText(PKG, replaceOnce(pkg.text, "version", '"version": "0.1.0"', '"version": "0.1.1"'), pkg.crlf);

console.log("served-set patch applied");
