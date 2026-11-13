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
		const SIGN_IN_URL = "/mistral-vibe/sign-in";
		const SIGN_IN_STATUS_URL = "/mistral-vibe/sign-in/status";

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

/** One model row: name and badges on top, capabilities beneath. */
function ModelCell(props) {
  const model = props.model;
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
													Array.isArray(state.discoveredModels) &&
													state.discoveredModels.length > 0 &&
													state.discoveredModels.indexOf(model.id) === -1,
											}),
											h("span", { style: monoStyle }, model.id),
										),
									),
								),
					),
				),
			);
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
						{ id: "dsh-mistral-vibe-mark", x1: "0", y1: "0", x2: "1", y2: "1" },
						h("stop", { offset: "0", stopColor: "#FF7A00" }),
						h("stop", { offset: "0.55", stopColor: "#FF3D00" }),
						h("stop", { offset: "1", stopColor: "#B1004B" }),
					),
				),
				h("rect", { x: 2, y: 2, width: 60, height: 60, rx: 14, fill: "url(#dsh-mistral-vibe-mark)" }),
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
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		exports.MistralVibeSection = MistralVibeSection;
		exports.MistralVibeMark = MistralVibeMark;
		return module.exports;
	},
});
