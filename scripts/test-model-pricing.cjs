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

  /* --- the request image budget (harness offload protocol) -------------- */
  const imageBlock = (bytes, offloaded) => ({
    type: "image",
    attachment: { attachmentId: "sha256:" + "a".repeat(64), bytes, name: "shot.png" },
    ...(offloaded === true ? { offloaded: true } : {}),
  });
  const imageMessages = (count, bytes = 1000, offloaded = false) => [
    { role: "user", content: Array.from({ length: count }, () => imageBlock(bytes, offloaded)) },
  ];
  const versionBytes = (block) => block.attachment.bytes;
  const budget = host.IMAGE_REQUEST_BUDGET;

  check(
    "a history inside the budget needs no offload",
    host.requiredImageOffload(imageMessages(20), budget, versionBytes) === 0,
    String(host.requiredImageOffload(imageMessages(20), budget, versionBytes)),
  );
  check(
    "one image over the limit offloads the whole window",
    host.requiredImageOffload(imageMessages(21), budget, versionBytes) === 20,
    String(host.requiredImageOffload(imageMessages(21), budget, versionBytes)),
  );
  check(
    "two windows over the limit offload two windows",
    host.requiredImageOffload(imageMessages(41), budget, versionBytes) === 40,
    String(host.requiredImageOffload(imageMessages(41), budget, versionBytes)),
  );
  check(
    "images the harness already offloaded do not count",
    host.requiredImageOffload(imageMessages(25, 1000, true), budget, versionBytes) === 0,
    String(host.requiredImageOffload(imageMessages(25, 1000, true), budget, versionBytes)),
  );

  const projected = host.projectOffloadedMessages([
    { role: "user", content: [imageBlock(1000, true), { type: "text", text: "after" }] },
    { role: "user", content: [imageBlock(1000, false)] },
  ]);
  check(
    "an offloaded image becomes a placeholder",
    projected[0].content[0].type === "text" && projected[0].content[0].text.includes("image omitted"),
    JSON.stringify(projected[0].content[0]),
  );
  check(
    "the placeholder names the attachment",
    projected[0].content[0].text.includes("shot.png") && projected[0].content[0].text.includes("sha256:"),
    projected[0].content[0].text,
  );
  check("a retained image is untouched", projected[1].content[0].type === "image");
  check("a history with nothing offloaded is returned as-is", host.projectOffloadedMessages([{ role: "user", content: [imageBlock(1, false)] }])[0].content[0].type === "image");
  check(
    "the placeholder is stable for the same reference",
    host.offloadedImagePlaceholder({ attachmentId: "sha256:x", name: "a.png" }) ===
      host.offloadedImagePlaceholder({ attachmentId: "sha256:x", name: "a.png" }),
  );

  /* the adapter asks the harness to offload instead of dropping silently */
  const offloadAdapter = new host.MistralVibeAdapter(() => ({}));
  offloadAdapter.apiKey = async () => "test-key";
  let offloadFailure;
  try {
    for await (const _chunk of offloadAdapter.stream({
      provider: "mistral-vibe",
      model: "deepseek-v4-1-flash-1017",
      messages: imageMessages(21),
    })) {
      // The stream must not start: the gate throws before any I/O.
    }
  } catch (error) {
    offloadFailure = error;
  }
  check(
    "an over-budget history raises IMAGE_OFFLOAD_REQUIRED",
    offloadFailure !== undefined && offloadFailure.code === "IMAGE_OFFLOAD_REQUIRED",
    offloadFailure && String(offloadFailure.code),
  );
  check(
    "the failure carries the offload count",
    offloadFailure !== undefined && offloadFailure.failure !== undefined && offloadFailure.failure.offloadImages === 20,
    offloadFailure && JSON.stringify(offloadFailure.failure),
  );

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

  /* --- the image vision-token estimate --------------------------------- */
  check(
    "a downscaled screenshot costs about a thousand tokens",
    host.imageVisionTokens(1245, 932, 1024) === 1036,
    String(host.imageVisionTokens(1245, 932, 1024)),
  );
  check(
    "a small image is not enlarged",
    host.imageVisionTokens(287, 812, 1024) === 11 * 29,
    String(host.imageVisionTokens(287, 812, 1024)),
  );
  check(
    "a square image at the edge costs 37x37 patches",
    host.imageVisionTokens(4000, 4000, 1024) === 1369,
    String(host.imageVisionTokens(4000, 4000, 1024)),
  );
  check(
    "the estimate is capped",
    host.imageVisionTokens(100000, 100000, 4096) === 1600,
    String(host.imageVisionTokens(100000, 100000, 4096)),
  );
  check(
    "a broken image costs nothing",
    host.imageVisionTokens(0, 0) === 0 && host.imageVisionTokens(undefined, 5) === 0,
  );

  const adapter = new host.MistralVibeAdapter(() => ({ imageMaxEdge: 1024 }));
  const pricing = adapter.imageRequestPricing("mistral-vibe", "deepseek-v4-1-flash-1017");
  check("the route prices request images", pricing !== undefined && typeof pricing.priceImages === "function");
  const pricedImages = pricing.priceImages([
    { attachment: { width: 1245, height: 932 } },
    { attachment: { width: 287, height: 812 } },
  ]);
  check(
    "one price per image, sized from the sent dimensions",
    pricedImages.length === 2 && pricedImages[0].visualTokens === 1036 && pricedImages[1].visualTokens === 319,
    JSON.stringify(pricedImages),
  );
  check("no model-visible image text is claimed", pricedImages.every((entry) => entry.text === ""));

  const failedChecks = results.filter((result) => !result.ok);
  console.log("\n" + (results.length - failedChecks.length) + "/" + results.length + " checks passed");
  process.exit(failedChecks.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

