/**
 * Headless test for the per-model price line.
 *
 * The client half is loaded the way the module loader loads it
 * (window.__ModuleLoader__.load -> factory(require)) and the model row is
 * rendered with a createElement stub; the host half is imported directly so the
 * catalogue and the row projection that feeds the settings page are checked
 * against Mistral's own model card.
 *
 * Run with any Node 20+:
 *   node scripts/test-model-pricing.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const CLIENT = path.join(__dirname, "..", "lib", "client.js");
const HOST = path.join(__dirname, "..", "lib", "index.js");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " - " + detail : ""));
}

/* --- load the client half ---------------------------------------------- */
const React = {
  createElement(type, props, ...children) {
    const merged = { ...(props || {}) };
    if (children.length > 0) merged.children = children.length === 1 ? children[0] : children;
    return { type, props: merged };
  },
  Component: class Component {
    constructor(props) {
      this.props = props;
    }
  },
};
const fakeWindow = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  __ModuleLoader__: { load(registration) { fakeWindow.__registration = registration; } },
};
global.window = fakeWindow;

const source = fs.readFileSync(CLIENT, "utf8");
new Function("require", source)((name) => {
  if (name === "react") return React;
  throw new Error("unexpected external: " + name);
});
const mod = fakeWindow.__registration.factory((name) => {
  if (name === "react") return React;
  throw new Error("unexpected external: " + name);
});

function text(tree) {
  if (tree === null || tree === undefined) return "";
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (typeof tree.type === "function") return text(tree.type(tree.props));
  return tree.props && tree.props.children !== undefined ? text(tree.props.children) : "";
}

/** The exact numbers on Mistral's model card for deepseek-v4-1-flash-1017. */
const CARD = { input: 0.3, cacheRead: 0.007, output: 1.2 };

check(
  "price line carries input, cached input and output",
  mod.priceLine({ cost: CARD }) === "$0.30 in · $0.007 cached · $1.20 out / 1M tokens",
  mod.priceLine({ cost: CARD }),
);
check(
  "cached input keeps its third decimal",
  mod.priceLine({ cost: CARD }).includes("$0.007"),
  mod.priceLine({ cost: CARD }),
);
check(
  "a model without a cached-input price still shows the other two",
  mod.priceLine({ cost: { input: 0.7, output: 2.1 } }) === "$0.70 in · $2.10 out / 1M tokens",
  mod.priceLine({ cost: { input: 0.7, output: 2.1 } }),
);
check("a model without prices shows no line", mod.priceLine({ id: "x" }) === "");
check("a free model reads as $0", mod.formatPrice(0) === "$0", mod.formatPrice(0));
check(
  "a discovered model row shows no price",
  !text(mod.ModelCell({ model: { id: "some-model", name: "Some model", inputModalities: ["text"] } })).includes("/ 1M"),
);

const pricedRow = text(
  mod.ModelCell({
    model: {
      id: "deepseek-v4-1-flash-1017",
      name: "DeepSeek V4.1 Flash 1017",
      inputModalities: ["text", "image"],
      contextWindow: 1048576,
      levels: ["off", "low", "high", "max"],
      cost: CARD,
    },
  }),
);
check("the model row paints the price line", pricedRow.includes("$0.30 in · $0.007 cached · $1.20 out / 1M tokens"), pricedRow);
check("the model row keeps its capability line", pricedRow.includes("text + image"), pricedRow);

/* --- load the host half ------------------------------------------------ */
async function main() {
  const host = await import(pathToFileURL(HOST).href);
  const entry = host.MODEL_CATALOGUE.find((row) => row.id === "deepseek-v4-1-flash-1017");
  check("the catalogue carries the model", entry !== undefined);
  check(
    "the catalogue carries the card prices",
    entry !== undefined && entry.cost.input === 0.3 && entry.cost.cacheRead === 0.007 && entry.cost.output === 1.2,
    entry && JSON.stringify(entry.cost),
  );
  const rows = host.catalogueRows({ ctx: undefined });
  const row = rows.find((candidate) => candidate.id === "deepseek-v4-1-flash-1017");
  check("the settings page row carries the price", row !== undefined && row.cost !== undefined, row && JSON.stringify(row.cost));
  check(
    "the settings page row keeps the card numbers",
    row !== undefined && row.cost.input === 0.3 && row.cost.cacheRead === 0.007 && row.cost.output === 1.2,
    row && JSON.stringify(row.cost),
  );
  const priced = host.MODEL_CATALOGUE.filter((candidate) => candidate.cost !== undefined).length;
  check(
    "every priced catalogue row projects its price",
    rows.filter((candidate) => candidate.cost !== undefined).length === priced,
    priced + " priced rows",
  );
  check(
    "every catalogue price is a finite number",
    host.MODEL_CATALOGUE.every(
      (candidate) =>
        candidate.cost === undefined ||
        Object.values(candidate.cost).every((value) => typeof value === "number" && Number.isFinite(value)),
    ),
  );

  /* --- the picker badge ------------------------------------------------ */
  check(
    "the picker badge is input/output per 1M",
    JSON.stringify(host.priceBadge({ input: 0.3, cacheRead: 0.007, output: 1.2 })) ===
      JSON.stringify({ text: "$0.3/$1.2", tone: "neutral" }),
    JSON.stringify(host.priceBadge({ input: 0.3, cacheRead: 0.007, output: 1.2 })),
  );
  check("a model without a price has no badge", host.priceBadge(undefined) === undefined);
  check(
    "badgeOf finds the catalogue price by id",
    JSON.stringify(host.badgeOf("deepseek-v4-1-flash-1017")) ===
      JSON.stringify({ badge: { text: "$0.3/$1.2", tone: "neutral" } }),
    JSON.stringify(host.badgeOf("deepseek-v4-1-flash-1017")),
  );
  check("badgeOf leaves an unknown id bare", JSON.stringify(host.badgeOf("no-such-model")) === "{}");

  /* --- the session cost fold ------------------------------------------- */
  const usage = (inputTokens, cacheReadTokens, outputTokens) => ({ inputTokens, cacheReadTokens, outputTokens });
  const message = (provider, model, tokens) => ({
    type: "assistant/message",
    data: { message: { source: { provider, model } }, usage: tokens },
  });
  const pricedSession = host.sessionCost({
    ownEvents: () => [
      message("mistral-vibe", "deepseek-v4-1-flash-1017", usage(1_000_000, 2_000_000, 1_000_000)),
      { type: "user/message", data: {} },
    ],
  });
  check(
    "session cost prices input, cached input and output",
    Math.abs(pricedSession.cost - (0.3 + 0.014 + 1.2)) < 1e-9,
    String(pricedSession.cost),
  );
  check("session cost counts priced tokens", pricedSession.pricedTokens === 4_000_000, String(pricedSession.pricedTokens));
  check("session cost keeps the token split", JSON.stringify(pricedSession.tokens) === JSON.stringify({ input: 1_000_000, output: 1_000_000, cacheRead: 2_000_000, cacheWrite: 0 }), JSON.stringify(pricedSession.tokens));
  check("session cost names the models used", JSON.stringify(pricedSession.models) === JSON.stringify(["deepseek-v4-1-flash-1017"]), JSON.stringify(pricedSession.models));

  const otherProvider = host.sessionCost({
    ownEvents: () => [
      message("mistral-vibe", "deepseek-v4-1-flash-1017", usage(1_000_000, 0, 0)),
      message("deepseek-official", "deepseek-v4-1-flash-1017", usage(5_000_000, 0, 5_000_000)),
    ],
  });
  check(
    "another provider's messages are not priced here",
    Math.abs(otherProvider.cost - 0.3) < 1e-9,
    String(otherProvider.cost),
  );

  const unpricedModel = host.sessionCost({
    ownEvents: () => [message("mistral-vibe", "mystery-model", usage(100, 0, 100))],
  });
  check("an unpriced model is counted, not guessed", unpricedModel.cost === 0 && unpricedModel.unpricedTokens === 200, JSON.stringify(unpricedModel));

  const noCachePrice = host.sessionCost({
    ownEvents: () => [message("mistral-vibe", "mistral-large-4", usage(1_000_000, 1_000_000, 0))],
  });
  check(
    "a model without a cached price bills cache reads at the input price",
    Math.abs(noCachePrice.cost - 1.4) < 1e-9,
    String(noCachePrice.cost),
  );
  check("an empty session costs nothing", host.sessionCost({ ownEvents: () => [] }).cost === 0);

  /* --- the request image cap ------------------------------------------- */
  const imagePart = () => ({ type: "image_url", image_url: "data:image/png;base64,AAAA" });
  const textPart = (text) => ({ type: "text", text });
  const countImages = (messages) =>
    messages.reduce(
      (total, message) =>
        total +
        (Array.isArray(message.content)
          ? message.content.filter((part) => part !== null && typeof part === "object" && part.type === "image_url").length
          : 0),
      0,
    );
  const shotMessages = (count) => {
    const messages = [];
    for (let index = 0; index < count; index += 1) {
      messages.push({ role: "user", content: [textPart("shot " + index), imagePart()] });
    }
    return messages;
  };

  const few = host.capRequestImages(shotMessages(3));
  check("only the newest image messages are kept by default", countImages(few) === 2, String(countImages(few)));
  check(
    "the oldest image message becomes a note",
    few[0].content[1].type === "text" && few[0].content[1].text.includes("image omitted"),
    JSON.stringify(few[0].content[1]),
  );
  check("the newest image messages keep their images", few[2].content[1].type === "image_url");
  check("every message keeps its shape", few.every((message) => message.content.length === 2));

  const underWindow = host.capRequestImages(shotMessages(2));
  check("a transcript inside the window is untouched", countImages(underWindow) === 2, String(countImages(underWindow)));

  const wide = host.capRequestImages(shotMessages(25), 25);
  check("a wide window still caps at twenty images", countImages(wide) === 20, String(countImages(wide)));
  check("the cap drops the oldest retained images", countImages(wide.slice(0, 5)) === 0, String(countImages(wide.slice(0, 5))));
  check("the newest images are the ones kept", countImages(wide.slice(5)) === 20, String(countImages(wide.slice(5))));

  const single = host.capRequestImages(
    [{ role: "user", content: [textPart("all at once"), ...Array.from({ length: 25 }, imagePart)] }],
    2,
  );
  check("one message with too many images is capped too", countImages(single) === 20, String(countImages(single)));
  check("the single message keeps its part count", single[0].content.length === 26, String(single[0].content.length));

  const toolImages = host.capRequestImages([
    { role: "user", content: [textPart("a"), imagePart()] },
    { role: "tool", tool_call_id: "c1", content: "ok" },
    { role: "user", content: [textPart("b"), imagePart()] },
  ]);
  check("the window counts every image-bearing message", countImages(toolImages) === 2, String(countImages(toolImages)));

  /* --- the default thinking level -------------------------------------- */
  const deepseek = host.reasoningMetadata(host.MODEL_CATALOGUE.find((model) => model.id === "deepseek-v4-1-flash-1017"));
  check("deepseek v4.1 flash thinks by default", deepseek !== undefined && deepseek.defaultEffort === "high", deepseek && deepseek.defaultEffort);
  check(
    "its levels are the full ladder",
    deepseek !== undefined && JSON.stringify(deepseek.efforts.map((effort) => effort.id)) === JSON.stringify(["off", "low", "high", "max"]),
    deepseek && JSON.stringify(deepseek.efforts.map((effort) => effort.id)),
  );
  const large = host.reasoningMetadata(host.MODEL_CATALOGUE.find((model) => model.id === "mistral-large-4"));
  check("a model without an off level keeps its lowest level", large.defaultEffort === "low", large.defaultEffort);
  const medium = host.reasoningMetadata(host.MODEL_CATALOGUE.find((model) => model.id === "mistral-medium-2604"));
  check("a model with only off and high defaults to high", medium.defaultEffort === "high", medium.defaultEffort);
  check("a model without levels has no reasoning control", host.reasoningMetadata({ id: "x" }) === undefined);

  /* --- the request image budget ---------------------------------------- */
  const target = host.imageRequestTargetFor({});
  check(
    "the default image target is 1024px / 768KB",
    target.width === 1024 && target.height === 1024 && target.maxBytes === 768 * 1024,
    JSON.stringify(target),
  );
  check(
    "the default is smaller than the harness default",
    target.width < 1568 && target.maxBytes < 4 * 1024 * 1024,
    JSON.stringify(target),
  );
  const configured = host.imageRequestTargetFor({ imageMaxEdge: 1280, imageMaxBytesKb: 1024 });
  check(
    "a configured target is honoured",
    configured.width === 1280 && configured.maxBytes === 1024 * 1024,
    JSON.stringify(configured),
  );
  const tooSmall = host.imageRequestTargetFor({ imageMaxEdge: 10, imageMaxBytesKb: 1 });
  check(
    "an out-of-range target falls back to the default",
    tooSmall.width === 1024 && tooSmall.maxBytes === 768 * 1024,
    JSON.stringify(tooSmall),
  );
  const tooLarge = host.imageRequestTargetFor({ imageMaxEdge: 99999, imageMaxBytesKb: 99999 });
  check(
    "an oversized target is capped",
    tooLarge.width === 4096 && tooLarge.maxBytes === 8192 * 1024,
    JSON.stringify(tooLarge),
  );

  const failedChecks = results.filter((result) => !result.ok);
  console.log("\n" + (results.length - failedChecks.length) + "/" + results.length + " checks passed");
  process.exit(failedChecks.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
