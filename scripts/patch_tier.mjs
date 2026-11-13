/** Tier badge: rows the live catalogue never reported get a "not in plan" mark. */
import { readFileSync, writeFileSync } from "node:fs";

const HOST = new URL("./lib/index.js", import.meta.url);
const CLIENT = new URL("./lib/client.js", import.meta.url);

/* --- host: remember which ids a live read actually reported ---------------- */
const rawHost = readFileSync(HOST, "utf8");
const crlf = rawHost.includes("\r\n");
let host = rawHost.split("\r\n").join("\n");
function hostReplace(label, from, to) {
  const count = host.split(from).length - 1;
  if (count !== 1) throw new Error(`host anchor "${label}": ${count} matches`);
  host = host.replace(from, to);
}

hostReplace(
  "configReply",
  `      disabledModels: settings.disabledModels,
      models: await curatedDiscovery(adapter),`,
  `      disabledModels: settings.disabledModels,
      discoveredModels: Array.isArray(settings.discoveredModels) ? settings.discoveredModels : [],
      models: await curatedDiscovery(adapter),`,
);
hostReplace(
  "persist discovered ids",
  "        await savePatch({ modelsJson: JSON.stringify(payload) });",
  `        await savePatch({
          modelsJson: JSON.stringify(payload),
          // The ids a live read reported: absent rows are the ones this key is
          // not served, which is how the picker marks tier-gated models.
          discoveredModels: payload.filter((row) => row.discovered === true).map((row) => row.id),
        });`,
);
writeFileSync(HOST, crlf ? host.split("\n").join("\r\n") : host);

/* --- client: render the mark ------------------------------------------------- */
const lines = readFileSync(CLIENT, "utf8").split("\n").map((line) => line.replace(/\r$/, ""));
function findLine(trimmed, label) {
  const at = lines.findIndex((line) => line.trim() === trimmed);
  if (at === -1) throw new Error(`client anchor not found: ${label}`);
  return at;
}
function indentOf(index) {
  return /^[\t ]*/.exec(lines[index])[0];
}

{
  const at = findLine("const model = props.model;", "model const");
  const indent = indentOf(at);
  lines.splice(
    at + 1,
    0,
    `${indent}const tierGated =`,
    `${indent}\tprops.tierGated === true`,
    `${indent}\t\t? h(`,
    `${indent}\t\t\t"span",`,
    `${indent}\t\t\t{`,
    `${indent}\t\t\t\tstyle: {`,
    `${indent}\t\t\t\t\t...monoStyle,`,
    `${indent}\t\t\t\t\tcolor: "var(--dsw-alias-state-warn-primary, #b7791f)",`,
    `${indent}\t\t\t\t\tborder: "1px solid var(--dsw-alias-state-warn-primary, #b7791f)",`,
    `${indent}\t\t\t\t\tborderRadius: 4,`,
    `${indent}\t\t\t\t\tpadding: "0 4px",`,
    `${indent}\t\t\t\t},`,
    `${indent}\t\t\t},`,
    `${indent}\t\t\t"not in plan",`,
    `${indent}\t\t  )`,
    `${indent}\t\t: null;`,
  );
}

{
  const at = findLine('h("span", { style: metaStyle }, modelMeta(model)),', "meta line");
  const indent = indentOf(at);
  lines.splice(at, 0, `${indent}tierGated,`);
}

{
  const at = findLine("h(ModelCell, { model }),", "ModelCell call");
  const indent = indentOf(at);
  lines.splice(
    at,
    1,
    `${indent}h(ModelCell, {`,
    `${indent}\tmodel,`,
    `${indent}\ttierGated:`,
    `${indent}\t\tArray.isArray(state.discoveredModels) &&`,
    `${indent}\t\tstate.discoveredModels.length > 0 &&`,
    `${indent}\t\tstate.discoveredModels.indexOf(model.id) === -1,`,
    `${indent}}),`,
  );
}

writeFileSync(CLIENT, lines.join("\n"));
console.log("patched host + client");
