/**
 * One-shot, idempotent patch: turn the vendored adapter into our bundle.
 *
 * Adds the account plumbing the original settings page never had —
 * PKCE browser sign-in (console flow), the Vibe/API budget meters, and the
 * routes the page calls. Every anchor is asserted so a silent miss fails loudly.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("./lib/index.js", import.meta.url);
let source = readFileSync(FILE, "utf8");

const applied = [];
function replaceOnce(label, from, to) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`anchor "${label}" matched ${count} times, expected 1`);
  source = source.replace(from, to);
  applied.push(label);
}

/* 1. crypto helper for the PKCE pair. */
replaceOnce(
  "imports",
  'import { createHash } from "node:crypto";',
  'import { createHash, randomBytes } from "node:crypto";',
);

/* 2. fixed origins and paths. */
replaceOnce(
  "constants",
  'const ACCESS_TOKEN_ENV = "MISTRAL_VIBE_ACCESS_TOKEN";',
  `const ACCESS_TOKEN_ENV = "MISTRAL_VIBE_ACCESS_TOKEN";

// Mistral account surface. The console owns the sign-in process (PKCE S256) and
// mints a Vibe Code API key; the API base answers the two billing meters.
const CONSOLE_BASE = "https://console.mistral.ai";
const SIGN_IN_CREATE_URL = \`\${CONSOLE_BASE}/api/vibe/sign-in\`;
const SIGN_IN_PATH = "/api/vibe/sign-in";
const SIGN_IN_ATTEMPT_TTL_MS = 5 * 60 * 1000;
const BILLING_SUBSCRIPTION_PATH = "billing/subscription";
const BILLING_BUDGET_PATH = "billing/budget";
/** process_id -> { verifier, pollUrl, expiresAt }; in memory only, never persisted. */
const SIGN_IN_ATTEMPTS = new Map();`,
);

/* 3. the account helpers, module level so the routes stay thin. */
replaceOnce(
  "helpers",
  "export function apply(ctx, config) {",
  `/* -------------------------------------------------------------------------- *
 * Mistral account plumbing: PKCE browser sign-in and the billing meters.
 *
 * The console flow mints an ordinary Vibe Code API key, which is exactly the
 * credential the adapter already sends, so the page can sign in and store the
 * key without the user copying anything. The billing reads answer on the API
 * base the row already points at and expose the Vibe Code allowance and the
 * Studio/API allowance separately — that split is what the card shows.
 * -------------------------------------------------------------------------- */

function pkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** GET/POST one JSON document against a fixed HTTPS origin, with a hard timeout. */
async function fetchJsonUrl(url, init = {}, timeoutMs = 15000) {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json", "user-agent": ATTRIBUTION_UA, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let payload;
  try {
    payload = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text.slice(0, 200) };
  }
  return { status: response.status, ok: response.ok, payload };
}

/**
 * A console URL the page may open, or undefined.
 *
 * The page is handed this string and opens it; pinning the origin here keeps a
 * compromised or surprising sign-in response from steering the browser
 * anywhere but console.mistral.ai.
 */
function safeConsoleUrl(value) {
  if (typeof value !== "string" || value.length === 0) return undefined;
  try {
    const url = new URL(value);
    if (url.origin !== CONSOLE_BASE || url.username !== "" || url.password !== "") return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** Drop attempts the user abandoned, so the map cannot grow without bound. */
function pruneSignInAttempts(now = Date.now()) {
  for (const [processId, attempt] of SIGN_IN_ATTEMPTS) {
    if (attempt.expiresAt <= now) SIGN_IN_ATTEMPTS.delete(processId);
  }
}

/** Percentage -> the two numbers a meter needs, without inventing precision. */
function meterOf(budget) {
  if (budget === null || typeof budget !== "object") return undefined;
  const percent = typeof budget.usage_percentage === "number" ? budget.usage_percentage : undefined;
  const total = typeof budget.initial_budget === "number" ? budget.initial_budget : undefined;
  return {
    percent,
    total,
    used: percent === undefined || total === undefined ? undefined : (percent / 100) * total,
    currency: typeof budget.currency === "string" ? budget.currency : undefined,
    resetAt: typeof budget.reset_at === "string" ? budget.reset_at : undefined,
    paygEnabled: budget.payg_enabled === true,
  };
}

export function apply(ctx, config) {`,
);

/* 4. the three routes' handlers, next to the existing ones. */
replaceOnce(
  "handlers",
  "  const route = (handler) => async (request, response) => {",
  `  /* --- account meters and browser sign-in ------------------------------- */

  const handleBudget = async (request, response) => {
    const access = await authorizeRequest(request, adapter.settings(), await accessTokenOf());
    if (!access.ok) {
      sendJson(response, access.status, access.body);
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method not allowed" });
      return;
    }
    const settings = adapter.settings();
    let key;
    try {
      key = await adapter.apiKey();
    } catch (error) {
      // No key yet is a normal state for the page, not a failure to report.
      const code = error !== null && typeof error === "object" ? error.code : undefined;
      if (code !== "MISSING_CREDENTIAL") throw error;
      key = undefined;
    }
    if (key === undefined) {
      sendJson(response, 200, { hasKey: false, at: Date.now() });
      return;
    }
    const base = String(settings.baseURL ?? DEFAULT_BASE_URL).replace(/\\/+$/, "");
    const read = async (path) => {
      try {
        const answer = await fetchJsonUrl(\`\${base}/\${path}\`, {
          headers: { authorization: \`Bearer \${key}\` },
        });
        if (answer.ok) return answer.payload;
        return { error: \`HTTP \${answer.status}\` };
      } catch (error) {
        return { error: shortError(error) };
      }
    };
    const [subscription, budget] = await Promise.all([
      read(BILLING_SUBSCRIPTION_PATH),
      read(BILLING_BUDGET_PATH),
    ]);
    sendJson(response, 200, {
      hasKey: true,
      at: Date.now(),
      plan: typeof subscription?.plan_name === "string" ? subscription.plan_name : undefined,
      payg: subscription?.payg_enabled === true,
      vibePayg: subscription?.vibe_payg_enabled === true,
      vibe: meterOf(budget?.vibe_budget),
      apiMeter: meterOf(budget?.api_budget),
      subscriptionError: subscription?.error,
      budgetError: budget?.error,
    });
  };

  const handleSignInStart = async (request, response) => {
    const access = await authorizeRequest(request, adapter.settings(), await accessTokenOf());
    if (!access.ok) {
      sendJson(response, access.status, access.body);
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method not allowed" });
      return;
    }
    const { verifier, challenge } = pkcePair();
    const created = await fetchJsonUrl(SIGN_IN_CREATE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code_challenge: challenge, code_challenge_method: "S256" }),
    });
    if (!created.ok) {
      sendJson(response, 502, {
        error: \`Mistral sign-in could not start (HTTP \${created.status})\`,
      });
      return;
    }
    const processId = created.payload?.process_id;
    const signInUrl = safeConsoleUrl(created.payload?.sign_in_url);
    const pollUrl = safeConsoleUrl(created.payload?.poll_url);
    const remoteExpiry = Date.parse(typeof created.payload?.expires_at === "string" ? created.payload.expires_at : "");
    if (
      typeof processId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(processId) ||
      signInUrl === undefined ||
      pollUrl === undefined ||
      !Number.isFinite(remoteExpiry)
    ) {
      sendJson(response, 502, { error: "Mistral sign-in returned an unexpected response" });
      return;
    }
    pruneSignInAttempts();
    SIGN_IN_ATTEMPTS.set(processId, {
      verifier,
      pollUrl,
      expiresAt: Math.min(remoteExpiry, Date.now() + SIGN_IN_ATTEMPT_TTL_MS),
    });
    sendJson(response, 200, { processId, signInUrl, expiresAt: remoteExpiry });
  };

  const handleSignInPoll = async (request, response) => {
    const access = await authorizeRequest(request, adapter.settings(), await accessTokenOf());
    if (!access.ok) {
      sendJson(response, access.status, access.body);
      return;
    }
    const url = new URL(typeof request.url === "string" ? request.url : "/", "http://127.0.0.1");
    const processId = url.searchParams.get("processId") ?? "";
    const attempt = SIGN_IN_ATTEMPTS.get(processId);
    if (attempt === undefined) {
      sendJson(response, 404, { status: "unknown", error: "no sign-in attempt for that id" });
      return;
    }
    if (Date.now() > attempt.expiresAt) {
      SIGN_IN_ATTEMPTS.delete(processId);
      sendJson(response, 200, { status: "expired" });
      return;
    }
    const polled = await fetchJsonUrl(attempt.pollUrl);
    if (!polled.ok) {
      // A transient poll failure is not the user's problem; keep waiting.
      sendJson(response, 502, { status: "pending", error: \`HTTP \${polled.status}\` });
      return;
    }
    const status = polled.payload?.status;
    if (status === "pending") {
      sendJson(response, 200, { status: "pending" });
      return;
    }
    if (status !== "completed") {
      SIGN_IN_ATTEMPTS.delete(processId);
      sendJson(response, 200, {
        status: status === "expired" ? "expired" : status === "denied" ? "denied" : "failed",
        error: typeof polled.payload?.message === "string" ? polled.payload.message : undefined,
      });
      return;
    }
    const exchangeToken = polled.payload?.exchange_token;
    if (typeof exchangeToken !== "string" || exchangeToken.length === 0) {
      SIGN_IN_ATTEMPTS.delete(processId);
      sendJson(response, 502, { status: "failed", error: "Mistral sign-in completed without an exchange token" });
      return;
    }
    const exchanged = await fetchJsonUrl(\`\${SIGN_IN_CREATE_URL}/\${processId}/exchange\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ exchange_token: exchangeToken, code_verifier: attempt.verifier }),
    });
    SIGN_IN_ATTEMPTS.delete(processId);
    const key = typeof exchanged.payload?.api_key === "string" ? exchanged.payload.api_key.trim() : "";
    if (!exchanged.ok || key.length === 0 || !LEGAL_KEY.test(key)) {
      sendJson(response, 502, { status: "failed", error: \`Mistral key exchange failed (HTTP \${exchanged.status})\` });
      return;
    }
    const ref = adapter.settings().apiKeyEnv || DEFAULT_API_KEY_ENV;
    const stored = await storeSecret(ref, key);
    if (!stored) await savePatch({ apiKey: key });
    try {
      ctx.logger?.("@mars-sea/dsh-mistral-vibe-provider")?.info?.("browser sign-in stored a Vibe Code key");
    } catch {
      // Logging is best effort.
    }
    sendJson(response, 200, { status: "done", hasKey: true, stored });
  };

  const route = (handler) => async (request, response) => {`,
);

/* 5. register the new routes beside the existing two. */
replaceOnce(
  "routes",
  '            webServer.register({ kind: "exact", path: "/mistral-vibe/discover", handler: route(handleDiscover) }),',
  `            webServer.register({ kind: "exact", path: "/mistral-vibe/discover", handler: route(handleDiscover) }),
            webServer.register({ kind: "exact", path: "/mistral-vibe/budget", handler: route(handleBudget) }),
            webServer.register({ kind: "exact", path: "/mistral-vibe/sign-in", handler: route(handleSignInStart) }),
            webServer.register({
              kind: "exact",
              path: "/mistral-vibe/sign-in/status",
              handler: route(handleSignInPoll),
            }),`,
);

/* 6. identity: build stamp, exported module name, logger labels. */
replaceOnce("build", 'const BUILD = "1.1.1+6ead0d1b";', 'const BUILD = "0.1.0+vibe-code";');
replaceOnce(
  "name",
  'export const name = "dsh-mistral-vibe";export const inject = ["llm"];',
  'export const name = "@mars-sea/dsh-mistral-vibe-provider";\nexport const inject = ["llm"];',
);
source = source.split('ctx.logger?.("dsh-mistral-vibe")').join('ctx.logger?.("@mars-sea/dsh-mistral-vibe-provider")');
source = source.replace(
  '"dsh-mistral-vibe: own settings page"',
  '"@mars-sea/dsh-mistral-vibe-provider: own settings page"',
);
source = source.replace('"dsh-mistral-vibe: http routes"', '"@mars-sea/dsh-mistral-vibe-provider: http routes"');

writeFileSync(FILE, source);
console.log(`patched ${FILE.pathname}`);
for (const label of applied) console.log(`  ok: ${label}`);
