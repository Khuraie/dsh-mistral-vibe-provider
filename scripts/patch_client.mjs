/**
 * One-shot patch for the client half: adds the account card (plan, the two
 * Mistral meters, browser sign-in) above the existing settings cards.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("./lib/client.js", import.meta.url);
const lines = readFileSync(FILE, "utf8").split("\n");

function findLine(predicate, from = 0, label = "anchor") {
  for (let index = from; index < lines.length; index += 1) {
    if (predicate(lines[index].trim())) return index;
  }
  throw new Error(`anchor not found: ${label}`);
}

function indentOf(index) {
  const match = /^[\t ]*/.exec(lines[index]);
  return match ? match[0] : "";
}

/** Insert the block (array of strings, already indented relative to `base`) before `index`. */
function insertBefore(index, block) {
  lines.splice(index, 0, ...block);
}

/* 1. route constants. */
{
  const at = findLine((t) => t === 'const DISCOVER_URL = "/mistral-vibe/discover";', 0, "DISCOVER_URL");
  const indent = indentOf(at);
  insertBefore(at === 0 ? 2 : 0, []); // no-op keeps the splice surface obvious
  lines.splice(at + 1, 0,
    `${indent}const BUDGET_URL = "/mistral-vibe/budget";`,
    `${indent}const SIGN_IN_URL = "/mistral-vibe/sign-in";`,
    `${indent}const SIGN_IN_STATUS_URL = "/mistral-vibe/sign-in/status";`,
  );
}

/* 2. the account card components, right before the settings section. */
{
  const at = findLine((t) => t === "function MistralVibeSection() {", 0, "section component");
  const block = [
    `function formatMoney(value, currency) {`,
    `\tif (typeof value !== "number" || !Number.isFinite(value)) return "—";`,
    `\tconst symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";`,
    `\treturn symbol + value.toFixed(2);`,
    `}`,
    ``,
    `/** One budget meter: a labelled bar plus the numbers behind it. */`,
    `function VibeMeter(props) {`,
    `\tconst meter = props.meter;`,
    `\tconst percent = meter && typeof meter.percent === "number" ? Math.max(0, Math.min(100, meter.percent)) : undefined;`,
    `\tconst when = meter && typeof meter.resetAt === "string" ? new Date(meter.resetAt) : undefined;`,
    `\tconst reset = when && Number.isFinite(when.getTime()) ? when.toISOString().slice(0, 10) : undefined;`,
    `\tconst hot = percent !== undefined && percent >= 90;`,
    `\treturn h(`,
    `\t\t"div",`,
    `\t\t{ style: { display: "flex", flexDirection: "column", gap: 4 } },`,
    `\t\th(`,
    `\t\t\t"div",`,
    `\t\t\t{ style: { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" } },`,
    `\t\t\th("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, props.label),`,
    `\t\t\th("span", { style: { flex: 1 } }),`,
    `\t\t\th(`,
    `\t\t\t\t"span",`,
    `\t\t\t\t{ style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } },`,
    `\t\t\t\tpercent === undefined`,
    `\t\t\t\t\t? meter === null || meter === undefined`,
    `\t\t\t\t\t\t? "not read yet"`,
    `\t\t\t\t\t\t: "unavailable for this key"`,
    `\t\t\t\t\t: percent.toFixed(2) +`,
    `\t\t\t\t\t  "% · " +`,
    `\t\t\t\t\t  formatMoney(meter.used, meter.currency) +`,
    `\t\t\t\t\t  " of " +`,
    `\t\t\t\t\t  formatMoney(meter.total, meter.currency) +`,
    `\t\t\t\t\t  (reset ? " · resets " + reset : ""),`,
    `\t\t\t),`,
    `\t\t),`,
    `\t\th(`,
    `\t\t\t"div",`,
    `\t\t\t{ style: { height: 6, borderRadius: 999, background: "var(--dsw-alias-bg-layer-2)", overflow: "hidden" } },`,
    `\t\t\th("div", {`,
    `\t\t\t\tstyle: {`,
    `\t\t\t\t\theight: "100%",`,
    `\t\t\t\t\twidth: (percent === undefined ? 0 : percent) + "%",`,
    `\t\t\t\t\tborderRadius: 999,`,
    `\t\t\t\t\tbackground: hot`,
    `\t\t\t\t\t\t? "var(--dsw-alias-state-error-primary)"`,
    `\t\t\t\t\t\t: "var(--dsw-alias-state-accent-primary, #4d6bfe)",`,
    `\t\t\t\t\ttransition: "width 240ms ease",`,
    `\t\t\t\t},`,
    `\t\t\t}),`,
    `\t\t),`,
    `\t);`,
    `}`,
    ``,
    `/**`,
    ` * The account card: plan, the Vibe Code allowance and the Studio/API`,
    ` * allowance side by side, plus the PKCE browser sign-in.`,
    ` */`,
    `function VibeAccountCard(props) {`,
    `\tconst { budget, hasKey, busy, signIn, signInError, onRefresh, onSignIn } = props;`,
    `\tconst waiting = signIn === "waiting" || signIn === "starting";`,
    `\tconst error = signInError || budget?.subscriptionError || budget?.budgetError || "";`,
    `\treturn h(`,
    `\t\t"div",`,
    `\t\t{ style: card },`,
    `\t\th(`,
    `\t\t\t"div",`,
    `\t\t\t{ style: rowStyle },`,
    `\t\t\th(`,
    `\t\t\t\t"div",`,
    `\t\t\t\t{ style: { fontWeight: 500, fontSize: 13, color: "var(--dsw-alias-label-primary)" } },`,
    `\t\t\t\t"Account",`,
    `\t\t\t),`,
    `\t\t\tbudget?.plan`,
    `\t\t\t\t? h(`,
    `\t\t\t\t\t\t"span",`,
    `\t\t\t\t\t\t{`,
    `\t\t\t\t\t\t\tstyle: {`,
    `\t\t\t\t\t\t\t\tfontSize: 11,`,
    `\t\t\t\t\t\t\t\tpadding: "1px 8px",`,
    `\t\t\t\t\t\t\t\tborderRadius: 999,`,
    `\t\t\t\t\t\t\t\tborder: "1px solid var(--dsw-alias-border-l2)",`,
    `\t\t\t\t\t\t\t\tcolor: "var(--dsw-alias-label-secondary)",`,
    `\t\t\t\t\t\t\t},`,
    `\t\t\t\t\t\t},`,
    `\t\t\t\t\t\tString(budget.plan),`,
    `\t\t\t\t  )`,
    `\t\t\t\t: null,`,
    `\t\t\th("span", { style: { flex: 1 } }),`,
    `\t\t\th(`,
    `\t\t\t\t"button",`,
    `\t\t\t\t{ type: "button", disabled: busy, onClick: onRefresh, style: buttonStyle },`,
    `\t\t\t\t"Refresh",`,
    `\t\t\t),`,
    `\t\t),`,
    `\t\thasKey === false`,
    `\t\t\t? h("div", { style: hintStyle }, "No key stored yet. Sign in with Mistral, or paste a key below.")`,
    `\t\t\t: null,`,
    `\t\th(VibeMeter, { label: "Vibe Code budget", meter: budget ? budget.vibe : undefined }),`,
    `\t\th(VibeMeter, { label: "Studio / API budget", meter: budget ? budget.apiMeter : undefined }),`,
    `\t\terror !== ""`,
    `\t\t\t? h("div", { style: { fontSize: 12, color: "var(--dsw-alias-state-error-primary)" } }, error)`,
    `\t\t\t: null,`,
    `\t\th(`,
    `\t\t\t"div",`,
    `\t\t\t{ style: rowStyle },`,
    `\t\t\th(`,
    `\t\t\t\t"button",`,
    `\t\t\t\t{ type: "button", disabled: busy || waiting, onClick: onSignIn, style: primaryButtonStyle },`,
    `\t\t\t\twaiting ? "Waiting for the browser…" : "Sign in with Mistral",`,
    `\t\t\t),`,
    `\t\t\th(`,
    `\t\t\t\t"span",`,
    `\t\t\t\t{ style: hintStyle },`,
    `\t\t\t\t"Opens console.mistral.ai; the approved key is stored in the credential store.",`,
    `\t\t\t),`,
    `\t\t),`,
    `\t);`,
    `}`,
    ``,
  ];
  insertBefore(at, block);
}

/* 3. state for the meter and the sign-in poll. */
{
  const at = findLine(
    (t) => t === "const [revealToken, setRevealToken] = React.useState(false);",
    0,
    "revealToken state",
  );
  const indent = indentOf(at);
  lines.splice(at + 1, 0,
    `${indent}const [budget, setBudget] = React.useState(null);`,
    `${indent}const [budgetBusy, setBudgetBusy] = React.useState(false);`,
    `${indent}const [signIn, setSignIn] = React.useState("idle");`,
    `${indent}const [signInError, setSignInError] = React.useState("");`,
  );
}

/* 4. read the meters on mount, and the two callbacks. */
{
  const at = findLine((t) => t === "void reload();", 0, "reload effect body");
  const closing = at + 1; // }, [reload]);
  if (lines[closing].trim() !== "}, [reload]);") throw new Error("reload effect shape changed");
  const indent = indentOf(at - 1);
  const block = [
    `${indent}const refreshBudget = React.useCallback(async () => {`,
    `${indent}\tsetBudgetBusy(true);`,
    `${indent}\ttry {`,
    `${indent}\t\tsetBudget(await requestJson(BUDGET_URL, { method: "GET" }));`,
    `${indent}\t} catch (err) {`,
    `${indent}\t\tsetBudget({ hasKey: true, error: String(err instanceof Error ? err.message : err) });`,
    `${indent}\t} finally {`,
    `${indent}\t\tsetBudgetBusy(false);`,
    `${indent}\t}`,
    `${indent}}, []);`,
    ``,
    `${indent}React.useEffect(() => {`,
    `${indent}\tvoid refreshBudget();`,
    `${indent}}, [refreshBudget]);`,
    ``,
    `${indent}const startSignIn = React.useCallback(async () => {`,
    `${indent}\tsetSignIn("starting");`,
    `${indent}\tsetSignInError("");`,
    `${indent}\ttry {`,
    `${indent}\t\tconst started = await requestJson(SIGN_IN_URL, { method: "POST" });`,
    `${indent}\t\tif (typeof started?.signInUrl === "string" && started.signInUrl.length > 0) {`,
    `${indent}\t\t\twindow.open(started.signInUrl, "_blank", "popup,width=520,height=760");`,
    `${indent}\t\t}`,
    `${indent}\t\tsetSignIn("waiting");`,
    `${indent}\t\tconst deadline = Date.now() + 5 * 60 * 1000;`,
    `${indent}\t\twhile (Date.now() < deadline) {`,
    `${indent}\t\t\tawait new Promise((resolve) => setTimeout(resolve, 2000));`,
    `${indent}\t\t\tconst answer = await requestJson(`,
    `${indent}\t\t\t\tSIGN_IN_STATUS_URL + "?processId=" + encodeURIComponent(String(started.processId)),`,
    `${indent}\t\t\t\t{ method: "GET" },`,
    `${indent}\t\t\t);`,
    `${indent}\t\t\tif (answer?.status === "pending") continue;`,
    `${indent}\t\t\tif (answer?.status === "done") {`,
    `${indent}\t\t\t\tawait reload();`,
    `${indent}\t\t\t\tawait refreshBudget();`,
    `${indent}\t\t\t\tsetSignIn("idle");`,
    `${indent}\t\t\t\tsetNotice("Signed in. The key is stored.");`,
    `${indent}\t\t\t\treturn;`,
    `${indent}\t\t\t}`,
    `${indent}\t\t\tsetSignIn("error");`,
    `${indent}\t\t\tsetSignInError(typeof answer?.error === "string" ? answer.error : "Sign-in " + String(answer?.status ?? "failed"));`,
    `${indent}\t\t\treturn;`,
    `${indent}\t\t}`,
    `${indent}\t\tsetSignIn("error");`,
    `${indent}\t\tsetSignInError("Sign-in timed out.");`,
    `${indent}\t} catch (err) {`,
    `${indent}\t\tsetSignIn("error");`,
    `${indent}\t\tsetSignInError(String(err instanceof Error ? err.message : err));`,
    `${indent}\t}`,
    `${indent}}, [reload, refreshBudget]);`,
  ];
  lines.splice(closing + 1, 0, "", ...block);
}

/* 5. the card itself: first child of the section body, above the settings cards. */
{
  const scrollAt = findLine((t) => t === 'overflowY: "auto",', 0, "scroll container");
  let opener = scrollAt;
  while (opener > 0 && lines[opener].trim() !== "h(") opener -= 1;
  if (opener === 0) throw new Error("scroll container opener not found");
  const indent = indentOf(opener);
  insertBefore(opener, [
    `${indent}h(VibeAccountCard, {`,
    `${indent}\tbudget: budget,`,
    `${indent}\thasKey: state.hasKey,`,
    `${indent}\tbusy: busy || budgetBusy,`,
    `${indent}\tsignIn: signIn,`,
    `${indent}\tsignInError: signInError,`,
    `${indent}\tonRefresh: refreshBudget,`,
    `${indent}\tonSignIn: startSignIn,`,
    `${indent}}),`,
  ]);
}

/* 6. identity: module id, exported name, boundary label. */
let source = lines.join("\n");
source = source.replace('id: "dsh-mistral-vibe",', 'id: "@mars-sea/dsh-mistral-vibe-provider",');
source = source.replace('const name = "dsh-mistral-vibe";', 'const name = "@mars-sea/dsh-mistral-vibe-provider";');
writeFileSync(FILE, source);
console.log("patched", FILE.pathname);
