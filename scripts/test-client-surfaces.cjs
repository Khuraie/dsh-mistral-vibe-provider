/**
 * Headless harness for the client half's two ambient surfaces.
 *
 * No browser is available, so the bundle is loaded the way the module loader
 * loads it (window.__ModuleLoader__.load -> factory(require)), `apply` is run
 * against a fake slot service, and each registered surface is rendered with a
 * minimal hook runtime to inspect the element tree it returns.
 *
 * Covers the sidebar quota card (`sidebar.footer.action`) and the session cost
 * line (`conversation.input.dock`).
 *
 * Run with any Node 20+:
 *   node scripts/test-client-surfaces.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const CLIENT = path.join(__dirname, "..", "lib", "client.js");
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " - " + detail : ""));
}

/* --- a minimal hook runtime ------------------------------------------- */
let hookStore = [];
let hookIndex = 0;
const effects = [];
let cleanups = [];
function runCleanups() {
  const pending = cleanups.splice(0, cleanups.length);
  for (const cleanup of pending) cleanup();
}
const React = {
  createElement(type, props, ...children) {
    const merged = { ...(props || {}) };
    if (children.length > 0) merged.children = children.length === 1 ? children[0] : children;
    return { type, props: merged };
  },
  useState(initial) {
    const i = hookIndex++;
    if (!(i in hookStore)) hookStore[i] = initial;
    return [
      hookStore[i],
      (next) => {
        hookStore[i] = typeof next === "function" ? next(hookStore[i]) : next;
      },
    ];
  },
  useRef(value) {
    const i = hookIndex++;
    if (!(i in hookStore)) hookStore[i] = { current: value };
    return hookStore[i];
  },
  useCallback(fn) {
    const i = hookIndex++;
    if (!(i in hookStore)) hookStore[i] = fn;
    return hookStore[i];
  },
  useEffect(fn, deps) {
    const i = hookIndex++;
    const previous = hookStore[i];
    // React semantics: re-run only when a dependency changed (or none given).
    const changed =
      previous === undefined ||
      deps === undefined ||
      previous.deps === undefined ||
      deps.length !== previous.deps.length ||
      deps.some((dep, index) => !Object.is(dep, previous.deps[index]));
    if (!changed) return;
    hookStore[i] = { deps };
    effects.push(fn);
  },
  Component: class Component {
    constructor(props) {
      this.props = props;
    }
  },
};

/* --- fake browser ------------------------------------------------------ */
let fetchPlan = [];
const fetchCalls = [];
global.fetch = async (url, init) => {
  fetchCalls.push({ url, init });
  const next = fetchPlan.length > 0 ? fetchPlan.shift() : { ok: true, payload: {} };
  if (next.throw) throw next.throw;
  return {
    ok: next.ok !== false,
    status: next.status || 200,
    async text() {
      return JSON.stringify(next.payload === undefined ? {} : next.payload);
    },
  };
};
const timers = [];
const clearedIntervals = [];
const listeners = { window: {}, document: {} };
const fakeWindow = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setInterval(callback, delay) {
    timers.push({ callback, delay });
    return timers.length;
  },
  clearInterval(handle) {
    clearedIntervals.push(handle);
  },
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle),
  addEventListener(name, handler) {
    (listeners.window[name] = listeners.window[name] || []).push(handler);
  },
  removeEventListener(name, handler) {
    listeners.window[name] = (listeners.window[name] || []).filter((entry) => entry !== handler);
  },
  dispatchEvent(event) {
    for (const handler of listeners.window[event.type] || []) handler(event);
    return true;
  },
  open() {},
  __ModuleLoader__: { load(registration) { fakeWindow.__registration = registration; } },
};
global.window = fakeWindow;
global.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type;
  }
};
global.document = {
  visibilityState: "visible",
  body: null,
  createElement: null,
  addEventListener(name, handler) {
    (listeners.document[name] = listeners.document[name] || []).push(handler);
  },
  removeEventListener(name, handler) {
    listeners.document[name] = (listeners.document[name] || []).filter((entry) => entry !== handler);
  },
};

/* --- a minimal DOM, for the run appended into the shipped pill --------- */
function fakeElement(tag) {
  const node = {
    tagName: tag,
    children: [],
    attributes: {},
    style: {},
    textContent: "",
    title: "",
    isConnected: true,
    parentNode: null,
    appendChild(child) {
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    remove() {
      const parent = node.parentNode;
      if (parent !== null) {
        const index = parent.children.indexOf(node);
        if (index >= 0) parent.children.splice(index, 1);
        node.parentNode = null;
      }
      node.isConnected = false;
    },
    setAttribute(name, value) {
      node.attributes[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(node.attributes, name) ? node.attributes[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(node.attributes, name);
    },
    removeAttribute(name) {
      delete node.attributes[name];
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  return node;
}
global.document.body = fakeElement("body");
global.document.createElement = fakeElement;
global.MutationObserver = class MutationObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  disconnect() {}
};

/* --- load the bundle --------------------------------------------------- */
const source = fs.readFileSync(CLIENT, "utf8");
new Function("require", source)((name) => {
  if (name === "react") return React;
  throw new Error("unexpected external: " + name);
});
const registration = fakeWindow.__registration;
check("bundle registers a factory", registration && typeof registration.factory === "function", registration && registration.id);
const mod = registration.factory((name) => {
  if (name === "react") return React;
  throw new Error("unexpected external: " + name);
});
check("exports apply/inject/name", typeof mod.apply === "function" && Array.isArray(mod.inject) && typeof mod.name === "string", mod.name);

/* --- run apply against a fake slot service ----------------------------- */
const registered = [];
const injected = [];
const fakeCtx = {
  slots: {
    inject(name, callback) {
      injected.push(name);
      callback();
      return () => {};
    },
    register(reg, component) {
      registered.push({ reg, component });
      return () => {};
    },
  },
};
mod.apply(fakeCtx);
const names = registered.map((entry) => entry.reg.name);
check("registers settings.section", names.includes("settings.section"));
check("registers settings.section.icon", names.includes("settings.section.icon"));
const footer = registered.find((entry) => entry.reg.name === "sidebar.footer.action");
check("registers sidebar.footer.action", footer !== undefined, footer && JSON.stringify(footer.reg));
check("footer id is mistral-vibe-quota", footer && footer.reg.id === "mistral-vibe-quota");
check("footer order is 10", footer && footer.reg.order === 10);
check("footer label is a thunk", footer && typeof footer.reg.label === "function" && footer.reg.label() === "Mistral Vibe quota");
check("footer component is a function", footer && typeof footer.component === "function");

/* --- render the footer component --------------------------------------- */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
let currentCard = null;
let currentProps = null;
async function render(component, props) {
  // Unmount the previous mount first: the mini runtime re-runs effects on
  // every render, so a leftover effect would stack listeners.
  runCleanups();
  // The registration wraps the card in the section error boundary; unwrap it
  // so the hook runtime sees the card itself.
  const outer = component(props);
  const inner = outer.props.children;
  currentCard = inner.type;
  currentProps = inner.props;
  hookStore = [];
  effects.length = 0;
  cleanups = [];
  hookIndex = 0;
  let tree = currentCard(currentProps);
  for (let pass = 0; pass < 4; pass++) {
    await settle();
    if (effects.length === 0) break;
    const pending = effects.splice(0, effects.length);
    for (const effect of pending) {
      const cleanup = effect();
      if (typeof cleanup === "function") cleanups.push(cleanup);
    }
    await settle();
    hookIndex = 0;
    tree = currentCard(currentProps);
  }
  return tree;
}
async function rerender() {
  await settle();
  hookIndex = 0;
  let tree = currentCard(currentProps);
  for (let pass = 0; pass < 3 && effects.length > 0; pass++) {
    const pending = effects.splice(0, effects.length);
    for (const effect of pending) {
      const cleanup = effect();
      if (typeof cleanup === "function") cleanups.push(cleanup);
    }
    await settle();
    hookIndex = 0;
    tree = currentCard(currentProps);
  }
  return tree;
}
function text(tree) {
  if (tree === null || tree === undefined) return "";
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  // Presentational children (QuotaMeter, MistralVibeMark) are hook-free, so
  // expanding them here is safe and shows what the browser would paint.
  if (typeof tree.type === "function") return text(tree.type(tree.props));
  const out = [];
  if (tree.props && tree.props.title) out.push(String(tree.props.title));
  if (tree.props && tree.props.children !== undefined) out.push(text(tree.props.children));
  return out.join(" ");
}
/** Only what is painted: no tooltip text, no aria-label. */
function visibleText(tree) {
  if (tree === null || tree === undefined) return "";
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(visibleText).join(" ");
  if (typeof tree.type === "function") return visibleText(tree.type(tree.props));
  return tree.props && tree.props.children !== undefined ? visibleText(tree.props.children) : "";
}
function find(tree, predicate) {
  if (tree === null || tree === undefined) return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const hit = find(child, predicate);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }
  if (typeof tree !== "object") return undefined;
  if (typeof tree.type === "function") return find(tree.type(tree.props), predicate);
  if (predicate(tree)) return tree;
  return tree.props && tree.props.children !== undefined ? find(tree.props.children, predicate) : undefined;
}
function hasTag(tree, tag) {
  return find(tree, (node) => node.type === tag) !== undefined;
}

const budget = {
  hasKey: true,
  plan: "Pro",
  vibe: { percent: 62.3, used: 6.23, total: 10, currency: "USD", resetAt: "2026-12-01T00:00:00Z" },
  apiMeter: { percent: 8.1, used: 0.81, total: 10, currency: "USD", resetAt: "2026-12-01T00:00:00Z" },
};

async function main() {
  fetchPlan = [{ ok: true, payload: budget }];
  const wideTree = await render(footer.component, { wide: true });
  const wideText = text(wideTree);
  check("fetches the budget route", fetchCalls.length > 0 && fetchCalls[0].url === "/mistral-vibe/budget", fetchCalls[0] && fetchCalls[0].url);
  check("wide card names the plugin", wideText.includes("Mistral Vibe"));
  check("wide card shows the plan", wideText.includes("Pro"));
  check("wide card shows the Vibe Code label", wideText.includes("Vibe Code"));
  check("wide card shows the Studio label", wideText.includes("Studio / API"));
  check("wide card shows the Vibe percentage", wideText.includes("62.3%"));
  check("wide card shows the Studio percentage", wideText.includes("8.1%"));
  const wideVisible = visibleText(wideTree);
  check("wide card shows the Vibe dollars", wideVisible.includes("$6.23 of $10.00"), wideVisible);
  check("wide card shows the Studio dollars", wideVisible.includes("$0.81 of $10.00"), wideVisible);
  check("tooltip carries the money numbers", wideText.includes("$6.23 of $10.00"), wideText.slice(0, 240));
  check("tooltip carries the reset date", wideText.includes("resets 2026-12-01"));
  check("tooltip carries the read time", /read \d/.test(wideText), wideText.slice(0, 240));
  check("tooltip says how to refresh", wideText.includes("Click to refresh"));
  check("card is a keyboard-reachable control", wideTree.props.role === "button" && wideTree.props.tabIndex === 0);
  check(
    "accessible name carries the values",
    String(wideTree.props["aria-label"]).includes("Vibe Code 62.3%") &&
      String(wideTree.props["aria-label"]).includes("Studio / API 8.1%"),
    String(wideTree.props["aria-label"]),
  );
  check("card exposes busy state", wideTree.props["aria-busy"] === false);
  check("card schedules a refresh interval", timers.length > 0 && timers[0].delay === 600000, timers[0] && String(timers[0].delay));
  check("card listens for budget changes", (listeners.window["mistral-vibe:budget"] || []).length === 1);
  check("card listens for visibility changes", (listeners.document.visibilitychange || []).length === 1);

  /* a failed refresh after a good read must stay visible */
  fetchPlan = [{ ok: false, status: 500, payload: { error: "boom" } }];
  wideTree.props.onClick();
  const staleTree = await rerender();
  const staleText = text(staleTree);
  check("stale card keeps the old numbers", staleText.includes("62.3%"));
  check("stale card reports the failed refresh", staleText.includes("Refresh failed: boom"), staleText.slice(-160));
  check("stale card offers a retry", staleText.includes("click to retry"));
  check(
    "stale card shows a warning dot",
    find(staleTree, (node) => node.props && node.props.title === "boom" && node.props.style && node.props.style.background !== undefined) !== undefined,
  );

  /* upstream billing errors arrive as a 200 with the meters missing */
  fetchPlan = [{ ok: true, payload: { hasKey: true, subscriptionError: "HTTP 401", budgetError: "HTTP 401" } }];
  const billingTree = await render(footer.component, { wide: true });
  const billingText = text(billingTree);
  check("billing error is reported", billingText.includes("Refresh failed: HTTP 401"), billingText.slice(-160));
  check("billing error marks the meters unavailable", billingText.includes("unavailable"), billingText.slice(0, 240));
  check("billing error dashes the percentages", billingText.includes("—"));

  /* rail */
  fetchPlan = [{ ok: true, payload: budget }];
  const railTree = await render(footer.component, { wide: false });
  check("rail card is 36px square", railTree.props.style.width === 36 && railTree.props.style.height === 36);
  check("rail card keeps the tooltip numbers", String(railTree.props.title).includes("62.30%"), String(railTree.props.title).slice(0, 120));
  check("rail card draws the mark", hasTag(railTree, "svg"));
  check("rail card exposes the values", String(railTree.props["aria-label"]).includes("Vibe Code 62.3%"));

  /* signed out */
  fetchPlan = [{ ok: true, payload: { hasKey: false } }];
  const signedOutTree = await render(footer.component, { wide: true });
  const signedOut = text(signedOutTree);
  check("signed-out card says not signed in", signedOut.includes("not signed in"), signedOut.slice(0, 140));
  check("signed-out card names the next step", signedOut.includes("sign in from Settings"));
  check("signed-out card dims the mark", find(signedOutTree, (node) => node.type === "svg" && node.props.style && node.props.style.opacity === 0.72) !== undefined);

  /* first-load failure */
  fetchPlan = [{ ok: false, status: 500, payload: { error: "boom" } }];
  const failedTree = await render(footer.component, { wide: true });
  const failed = text(failedTree);
  check("failure card reports the error", failed.includes("boom"), failed.slice(0, 140));
  check("failure card offers a retry", failed.includes("click to retry"));

  /* the settings page announces a budget change */
  const before = fetchCalls.length;
  fetchPlan = [{ ok: true, payload: budget }];
  for (const handler of listeners.window["mistral-vibe:budget"] || []) handler();
  await settle();
  check("budget event triggers a read", fetchCalls.length === before + 1, String(fetchCalls.length - before));

  /* unmount releases the interval and both listeners */
  const intervalCount = clearedIntervals.length;
  runCleanups();
  check("unmount clears the interval", clearedIntervals.length === intervalCount + 1);
  check("unmount removes the budget listener", (listeners.window["mistral-vibe:budget"] || []).length === 0);
  check("unmount removes the visibility listener", (listeners.document.visibilitychange || []).length === 0);

  /* --- the session cost run -------------------------------------------- */
  const dock = registered.find((entry) => entry.reg.name === "conversation.composer.dock");
  check("registers conversation.composer.dock", dock !== undefined, dock && JSON.stringify(dock.reg));
  check("cost run id is mistral-vibe-cost", dock && dock.reg.id === "mistral-vibe-cost");
  check("cost run sits after the shipped usage pill (order 2)", dock && dock.reg.order === 2);

  const costPayload = {
    ok: true,
    currency: "USD",
    cost: 1.514,
    pricedTokens: 4_000_000,
    unpricedTokens: 0,
    tokens: { input: 1_000_000, cacheRead: 2_000_000, output: 1_000_000, cacheWrite: 0 },
    models: ["deepseek-v4-1-flash-1017"],
  };
  // The shipped usage pill reads this projection; the run re-reads when it moves.
  let usageSnapshot = { uncachedInputTokens: 1_000_000, cacheReadTokens: 2_000_000, outputTokens: 1_000_000, cacheWriteTokens: 0 };
  const useProjection = (key) => (key === "tokenUsage" ? usageSnapshot : undefined);
  const costProps = { sessionId: "session-1", useProjection };

  fetchPlan = [{ ok: true, payload: costPayload }];
  const costBefore = fetchCalls.length;
  const costTree = await render(dock.component, costProps);
  const costCall = fetchCalls[costBefore];
  check(
    "cost run asks for this session",
    costCall !== undefined && costCall.url === "/mistral-vibe/session-cost?sessionId=session-1",
    costCall && costCall.url,
  );
  check(
    "the entry renders only a hidden marker",
    costTree !== null &&
      costTree.props.style.display === "none" &&
      costTree.props["data-mistral-vibe-cost-anchor"] === "" &&
      costTree.props.children === undefined,
    JSON.stringify(costTree && costTree.props),
  );

  /* the usage projection drives the re-read */
  const readsBefore = fetchCalls.length;
  usageSnapshot = { uncachedInputTokens: 2_000_000, cacheReadTokens: 2_000_000, outputTokens: 1_000_000, cacheWriteTokens: 0 };
  fetchPlan = [{ ok: true, payload: costPayload }];
  await rerender();
  check("a moved usage projection re-reads the cost", fetchCalls.length === readsBefore + 1, String(fetchCalls.length - readsBefore));

  /* a session with no priced usage renders nothing */
  fetchPlan = [{ ok: true, payload: { ok: true, cost: 0, tokens: {}, unpricedTokens: 0 } }];
  const emptyTree = await render(dock.component, { sessionId: "session-2", useProjection });
  check("a session with no cost renders nothing", emptyTree === null, String(emptyTree));

  /* an unreadable session renders nothing rather than an error */
  fetchPlan = [{ ok: false, status: 500, payload: { error: "boom" } }];
  const brokenTree = await render(dock.component, { sessionId: "session-3", useProjection });
  check("an unreadable session renders nothing", brokenTree === null, String(brokenTree));

  /* no polling: an idle session issues no further reads */
  fetchPlan = [{ ok: true, payload: costPayload }];
  await render(dock.component, { sessionId: "session-4", useProjection });
  const idleReads = fetchCalls.length;
  await settle();
  await settle();
  check("the cost run does not poll", fetchCalls.length === idleReads, String(fetchCalls.length - idleReads));

  /* --- the run appends into the shipped pill --------------------------- */
  const pill = fakeElement("button");
  const outlet = fakeElement("div");
  outlet.querySelectorAll = (selector) => (selector === 'button[aria-haspopup="dialog"]' ? [pill] : []);
  const doc = { body: fakeElement("body"), createElement: fakeElement };
  const run = new mod.SessionCostRun(doc, () => outlet);
  run.start();
  run.sync(
    "≈$1.51",
    "Mistral Vibe · this session at list prices\ninput 1.0M · cached 2.0M · output 1.0M",
  );
  check("the run appends one node into the shipped pill", pill.children.length === 1, String(pill.children.length));
  const runRoot = pill.children[0];
  check("the run marks itself as this plugin's", runRoot.hasAttribute("data-mistral-vibe-session-cost"));
  check("the run starts with the shipped separator", runRoot.children[0].textContent === "·", runRoot.children[0].textContent);
  check("the run shows the amount with no glyph", runRoot.children[1].textContent === "≈$1.51", runRoot.children[1].textContent);
  check(
    "the run describes itself for assistive tech",
    pill.getAttribute("aria-describedby") === "dsh-mistral-vibe-session-cost",
    String(pill.getAttribute("aria-describedby")),
  );
  check("the run carries the breakdown as a tooltip", runRoot.title.includes("input 1.0M"), runRoot.title.slice(0, 80));

  run.sync("≈$2.00", "changed");
  check(
    "a changed amount rewrites in place",
    pill.children.length === 1 && runRoot.children[1].textContent === "≈$2.00",
    String(pill.children.length),
  );
  run.sync(undefined, "");
  check("an absent amount removes the run", pill.children.length === 0, String(pill.children.length));
  check("an absent amount releases the description", pill.getAttribute("aria-describedby") === null);
  run.dispose();

  /* a composer without a shipped pill gets nothing appended anywhere */
  const orphan = fakeElement("div");
  orphan.querySelectorAll = () => [];
  const orphanRun = new mod.SessionCostRun(doc, () => orphan);
  orphanRun.start();
  orphanRun.sync("≈$1.51", "");
  check("a missing pill appends nothing", orphan.children.length === 0);
  orphanRun.dispose();

  check("formatCost floors a sub-cent cost", mod.formatCost(0.004) === "<$0.01", mod.formatCost(0.004));
  check("formatCost keeps two decimals", mod.formatCost(1.514) === "$1.51", mod.formatCost(1.514));

  const failedChecks = results.filter((entry) => !entry.ok);
  console.log("\n" + (results.length - failedChecks.length) + "/" + results.length + " checks passed");
  process.exit(failedChecks.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
