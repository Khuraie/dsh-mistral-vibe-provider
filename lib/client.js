/**
 * dsh-mistral-vibe client: the "Mistral Vibe" settings page.
 *
 * Shipped as a built lazy-CJS half: the loader registers this factory and calls
 * it at materialization, so every import resolves from the shell's module table.
 * The page owns no Harness schema form — it talks to the Host half over the
 * loopback routes that half registers (`/mistral-vibe/config`,
 * `/mistral-vibe/discover`), exactly like the MCP Servers settings page.
 */
window.__ModuleLoader__.load({
	id: "@mars-sea/dsh-mistral-vibe-provider",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		const CONFIG_URL = "/mistral-vibe/config";
		const DISCOVER_URL = "/mistral-vibe/discover";
		const BUDGET_URL = "/mistral-vibe/budget";
		const SESSION_COST_URL = "/mistral-vibe/session-cost";
		const SIGN_IN_URL = "/mistral-vibe/sign-in";
		const SIGN_IN_STATUS_URL = "/mistral-vibe/sign-in/status";
		// The settings page announces a budget change (a sign-in, a saved key)
		// so the sidebar card re-reads instead of waiting for its own interval.
		const BUDGET_EVENT = "mistral-vibe:budget";

		const card = {
			background: "var(--dsw-alias-bg-layer-1)",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 12,
			padding: "12px 14px",
			display: "flex",
			flexDirection: "column",
			gap: 8,
			minWidth: 0,
		};
		const fieldStyle = {
			boxSizing: "border-box",
			width: "100%",
			padding: "6px 8px",
			font: "inherit",
			fontSize: 13,
			lineHeight: "20px",
			borderRadius: 6,
			border: "1px solid var(--dsw-alias-border-l1)",
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
		};
		const labelStyle = {
			marginBottom: 2,
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary)",
		};
		const hintStyle = {
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)",
		};
		const buttonStyle = {
			font: "inherit",
			fontSize: 13,
			padding: "5px 12px",
			borderRadius: 6,
			cursor: "pointer",
			border: "1px solid var(--dsw-alias-border-l1)",
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
		};
		const primaryButtonStyle = {
			...buttonStyle,
			border: "1px solid var(--dsw-alias-state-accent-primary, #4d6bfe)",
			background: "var(--dsw-alias-state-accent-primary, #4d6bfe)",
			color: "#fff",
		};
		const rowStyle = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
		const modelRowStyle = {
			display: "flex",
			alignItems: "flex-start",
			gap: 8,
			padding: "3px 0",
			fontSize: 13,
			color: "var(--dsw-alias-label-primary)",
		};
		const metaStyle = {
  fontSize: 11,
  lineHeight: "16px",
  color: "var(--dsw-alias-label-tertiary)",
};

const monoStyle = {
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			fontSize: 11,
			color: "var(--dsw-alias-label-tertiary)",
		};

		function Field(props) {
			return h(
				"div",
				{ style: { margin: "2px 0" } },
				h("div", { style: labelStyle }, props.label),
				props.children,
			);
		}

		function EyeIcon(props) {
			const open = props.open === true;
			const common = {
				width: 16,
				height: 16,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				focusable: "false",
			};
			const outline = h("path", {
				key: "outline",
				d: "M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z",
			});
			const pupil = h("circle", { key: "pupil", cx: 12, cy: 12, r: 2.7 });
			const slash = h("path", { key: "slash", d: "M4 4.5 20 19.5" });
			return h("svg", common, ...(open ? [outline, pupil] : [outline, slash]));
		}

		/**
		 * A password input with its own open/close eye control: the glyph sits
		 * inside the field, so the row keeps no separate Show/Hide button and
		 * no stored/fallback badge beside it.
		 */
		function SecretField(props) {
			const open = props.open === true;
			return h(
				"div",
				{ style: { position: "relative", display: "flex", alignItems: "center" } },
				h("input", {
					type: open ? "text" : "password",
					value: props.value,
					placeholder: props.placeholder,
					autoComplete: "off",
					spellCheck: false,
					onChange: props.onChange,
					style: { ...fieldStyle, paddingRight: 34 },
				}),
				h(
					"button",
					{
						type: "button",
						onClick: props.onToggle,
						title: open ? "Hide key" : "Show key",
						"aria-label": open ? "Hide key" : "Show key",
						"aria-pressed": open,
						style: {
							position: "absolute",
							right: 3,
							top: "50%",
							transform: "translateY(-50%)",
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							width: 26,
							height: 26,
							padding: 0,
							border: "none",
							borderRadius: 5,
							background: "transparent",
							cursor: "pointer",
							color: "var(--dsw-alias-label-tertiary)",
						},
					},
					h(EyeIcon, { open }),
				),
			);
		}

		// An exposed deployment (web UI reached over HTTP/S from another origin, or
		// through a proxy that rewrites Origin) needs a token the host accepts.
		// It lives in localStorage, never in the page bundle.
		const TOKEN_KEY = "mistral-vibe-access-token";

		function readAccessToken() {
			try {
				const value = window.localStorage?.getItem(TOKEN_KEY);
				return typeof value === "string" && value.length > 0 ? value : "";
			} catch {
				return "";
			}
		}

		function writeAccessToken(value) {
			try {
				if (value.length === 0) window.localStorage?.removeItem(TOKEN_KEY);
				else window.localStorage?.setItem(TOKEN_KEY, value);
			} catch {
				// Private mode: the token then lives for this page only.
			}
		}

		async function requestJson(url, init) {
			const token = readAccessToken();
			const response = await fetch(url, {
				cache: "no-store",
				headers: {
					"content-type": "application/json",
					...(token.length > 0 ? { "x-mistral-vibe-token": token } : {}),
				},
				...init,
			});
			const text = await response.text();
			let payload;
			try {
				payload = text.length === 0 ? {} : JSON.parse(text);
			} catch {
				throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
			}
			if (!response.ok) {
				const detail = payload?.error ?? `HTTP ${response.status}`;
				throw new Error(
					payload?.code === "access_token_rejected" || payload?.code === "access_token_required"
						? `${detail} — paste the access token below`
						: detail,
				);
			}
			return payload;
		}

		/** What a model can do, in one line: thinking ladder, modality, window. */
function modelMeta(model) {
  const levels = Array.isArray(model.levels) ? model.levels : [];
  const thinking =
    levels.length > 0
      ? levels.join(" · ")
      : model.reasoning === true
        ? "thinking (levels unknown)"
        : "no thinking";
  const vision =
    Array.isArray(model.inputModalities) && model.inputModalities.includes("image")
      ? "text + image"
      : "text";
  const window =
    typeof model.contextWindow === "number" && model.contextWindow > 0
      ? `${Math.round(model.contextWindow / 1024)}K ctx`
      : "";
  return [thinking, vision, window].filter((part) => part.length > 0).join("  ·  ");
}

/** A per-1M-token price, with the third decimal the cached-input price needs. */
function formatPrice(value) {
	if (typeof value !== "number" || !Number.isFinite(value)) return "";
	if (value === 0) return "$0";
	return "$" + (value < 0.1 ? value.toFixed(3) : value.toFixed(2));
}

/**
 * One model's price line: "$0.30 in · $0.007 cached · $1.20 out / 1M tokens".
 * The catalogue keeps models.dev's input/output numbers plus Mistral's
 * cached-input price; a discovered model has no prices and shows no line.
 */
function priceLine(model) {
	const cost = model === null || typeof model !== "object" ? undefined : model.cost;
	if (cost === null || typeof cost !== "object") return "";
	const cached = typeof cost.cacheRead === "number" ? cost.cacheRead : cost.cache_read;
	const parts = [];
	if (typeof cost.input === "number") parts.push(formatPrice(cost.input) + " in");
	if (typeof cached === "number") parts.push(formatPrice(cached) + " cached");
	if (typeof cost.output === "number") parts.push(formatPrice(cost.output) + " out");
	return parts.length === 0 ? "" : parts.join(" · ") + " / 1M tokens";
}

/** One model row: name and badges on top, capabilities and price beneath. */
function ModelCell(props) {
  const model = props.model;
  const price = priceLine(model);
  const tierGated =
  	props.tierGated === true
  		? h(
  			"span",
  			{
  				style: {
  					...monoStyle,
  					color: "var(--dsw-alias-state-warn-primary, #b7791f)",
  					border: "1px solid var(--dsw-alias-state-warn-primary, #b7791f)",
  					borderRadius: 4,
  					padding: "0 4px",
  				},
  			},
  			"not in plan",
  		  )
  		: null;
  return h(
    "span",
    { style: { flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 } },
    h(
      "span",
      { style: { display: "flex", alignItems: "center", gap: 6 } },
      h("span", { style: { fontSize: 13, lineHeight: "18px" } }, model.name ?? model.id),
      model.discovered === true
        ? h(
            "span",
            {
              style: {
                ...monoStyle,
                color: "var(--dsw-alias-label-primary)",
                border: "1px solid var(--dsw-alias-border-secondary)",
                borderRadius: 4,
                padding: "0 4px",
              },
            },
            "new",
          )
        : null,
    ),
    tierGated,
    h("span", { style: metaStyle }, modelMeta(model)),
    price !== ""
      ? h("span", { style: { ...metaStyle, fontVariantNumeric: "tabular-nums" } }, price)
      : null,
  );
}

function formatMoney(value, currency) {
	if (typeof value !== "number" || !Number.isFinite(value)) return "—";
	const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
	return symbol + value.toFixed(2);
}

/** One budget meter: a labelled bar plus the numbers behind it. */
function VibeMeter(props) {
	const meter = props.meter;
	const percent = meter && typeof meter.percent === "number" ? Math.max(0, Math.min(100, meter.percent)) : undefined;
	const when = meter && typeof meter.resetAt === "string" ? new Date(meter.resetAt) : undefined;
	const reset = when && Number.isFinite(when.getTime()) ? when.toISOString().slice(0, 10) : undefined;
	const hot = percent !== undefined && percent >= 90;
	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column", gap: 4 } },
		h(
			"div",
			{ style: { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" } },
			h("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, props.label),
			h("span", { style: { flex: 1 } }),
			h(
				"span",
				{ style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } },
				percent === undefined
					? meter === null || meter === undefined
						? "not read yet"
						: "unavailable for this key"
					: percent.toFixed(2) +
					  "% · " +
					  formatMoney(meter.used, meter.currency) +
					  " of " +
					  formatMoney(meter.total, meter.currency) +
					  (reset ? " · resets " + reset : ""),
			),
		),
		h(
			"div",
			{ style: { height: 6, borderRadius: 999, background: "var(--dsw-alias-bg-layer-2)", overflow: "hidden" } },
			h("div", {
				style: {
					height: "100%",
					width: (percent === undefined ? 0 : percent) + "%",
					borderRadius: 999,
					background: hot
						? "var(--dsw-alias-state-error-primary)"
						: "var(--dsw-alias-state-accent-primary, #4d6bfe)",
					transition: "width 240ms ease",
				},
			}),
		),
	);
}

/**
 * The account card: plan, the Vibe Code allowance and the Studio/API
 * allowance side by side, plus the PKCE browser sign-in.
 */
function VibeAccountCard(props) {
	const { budget, hasKey, busy, signIn, signInError, onRefresh, onSignIn } = props;
	const waiting = signIn === "waiting" || signIn === "starting";
	const error = signInError || budget?.subscriptionError || budget?.budgetError || "";
	return h(
		"div",
		{ style: card },
		h(
			"div",
			{ style: rowStyle },
			h(
				"div",
				{ style: { fontWeight: 500, fontSize: 13, color: "var(--dsw-alias-label-primary)" } },
				"Account",
			),
			budget?.plan
				? h(
						"span",
						{
							style: {
								fontSize: 11,
								padding: "1px 8px",
								borderRadius: 999,
								border: "1px solid var(--dsw-alias-border-l2)",
								color: "var(--dsw-alias-label-secondary)",
							},
						},
						String(budget.plan),
				  )
				: null,
			h("span", { style: { flex: 1 } }),
			h(
				"button",
				{ type: "button", disabled: busy, onClick: onRefresh, style: buttonStyle },
				"Refresh",
			),
		),
		hasKey === false
			? h("div", { style: hintStyle }, "No key stored yet. Sign in with Mistral, or paste a key below.")
			: null,
		h(VibeMeter, { label: "Vibe Code budget", meter: budget ? budget.vibe : undefined }),
		h(VibeMeter, { label: "Studio / API budget", meter: budget ? budget.apiMeter : undefined }),
		error !== ""
			? h("div", { style: { fontSize: 12, color: "var(--dsw-alias-state-error-primary)" } }, error)
			: null,
		h(
			"div",
			{ style: rowStyle },
			h(
				"button",
				{ type: "button", disabled: busy || waiting, onClick: onSignIn, style: primaryButtonStyle },
				waiting ? "Waiting for the browser…" : "Sign in with Mistral",
			),
			h(
				"span",
				{ style: hintStyle },
				"Opens console.mistral.ai; the approved key is stored in the credential store.",
			),
		),
	);
}

function MistralVibeSection() {
			const [state, setState] = React.useState(null);
			const [error, setError] = React.useState("");
			const [notice, setNotice] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [keyDraft, setKeyDraft] = React.useState("");
			const [studioDraft, setStudioDraft] = React.useState("");
			const [reveal, setReveal] = React.useState(false);
			const [revealStudio, setRevealStudio] = React.useState(false);
			const [endpointDraft, setEndpointDraft] = React.useState("");
			const [tokenDraft, setTokenDraft] = React.useState("");
			const [revealToken, setRevealToken] = React.useState(false);
			const [budget, setBudget] = React.useState(null);
			const [budgetBusy, setBudgetBusy] = React.useState(false);
			const [signIn, setSignIn] = React.useState("idle");
			const [signInError, setSignInError] = React.useState("");

			const apply = React.useCallback((payload) => {
				setState(payload);
				setEndpointDraft(typeof payload?.baseURL === "string" ? payload.baseURL : "");
				// The token never comes back from the host; the copy this browser sent
				// is what the page shows as set.
				setTokenDraft(readAccessToken());
			}, []);

			const reload = React.useCallback(async () => {
				try {
					apply(await requestJson(CONFIG_URL, { method: "GET" }));
				} catch (err) {
					setError(String(err instanceof Error ? err.message : err));
				}
			}, [apply]);

			React.useEffect(() => {
				void reload();
			}, [reload]);

			const refreshBudget = React.useCallback(async () => {
				setBudgetBusy(true);
				try {
					setBudget(await requestJson(BUDGET_URL, { method: "GET" }));
				} catch (err) {
					setBudget({ hasKey: true, error: String(err instanceof Error ? err.message : err) });
				} finally {
					setBudgetBusy(false);
				}
			}, []);

			React.useEffect(() => {
				void refreshBudget();
			}, [refreshBudget]);

			const startSignIn = React.useCallback(async () => {
				setSignIn("starting");
				setSignInError("");
				try {
					const started = await requestJson(SIGN_IN_URL, { method: "POST" });
					if (typeof started?.signInUrl === "string" && started.signInUrl.length > 0) {
						window.open(started.signInUrl, "_blank", "popup,width=520,height=760");
					}
					setSignIn("waiting");
					const deadline = Date.now() + 5 * 60 * 1000;
					while (Date.now() < deadline) {
						await new Promise((resolve) => setTimeout(resolve, 2000));
						const answer = await requestJson(
							SIGN_IN_STATUS_URL + "?processId=" + encodeURIComponent(String(started.processId)),
							{ method: "GET" },
						);
						if (answer?.status === "pending") continue;
						if (answer?.status === "done") {
							await reload();
							await refreshBudget();
							// The footer card reads the same route; a sign-in is
							// exactly the moment its numbers change.
							window.dispatchEvent(new CustomEvent(BUDGET_EVENT));
							setSignIn("idle");
							setNotice("Signed in. The key is stored.");
							return;
						}
						setSignIn("error");
						setSignInError(typeof answer?.error === "string" ? answer.error : "Sign-in " + String(answer?.status ?? "failed"));
						return;
					}
					setSignIn("error");
					setSignInError("Sign-in timed out.");
				} catch (err) {
					setSignIn("error");
					setSignInError(String(err instanceof Error ? err.message : err));
				}
			}, [reload, refreshBudget]);

			const save = React.useCallback(
				async (patch, done) => {
					setBusy(true);
					setError("");
					setNotice("");
					try {
						await requestJson(CONFIG_URL, { method: "POST", body: JSON.stringify(patch) });
						await reload();
						setNotice(done);
						// A saved key changes the allowance the footer shows.
						window.dispatchEvent(new CustomEvent(BUDGET_EVENT));
					} catch (err) {
						setError(String(err instanceof Error ? err.message : err));
					} finally {
						setBusy(false);
					}
				},
				[reload],
			);

			const saveKey = React.useCallback(() => {
				const key = keyDraft.trim();
				if (key.length === 0) {
					setError("Paste a Mistral API key first.");
					return;
				}
				void save({ apiKey: key }, "Key saved.").then(() => setKeyDraft(""));
			}, [keyDraft, save]);

			const saveStudioKey = React.useCallback(() => {
				const key = studioDraft.trim();
				if (key.length === 0) {
					setError("Paste the Studio API key first.");
					return;
				}
				void save({ studioApiKey: key }, "Studio key saved.").then(() => setStudioDraft(""));
			}, [studioDraft, save]);

			const saveEndpoint = React.useCallback(() => {
				void save({ baseURL: endpointDraft.trim() }, "Endpoint saved.");
			}, [endpointDraft, save]);

			const saveToken = React.useCallback(async () => {
				const value = tokenDraft.trim();
				writeAccessToken(value);
				try {
					await requestJson(CONFIG_URL, {
						method: "POST",
						body: JSON.stringify({ accessToken: value }),
					});
					await reload();
					setNotice(value.length === 0 ? "Access token cleared." : "Access token saved.");
				} catch (err) {
					setError(String(err instanceof Error ? err.message : err));
				}
			}, [tokenDraft, reload]);

			const setRemote = React.useCallback(
				(next) => {
					void save(
						{ allowRemote: next },
						next ? "This page answers non-loopback requests." : "Loopback only again.",
					);
				},
				[save],
			);

			const toggleModel = React.useCallback(
				(id) => {
					const disabled = Array.isArray(state?.disabledModels) ? state.disabledModels : [];
					const next = disabled.includes(id)
						? disabled.filter((entry) => entry !== id)
						: [...disabled, id];
					void save({ disabledModels: next }, "Model list updated.");
				},
				[save, state],
			);

			const fetchModels = React.useCallback(async () => {
				setBusy(true);
				setError("");
				setNotice("");
				try {
					const draft = keyDraft.trim();
					const payload = await requestJson(DISCOVER_URL, {
						method: "POST",
						body: JSON.stringify(draft.length > 0 ? { apiKey: draft } : {}),
					});
					await reload();
					// The list is one stored document now. If the row could not write
					// it, say so: otherwise the next reload looks like the fetch was
					// simply forgotten and the user fetches again and again.
					if (payload?.persisted === false) {
						setError(
							`Fetched ${payload?.models?.length ?? 0} models, but the list could not be saved: ${
								typeof payload?.persistError === "string" && payload.persistError.length > 0
									? payload.persistError
									: "the settings row rejected the write"
							}`,
						);
					} else {
						setNotice(
							typeof payload?.notice === "string" && payload.notice.length > 0
								? payload.notice
								: `${payload?.models?.length ?? 0} models reported by Mistral.`,
						);
					}
				} catch (err) {
					setError(String(err instanceof Error ? err.message : err));
				} finally {
					setBusy(false);
				}
			}, [keyDraft, reload]);

			if (state === null) {
				return h(
					"div",
					{ style: { padding: 12, ...hintStyle } },
					error.length > 0 ? error : "Loading the Mistral Vibe route…",
				);
			}

			const models = Array.isArray(state.models) ? state.models : [];
			const disabled = Array.isArray(state.disabledModels) ? state.disabledModels : [];

			return h(
				"div",
				{
					className: "dshmv-section",
					style: { height: "100%", display: "flex", flexDirection: "column", minWidth: 0 },
				},
				h(
					"div",
					{ style: { display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 8px" } },
					h(
						"h3",
						{
							style: {
								margin: 0,
								fontSize: 16,
								lineHeight: "24px",
								fontWeight: 500,
								color: "var(--dsw-alias-label-primary)",
							},
						},
						"Mistral Vibe",
					),
					h("span", { style: { flex: 1 } }),
					notice.length > 0
						? h(
								"span",
								{ style: { fontSize: 12, color: "var(--dsw-alias-state-success-primary)" } },
								notice,
							)
						: null,
					error.length > 0
						? h(
								"span",
								{ style: { fontSize: 12, color: "var(--dsw-alias-state-error-primary)" } },
								error,
							)
						: null,
				),
				h(VibeAccountCard, {
					budget: budget,
					hasKey: state.hasKey,
					busy: busy || budgetBusy,
					signIn: signIn,
					signInError: signInError,
					onRefresh: refreshBudget,
					onSignIn: startSignIn,
				}),
				h(
					"div",
					{
						style: {
							flex: 1,
							overflowY: "auto",
							overflowX: "hidden",
							padding: "12px 4px 24px",
							display: "flex",
							flexDirection: "column",
							gap: 12,
							maxWidth: 760,
						},
					},
					h(
						"div",
						{ style: card },
						h(
							"div",
							{ style: { fontWeight: 500, fontSize: 13, color: "var(--dsw-alias-label-primary)" } },
							"API keys",
						),
						h(Field, {
							label: "Vibe Code API key",
							children: h(SecretField, {
								open: reveal,
								value: keyDraft,
								placeholder: state.hasKey ? "••••••••" : "msk-…",
								onChange: (event) => setKeyDraft(event.target.value),
								onToggle: () => setReveal(!reveal),
							}),
						}),
						h(
							"div",
							{ style: rowStyle },
							h(
								"button",
								{ type: "button", disabled: busy, onClick: saveKey, style: primaryButtonStyle },
								"Save key",
							),
						),
						h(Field, {
							label: "Studio API key",
							children: h(SecretField, {
								open: revealStudio,
								value: studioDraft,
								placeholder: state.hasStudioKey ? "••••••••" : "optional",
								onChange: (event) => setStudioDraft(event.target.value),
								onToggle: () => setRevealStudio(!revealStudio),
							}),
						}),
						h(
							"div",
							{ style: rowStyle },
							h(
								"button",
								{ type: "button", disabled: busy, onClick: saveStudioKey, style: primaryButtonStyle },
								"Save Studio key",
							),
						),
					),
					h(
						"div",
						{ style: card },
						h(
							"div",
							{ style: { fontWeight: 500, fontSize: 13, color: "var(--dsw-alias-label-primary)" } },
							"Endpoint",
						),
						h(Field, {
							label: "Base URL",
							children: h("input", {
								type: "text",
								value: endpointDraft,
								placeholder: "https://api.mistral.ai/v1",
								spellCheck: false,
								onChange: (event) => setEndpointDraft(event.target.value),
								style: fieldStyle,
							}),
						}),
						h(
							"div",
							{ style: rowStyle },
							h(
								"button",
								{ type: "button", disabled: busy, onClick: saveEndpoint, style: buttonStyle },
								"Save endpoint",
							),
						),
					),
					h(
						"div",
						{ style: card },
						h(
							"div",
							{ style: { fontWeight: 500, fontSize: 13, color: "var(--dsw-alias-label-primary)" } },
							"Remote access",
						),
						h(
							"label",
							{ style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 } },
							h("input", {
								type: "checkbox",
								checked: state.allowRemote !== false,
								disabled: busy,
								onChange: (event) => setRemote(event.target.checked),
							}),
							"Answer this page when the web UI is exposed over HTTP/S",
						),
						h(Field, {
							label: "Access token",
							children: h(SecretField, {
								value: tokenDraft,
								placeholder: "only needed off same-origin",
								open: revealToken,
								onToggle: () => setRevealToken(!revealToken),
								onChange: (event) => setTokenDraft(event.target.value),
							}),
						}),
						h(
							"div",
							{ style: rowStyle },
							h(
								"button",
								{ type: "button", disabled: busy, onClick: saveToken, style: primaryButtonStyle },
								"Save token",
							),
							h(
								"span",
								{ style: { ...hintStyle, marginLeft: 8 } },
								state.hasToken === true ? "a token is set" : "no token set",
							),
						),
					),
					h(
						"div",
						{ style: card },
						h(
							"div",
							{
								style: {
									display: "flex",
									alignItems: "center",
									gap: 8,
									fontSize: 13,
									fontWeight: 500,
									color: "var(--dsw-alias-label-primary)",
								},
							},
							"Models",
							h("span", { style: { flex: 1 } }),
							h(
								"button",
								{ type: "button", disabled: busy, onClick: fetchModels, style: buttonStyle },
								"Fetch available models",
							),
						),
						// Which host build answered. "build unknown" means the host is
						// still running a module loaded before this field existed, which is
						// exactly when a reload looks applied but changes nothing.
						h(
							"div",
							{ style: { ...hintStyle, ...monoStyle, marginTop: 6 } },
							typeof state.build === "string" && state.build.length > 0
								? `host build ${state.build}`
								: "host build unknown (restart DeepSeek Harness to load this version)",
						),
						models.length === 0
							? h("div", { style: hintStyle }, "No models known yet.")
							: h(
									"div",
									{ style: { display: "flex", flexDirection: "column", gap: 0 } },
									...models.map((model) =>
										h(
											"label",
											{ key: model.id, style: modelRowStyle },
											h("input", {
												type: "checkbox",
												checked: !disabled.includes(model.id),
												disabled: busy,
												onChange: () => toggleModel(model.id),
											}),
											h(ModelCell, {
												model,
												tierGated:
													Array.isArray(state.servedModels) &&
													state.servedModels.length > 0 &&
													state.servedModels.indexOf(model.id) === -1,
											}),
											h("span", { style: monoStyle }, model.id),
										),
									),
								),
					),
				),
			);
		}

		/* --- the sidebar quota card ---------------------------------------- */

		/**
		 * One compact meter: a label, the money behind it, the percentage, and
		 * a 4px bar. The settings page draws the same two meters with their
		 * numbers; the sidebar foot keeps the same numbers on one line.
		 */
		function QuotaMeter(props) {
			const meter = props.meter;
			const percent =
				meter && typeof meter.percent === "number"
					? Math.max(0, Math.min(100, meter.percent))
					: undefined;
			const hot = percent !== undefined && percent >= 90;
			// A read that failed is not the same as a read that has not
			// happened: the dash is the only place the footer can say so.
			const missing = percent === undefined && props.failed === true;
			const money = meterMoney(meter);
			return h(
				"div",
				{ style: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 } },
				h(
					"div",
					{ style: { display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 } },
					h(
						"span",
						{
							style: {
								flex: 1,
								minWidth: 0,
								fontSize: 11,
								lineHeight: "14px",
								color: "var(--dsw-alias-label-secondary)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							},
						},
						props.label,
					),
					money !== ""
						? h(
								"span",
								{
									style: {
										flex: "none",
										fontSize: 11,
										lineHeight: "14px",
										fontVariantNumeric: "tabular-nums",
										color: "var(--dsw-alias-label-tertiary)",
										whiteSpace: "nowrap",
									},
								},
								money,
							)
						: null,
					h(
						"span",
						{
							style: {
								flex: "none",
								fontSize: 11,
								lineHeight: "14px",
								fontVariantNumeric: "tabular-nums",
								color:
									missing || hot
										? "var(--dsw-alias-state-error-primary)"
										: "var(--dsw-alias-label-secondary)",
							},
						},
						percent === undefined ? "—" : percent.toFixed(1) + "%",
					),
				),
				h(
					"div",
					{
						style: {
							height: 4,
							borderRadius: 999,
							background: "var(--dsw-alias-bg-layer-2)",
							overflow: "hidden",
						},
					},
					h("div", {
						style: {
							height: "100%",
							width: (percent === undefined ? 0 : percent) + "%",
							borderRadius: 999,
							background: hot
								? "var(--dsw-alias-state-error-primary)"
								: "var(--dsw-alias-state-accent-primary, #4d6bfe)",
							transition: "width 240ms ease",
						},
					}),
				),
			);
		}

		/** One meter as text, for the tooltip and the accessible name. */
		function meterPercentText(meter) {
			return meter && typeof meter.percent === "number"
				? meter.percent.toFixed(1) + "%"
				: "unavailable";
		}

		/**
		 * The money behind one meter, on one line: "$6.23 of $10.00". A meter
		 * whose total never arrived shows no money at all: a dash there would
		 * read as a zero balance.
		 */
		function meterMoney(meter) {
			if (meter === undefined || meter === null) return "";
			if (typeof meter.used !== "number" || typeof meter.total !== "number") return "";
			return formatMoney(meter.used, meter.currency) + " of " + formatMoney(meter.total, meter.currency);
		}

		/**
		 * The numbers behind one meter, for the footer card's tooltip. A
		 * failed read is reported as unavailable: "not read yet" belongs to
		 * the moment before the first answer, not to a broken key.
		 */
		function meterSummary(meter, readFailed) {
			if (meter === undefined || meter === null) return readFailed === true ? "unavailable" : "not read yet";
			if (typeof meter.percent !== "number") return "unavailable for this key";
			const when = typeof meter.resetAt === "string" ? new Date(meter.resetAt) : undefined;
			const reset = when && Number.isFinite(when.getTime()) ? when.toISOString().slice(0, 10) : "";
			return (
				meter.percent.toFixed(2) +
				"% · " +
				formatMoney(meter.used, meter.currency) +
				" of " +
				formatMoney(meter.total, meter.currency) +
				(reset ? " · resets " + reset : "")
			);
		}

		/** Enter and Space activate the footer card, like any other control. */
		function activateOnKey(run) {
			return (event) => {
				if (event.repeat) return;
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				run();
			};
		}

		/**
		 * The card's copy of a route error. `requestJson` appends the settings
		 * page's own remedy ("paste the access token below"); the footer has no
		 * field below it, so it points at the page that does.
		 */
		function cardErrorText(error) {
			const text = String(error);
			const suffix = " — paste the access token below";
			return text.endsWith(suffix)
				? text.slice(0, text.length - suffix.length) + " (open Settings → Mistral Vibe)"
				: text;
		}

		/**
		 * The sidebar quota card, registered in `sidebar.footer.action`.
		 *
		 * The shell renders that seat in the footer row directly above
		 * `sidebar.settings`, so the two allowances sit above the account
		 * launcher without touching it: the seat is additive, and the account
		 * row keeps its own registration.
		 *
		 * It reads the same `/mistral-vibe/budget` route the settings page
		 * reads, so both surfaces always show the same numbers. A budget
		 * allowance moves slowly, so one read on mount, one every ten minutes,
		 * and one when the settings page reports a change is enough; the two
		 * billing endpoints stay quiet.
		 */
		function MistralVibeQuota(props) {
			const wide = props?.wide !== false;
			const [budget, setBudget] = React.useState(null);
			const [error, setError] = React.useState("");
			const [hover, setHover] = React.useState(false);
			const [busy, setBusy] = React.useState(false);
			const alive = React.useRef(true);
			const readAt = React.useRef(0);
			const sequence = React.useRef(0);

			const load = React.useCallback(async (quiet) => {
				const ticket = ++sequence.current;
				if (quiet !== true) setBusy(true);
				const controller = typeof AbortController === "function" ? new AbortController() : undefined;
				const timer =
					controller === undefined ? 0 : window.setTimeout(() => controller.abort(), 15000);
				try {
					const payload = await requestJson(BUDGET_URL, {
						method: "GET",
						...(controller === undefined ? {} : { signal: controller.signal }),
					});
					// A newer read owns the state; an older answer is dropped
					// rather than written over it.
					if (!alive.current || ticket !== sequence.current) return;
					setBudget(payload);
					setError("");
					readAt.current = Date.now();
				} catch (err) {
					if (!alive.current || ticket !== sequence.current) return;
					setError(String(err instanceof Error ? err.message : err));
				} finally {
					if (timer !== 0) window.clearTimeout(timer);
					if (alive.current && ticket === sequence.current) setBusy(false);
				}
			}, []);

			React.useEffect(() => {
				alive.current = true;
				void load(false);
				const interval = window.setInterval(() => void load(true), 10 * 60 * 1000);
				// A sign-in or a saved key changes these numbers; the settings
				// page announces it instead of leaving the footer stale until
				// the next interval.
				const onChanged = () => void load(true);
				window.addEventListener(BUDGET_EVENT, onChanged);
				// Returning to the window is the other moment the allowance can
				// have moved; a read younger than a minute is still fresh.
				const onVisible = () => {
					if (document.visibilityState !== "visible") return;
					if (Date.now() - readAt.current < 60 * 1000) return;
					void load(true);
				};
				document.addEventListener("visibilitychange", onVisible);
				return () => {
					alive.current = false;
					window.clearInterval(interval);
					window.removeEventListener(BUDGET_EVENT, onChanged);
					document.removeEventListener("visibilitychange", onVisible);
				};
			}, [load]);

			const vibe = budget ? budget.vibe : undefined;
			const apiMeter = budget ? budget.apiMeter : undefined;
			const plan = budget && typeof budget.plan === "string" ? budget.plan : "";
			const hasKey = !budget || budget.hasKey !== false;
			// The route answers 200 with the billing errors beside the meters,
			// so an expired key is a failed read, not an empty account.
			const readError = budget ? budget.subscriptionError || budget.budgetError || "" : "";
			const failure = error !== "" ? error : readError;
			const failed = failure !== "";
			const showError = failed && budget === null;
			const stale = failed && budget !== null;
			const percent =
				vibe && typeof vibe.percent === "number"
					? Math.max(0, Math.min(100, vibe.percent))
					: 0;
			const hot = percent >= 90;
			const fill = hot
				? "var(--dsw-alias-state-error-primary)"
				: "var(--dsw-alias-state-accent-primary, #4d6bfe)";

			const lines = [];
			if (budget === null) {
				lines.push("Mistral Vibe — reading the allowance…");
			} else if (hasKey === false) {
				lines.push("Mistral Vibe — no key stored yet. Open Settings → Mistral Vibe to sign in.");
			} else {
				lines.push("Mistral Vibe" + (plan ? " · " + plan : ""));
				lines.push("Vibe Code: " + meterSummary(vibe, failed));
				lines.push("Studio / API: " + meterSummary(apiMeter, failed));
				if (readAt.current > 0) {
					lines.push("read " + new Date(readAt.current).toLocaleTimeString());
				}
			}
			lines.push(
				failed
					? "Refresh failed: " + cardErrorText(failure) + " — click to retry"
					: "Click to refresh",
			);
			const title = lines.join("\n");

			const ariaLabel =
				budget === null
					? "Mistral Vibe quota, reading"
					: hasKey === false
						? "Mistral Vibe quota, not signed in"
						: "Mistral Vibe quota" +
							(plan ? " (" + plan + ")" : "") +
							": Vibe Code " +
							meterPercentText(vibe) +
							", Studio / API " +
							meterPercentText(apiMeter) +
							(failed ? ", refresh failed" : "") +
							". Activate to refresh.";

			const surface = {
				boxSizing: "border-box",
				cursor: busy ? "progress" : "pointer",
				opacity: busy ? 0.6 : 1,
				borderRadius: 8,
				background: hover ? "var(--dsw-alias-interactive-bg-hover)" : "transparent",
				transition: "background 120ms ease, opacity 120ms ease",
			};
			const handlers = {
				role: "button",
				tabIndex: 0,
				"aria-label": ariaLabel,
				"aria-busy": busy,
				title,
				onClick: () => void load(false),
				onKeyDown: activateOnKey(() => void load(false)),
				onMouseEnter: () => setHover(true),
				onMouseLeave: () => setHover(false),
			};

			// The rail keeps the mark and the Vibe allowance as one glyph: the
			// footer is 56px wide there and the numbers live in the tooltip.
			// A failed or signed-out read dims the mark instead of drawing an
			// empty bar that reads as "0% used".
			if (!wide) {
				return h(
					"div",
					{
						...handlers,
						style: {
							...surface,
							width: 36,
							height: 36,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							gap: 2,
						},
					},
					h(MistralVibeMark, { size: 16, active: hasKey !== false && !failed }),
					h(
						"div",
						{
							style: {
								width: 18,
								height: 3,
								borderRadius: 999,
								background: "var(--dsw-alias-bg-layer-2)",
								overflow: "hidden",
							},
						},
						h("div", {
							style: {
								height: "100%",
								width: percent + "%",
								borderRadius: 999,
								background: failed ? "var(--dsw-alias-state-error-primary)" : fill,
								transition: "width 240ms ease",
							},
						}),
					),
				);
			}

			const body = showError
				? h(
						"div",
						{
							style: {
								fontSize: 11,
								lineHeight: "14px",
								color: "var(--dsw-alias-state-error-primary)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							},
						},
						"Mistral Vibe · " + cardErrorText(failure),
					)
				: hasKey === false
					? h(
							"div",
							{
								style: {
									fontSize: 11,
									lineHeight: "14px",
									color: "var(--dsw-alias-label-tertiary)",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								},
							},
							"Mistral Vibe · not signed in — sign in from Settings",
						)
					: h(
							"div",
							{ style: { display: "flex", flexDirection: "column", gap: 5, minWidth: 0 } },
							h(QuotaMeter, { label: "Vibe Code", meter: vibe, failed }),
							h(QuotaMeter, { label: "Studio / API", meter: apiMeter, failed }),
						);

			return h(
				"div",
				{
					...handlers,
					style: {
						...surface,
						width: "100%",
						minWidth: 0,
						display: "flex",
						flexDirection: "column",
						gap: 5,
						padding: "4px 12px 8px",
					},
				},
				h(
					"div",
					{ style: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 } },
					h(MistralVibeMark, { size: 14, active: hasKey !== false && !failed }),
					h(
						"span",
						{
							style: {
								flex: 1,
								fontSize: 11,
								lineHeight: "14px",
								color: "var(--dsw-alias-label-secondary)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							},
						},
						"Mistral Vibe",
					),
					plan !== ""
						? h(
								"span",
								{
									style: {
										flex: "none",
										fontSize: 10,
										lineHeight: "14px",
										color: "var(--dsw-alias-label-tertiary)",
										whiteSpace: "nowrap",
									},
								},
								plan,
							)
						: null,
					stale
						? h("span", {
								title: cardErrorText(failure),
								style: {
									flex: "none",
									width: 6,
									height: 6,
									borderRadius: 999,
									background: "var(--dsw-alias-state-error-primary)",
								},
							})
						: null,
				),
				body,
			);
		}

		/** A cost in dollars, with a floor for the sub-cent case. */
		function formatCost(value) {
			if (typeof value !== "number" || !Number.isFinite(value)) return "—";
			if (value > 0 && value < 0.005) return "<$0.01";
			return "$" + value.toFixed(2);
		}

		/** A token count in the compact form the status row uses. */
		function formatTokens(value) {
			if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "0";
			if (value >= 1e6) return (value / 1e6).toFixed(1) + "M";
			if (value >= 1e3) return Math.round(value / 1e3) + "K";
			return String(Math.round(value));
		}

		/* --- the session cost run ------------------------------------------ */

		/** The dock outlet: one per composer slot, and what scopes the lookup. */
		const COMPOSER_DOCK_ANCHOR = '[data-slot="conversation.composer.dock"]';
		/** The statistics row inside the outlet, where the markup marks it. */
		const COMPOSER_STATS_ROOT = "[data-composer-stats]";
		/** The shipped token-usage pill is the dialog trigger in that row. */
		const COMPOSER_DIALOG_TRIGGER = 'button[aria-haspopup="dialog"]';
		/** Marks the run this plugin owns, so it can only ever remove its own. */
		const SESSION_COST_ATTR = "data-mistral-vibe-session-cost";
		const SESSION_COST_A11Y_ID = "dsh-mistral-vibe-session-cost";

		/**
		 * Appends the cost run to the shipped token-usage pill.
		 *
		 * The pill's own text is the harness's to format, so the figure goes in
		 * beside it — after the cache-hit reading, where the Command Code plugin
		 * puts its own — instead of in a pill of its own, which would sit a whole
		 * gap further right. The lookup is scoped to this entry's dock outlet, so
		 * it can never reach another composer's pill; a missing pill is "no run",
		 * never a document-wide search.
		 *
		 * `sync()` is idempotent and re-reads the target on every call, which is
		 * what lets it self-heal when React remounts the row.
		 */
		class SessionCostRun {
			constructor(doc, scope) {
				this.doc = doc;
				this.scope = scope;
				this.value = undefined;
				this.title = "";
				this.host = undefined;
				this.root = undefined;
				this.text = undefined;
				this.detach = undefined;
			}

			start() {
				if (this.detach !== undefined) return;
				const body = this.doc.body;
				if (body === null || body === undefined) return;
				if (typeof MutationObserver !== "function") return;
				// childList without subtree: streaming text inside the page never
				// wakes it, while a remounted row does.
				const observer = new MutationObserver(() => this.apply());
				observer.observe(body, { childList: true });
				this.detach = () => observer.disconnect();
			}

			sync(value, title) {
				this.value = value;
				this.title = title;
				this.apply();
			}

			dispose() {
				if (this.detach !== undefined) {
					this.detach();
					this.detach = undefined;
				}
				this.remove();
				this.value = undefined;
			}

			apply() {
				if (this.value === undefined) {
					this.remove();
					return;
				}
				if (this.host === undefined || this.host.isConnected !== true) {
					const host = this.resolveHost();
					if (host === null) return;
					this.remove();
					this.build(host);
				}
				if (this.text !== undefined && this.text.textContent !== this.value) this.text.textContent = this.value;
				if (this.root !== undefined && this.root.title !== this.title) this.root.title = this.title;
			}

			resolveHost() {
				const scope = typeof this.scope === "function" ? this.scope() : null;
				if (scope === null || scope === undefined) return null;
				const row = scope.querySelector(COMPOSER_STATS_ROOT) ?? scope;
				const triggers = row.querySelectorAll(COMPOSER_DIALOG_TRIGGER);
				return triggers.length === 0 ? null : triggers[triggers.length - 1];
			}

			build(host) {
				const doc = this.doc;
				const root = doc.createElement("span");
				root.setAttribute(SESSION_COST_ATTR, "");
				const separator = doc.createElement("span");
				separator.textContent = "·";
				separator.setAttribute("aria-hidden", "true");
				separator.style.color = "var(--dsw-alias-separator-primary)";
				separator.style.margin = "0 6px 0 0";
				const value = doc.createElement("span");
				value.textContent = this.value;
				value.style.fontWeight = "500";
				const a11y = doc.createElement("span");
				a11y.id = SESSION_COST_A11Y_ID;
				a11y.style.display = "none";
				a11y.textContent = "Mistral Vibe session cost " + this.value;
				root.appendChild(separator);
				root.appendChild(value);
				root.appendChild(a11y);
				host.appendChild(root);
				if (!host.hasAttribute("aria-describedby")) {
					host.setAttribute("aria-describedby", SESSION_COST_A11Y_ID);
				}
				this.host = host;
				this.root = root;
				this.text = value;
			}

			remove() {
				if (this.root !== undefined) {
					this.root.remove();
					this.root = undefined;
					this.text = undefined;
				}
				if (this.host !== undefined) {
					if (this.host.getAttribute("aria-describedby") === SESSION_COST_A11Y_ID) {
						this.host.removeAttribute("aria-describedby");
					}
					this.host = undefined;
				}
			}
		}

		/**
		 * The session cost run, registered in `conversation.composer.dock`.
		 *
		 * The entry renders one hidden marker: its only job is to put this
		 * composer's dock outlet within reach, so {@link SessionCostRun} can find
		 * that composer's own token pill and append the figure to it. The Host
		 * folds the Session's own `assistant/message` usage at the catalogue's
		 * list prices, and the harness's `tokenUsage` projection — the one the
		 * shipped pill reads — drives the re-read, so the two move together and
		 * nothing polls while a Session is idle. A Session with no priced Mistral
		 * Vibe usage appends nothing at all.
		 */
		function MistralVibeSessionCost(props) {
			const sessionId = typeof props?.sessionId === "string" ? props.sessionId : "";
			const [state, setState] = React.useState(null);
			const alive = React.useRef(true);
			const markerRef = React.useRef(null);
			const runRef = React.useRef(null);
			const usage =
				typeof props?.useProjection === "function" ? props.useProjection("tokenUsage") : undefined;
			const signature =
				usage === undefined || usage === null
					? ""
					: [usage.uncachedInputTokens, usage.cacheReadTokens, usage.outputTokens, usage.cacheWriteTokens]
							.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : 0))
							.join(":");

			const load = React.useCallback(async () => {
				if (sessionId === "") return;
				try {
					const payload = await requestJson(
						SESSION_COST_URL + "?sessionId=" + encodeURIComponent(sessionId),
						{ method: "GET" },
					);
					if (!alive.current) return;
					setState(payload);
				} catch {
					// An unreadable Session is not worth a run of its own.
					if (alive.current) setState(null);
				}
			}, [sessionId]);

			React.useEffect(() => {
				alive.current = true;
				void load();
				return () => {
					alive.current = false;
				};
			}, [load, signature]);

			// One run per mount; it owns the appended nodes and the observer.
			React.useEffect(() => {
				if (typeof document === "undefined") return;
				const run = new SessionCostRun(
					document,
					() => (markerRef.current === null ? null : markerRef.current.closest(COMPOSER_DOCK_ANCHOR)),
				);
				runRef.current = run;
				run.start();
				return () => {
					runRef.current = null;
					run.dispose();
				};
			}, []);

			const cost = state !== null && state.ok === true && typeof state.cost === "number" ? state.cost : 0;
			const tokens = state === null || state.tokens === undefined ? {} : state.tokens;
			const unpriced = state === null || typeof state.unpricedTokens !== "number" ? 0 : state.unpricedTokens;
			const title =
				cost <= 0
					? ""
					: [
							"Mistral Vibe · this session at list prices",
							"input " +
								formatTokens(tokens.input) +
								" · cached " +
								formatTokens(tokens.cacheRead) +
								" · output " +
								formatTokens(tokens.output),
							unpriced > 0 ? "unpriced " + formatTokens(unpriced) + " tokens (no catalogue price)" : "",
						]
							.filter((line) => line.length > 0)
							.join("\n");
			const value = cost <= 0 ? undefined : "≈" + formatCost(cost);

			// Every render hands the run its current figure; an absent figure
			// removes what this plugin appended and leaves the pill as it ships.
			React.useEffect(() => {
				runRef.current?.sync(value, title);
			});

			if (value === undefined) return null;
			return h("span", { ref: markerRef, style: { display: "none" }, "data-mistral-vibe-cost-anchor": "" });
		}

		class SectionBoundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(error) {
				return { error };
			}
			render() {
				if (this.state.error !== null) {
					// The footer seat is 56px wide in the rail; a stack trace
					// there would push the whole foot open.
					if (this.props.compact === true) {
						return h(
							"div",
							{
								style: {
									padding: "4px 12px",
									fontSize: 11,
									lineHeight: "14px",
									color: "var(--dsw-alias-state-error-primary)",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								},
							},
							"Mistral Vibe unavailable",
						);
					}
					return h(
						"div",
						{
							style: {
								padding: 12,
								fontSize: 12,
								whiteSpace: "pre-wrap",
								color: "var(--dsw-alias-state-error-primary)",
							},
						},
						`Mistral Vibe crashed: ${String(
							this.state.error.stack ?? this.state.error,
						)}`,
					);
				}
				return this.props.children;
			}
		}

		const name = "@mars-sea/dsh-mistral-vibe-provider";
		/**
		 * `slots` is the only service the page needs, and the shell always
		 * declares it, so waiting for it can never wedge the renderer boot.
		 */
		const inject = ["slots"];

		/**
		 * The sidebar glyph, registered in `settings.section.icon` under the
		 * same id as the page.
		 *
		 * The package `icon` is only the Plugins-page artwork; the settings nav
		 * goes through this slot, addressed by `id`. The shell owns the button
		 * and keeps its own default glyph when no icon is registered for the
		 * id, so an unmatched id simply never renders.
		 *
		 * Drawn inline in `currentColor` rather than as a bitmap data URI: the
		 * nav sits on a themed surface, and an `<img>` cannot follow it.
		 */
		function MistralVibeMark(props) {
			const edge = typeof props?.size === "number" && props.size > 0 ? props.size : 16;
			const dim = props?.active === false ? 0.72 : 1;
			// Two marks can be mounted at once (the settings nav glyph and the
			// footer card), so the gradient needs its own id per instance: a
			// shared id would make the second mark reference the first one's
			// paint server.
			const uid = typeof React.useId === "function" ? React.useId() : "";
			const gradientId =
				"dsh-mistral-vibe-mark" + (uid === "" ? "" : "-" + uid.replace(/[^a-zA-Z0-9_-]/g, ""));
			// The artwork is icon.svg, verbatim: the same viewBox, the same
			// three-stop gradient and the same two glyph paths. A nav glyph
			// drawn by hand from memory is not the product's mark.
			return h(
				"svg",
				{
					width: edge,
					height: edge,
					viewBox: "0 0 64 64",
					role: "img",
					"aria-hidden": "true",
					style: { display: "block", opacity: dim },
				},
				h(
					"defs",
					null,
					h(
						"linearGradient",
						{ id: gradientId, x1: "0", y1: "0", x2: "1", y2: "1" },
						h("stop", { offset: "0", stopColor: "#FF7A00" }),
						h("stop", { offset: "0.55", stopColor: "#FF3D00" }),
						h("stop", { offset: "1", stopColor: "#B1004B" }),
					),
				),
				h("rect", { x: 2, y: 2, width: 60, height: 60, rx: 14, fill: "url(#" + gradientId + ")" }),
				h(
					"g",
					{
						fill: "none",
						stroke: "#FFFFFF",
						strokeLinecap: "round",
						strokeWidth: 4,
					},
					h("path", { d: "M14 44V22l9 12 9-12v22" }),
					h("path", { d: "M38 22l12 22" }),
					h("path", { d: "M50 22L38 44" }),
				),
			);
		}

		function apply(ctx) {
			const slots = ctx?.slots ?? (typeof ctx?.get === "function" ? ctx.get("slots") : undefined);
			if (slots === undefined || typeof slots.inject !== "function" || typeof slots.register !== "function") {
				return;
			}
			try {
				slots.inject("settings.section", () =>
					slots.register(
						{
							name: "settings.section",
							id: "mistral-vibe",
							order: 56,
							label: () => "Mistral Vibe",
						},
						() => h(SectionBoundary, null, h(MistralVibeSection, null)),
					),
				);
			} catch {
				// A shell without a settings sidebar keeps running with no page.
			}
			// The glyph is only addressable while the page's id exists, so it is
			// registered from its own inject callback and fails independently.
			try {
				slots.inject("settings.section.icon", () =>
					slots.register({ name: "settings.section.icon", id: "mistral-vibe", order: 56 }, MistralVibeMark),
				);
			} catch {
				// A shell that declares no icon slot still shows its default glyph.
			}
			// The sidebar foot: `sidebar.footer.action` is the additive row the
			// shell renders directly above `sidebar.settings`, so the allowance
			// meters sit above the account launcher and the launcher keeps its
			// own registration. A shell without that seat keeps running with no
			// card.
			try {
				slots.inject("sidebar.footer.action", () =>
					slots.register(
						{
							name: "sidebar.footer.action",
							id: "mistral-vibe-quota",
							order: 10,
							label: () => "Mistral Vibe quota",
						},
						(props) => h(SectionBoundary, { compact: true }, h(MistralVibeQuota, props)),
					),
				);
			} catch {
				// No footer seat: the settings page still carries both meters.
			}
			// The composer statistics row: `activity` is order 0 and `usage`
			// (tokens and cache hit) is order 1, so order 2 puts the cost directly
			// beside the cache-hit reading.
			try {
				slots.inject("conversation.composer.dock", () =>
					slots.register(
						{
							name: "conversation.composer.dock",
							id: "mistral-vibe-cost",
							order: 2,
							label: () => "Mistral Vibe session cost",
						},
						(props) => h(SectionBoundary, { compact: true }, h(MistralVibeSessionCost, props)),
					),
				);
			} catch {
				// No composer statistics row: the settings page still carries the prices.
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		exports.MistralVibeSection = MistralVibeSection;
		exports.MistralVibeQuota = MistralVibeQuota;
		exports.MistralVibeMark = MistralVibeMark;
		exports.ModelCell = ModelCell;
		exports.priceLine = priceLine;
		exports.formatPrice = formatPrice;
		exports.MistralVibeSessionCost = MistralVibeSessionCost;
		exports.SessionCostRun = SessionCostRun;
		exports.formatCost = formatCost;
		return module.exports;
	},
});
