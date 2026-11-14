# Mistral Vibe for DeepSeek Harness

**Mistral Vibe** is an unofficial DSH provider route for Mistral's Vibe Code
subscription. It registers the LLM route `mistral-vibe` against
`https://api.mistral.ai/v1`, signs you in with the console's own PKCE flow, and —
unlike the bundle it grew out of — shows the **real allowance meters** for the
Vibe Code budget and the Studio/API budget.

> Community integration, not affiliated with Mistral. Your own Mistral account's
> plan and terms apply; usage made through this route is billed by Mistral to the
> same allowance the Vibe CLI draws on.

## Features

- **PKCE browser sign-in.** Settings → *Mistral Vibe* → *Sign in with Mistral*
  runs `console.mistral.ai/api/vibe/sign-in`, opens the approval page, polls the
  process and, once approved, stores the minted key directly in the credential
  store. No copy-paste.
- **Two real meters.** `GET /v1/billing/budget` returns the Vibe Code allowance and
  the Studio/API allowance separately; the account card draws both, with percent,
  used-of-total, currency and reset date. `GET /v1/billing/subscription` supplies
  the plan name.
- **The meters in the sidebar.** The same two allowances sit in the sidebar foot,
  directly above the account row: each line carries the dollars used of the
  allowance, its percentage, and a bar, with the reset date in the tooltip. Click
  it to re-read; it also refreshes itself every ten minutes.
- **A live catalogue.** `/v1/models` fills the picker; rows the key cannot use are
  kept visible but marked, so a `tier_not_allowed` 403 is a badge, not a mid-turn
  surprise.
- **Prices on the model rows.** Every catalogue model shows its own price line —
  `$0.30 in · $0.007 cached · $1.20 out / 1M tokens` for DeepSeek V4.1 Flash 1017,
  taken from Mistral's model card — so the cost of a model is visible before you
  pick it. A model discovered at runtime has no published price and shows no line.
- **A price badge and a session cost run.** The model picker badges each model
  with its input/output price (`$0.3/$1.2`), and the composer's token-usage pill —
  the one reading `27.3M tok · Cache hit 99%` — gains `· ≈$1.51` at the end of its
  own text run for the Session you are in. It re-reads whenever that pill's
  numbers move. The figure is folded from the Session's own `assistant/message`
  usage at the catalogue's list prices, so a model switch mid-session prices each
  message on the model that actually ran it; messages from other providers are
  never priced here.
- **Per-model thinking levels** mapped onto `reasoning_effort`, with reasoning
  streamed as a thinking block rather than as text.
- **Secrets stay out of YAML.** Keys live in the credential record named by
  `apiKeyEnv` (`MISTRAL_API_KEY` by default); the row keeps only a reference.

## Install

```sh
dsh plugin --profile <profile> add @mars-sea/dsh-mistral-vibe-provider
```

Then **Settings → Mistral Vibe** and either sign in with Mistral or paste a Vibe
Code API key. Hit **Fetch available models** to persist the live catalogue, and
**Refresh** on the account card to re-read the meters. The two meters also appear
in the sidebar foot above the account row, so the remaining allowance is visible
without opening Settings.

## Routes

| route | effect |
| --- | --- |
| `GET/POST /mistral-vibe/config` | the row as the page needs it (no key values) |
| `POST /mistral-vibe/discover` | merge a live `/v1/models` read into the stored list |
| `GET /mistral-vibe/budget` | plan name plus the Vibe and Studio/API meters |
| `GET /mistral-vibe/session-cost?sessionId=…` | what one Session's Mistral Vibe usage cost at list prices |
| `POST /mistral-vibe/sign-in` | start a PKCE attempt, answer the console URL |
| `GET /mistral-vibe/sign-in/status?processId=…` | poll an attempt; on approval stores the key |

All routes are loopback/same-origin by default and accept a configured access
token for an exposed web UI.

## Notes and limits

- **Thinking is on by default.** Mistral's own default for a request that carries
  no `reasoning_effort` is *off*, and a plugin that simply forwards "no level
  chosen" ends up running DeepSeek V4.1 Flash with no reasoning trace at all.
  This route declares `high` as the default level for every model that can think
  (the official DeepSeek route does the same), so a fresh Session thinks unless
  you pick `off` in the model picker.
- **At most 20 images per request, and only the newest screenshots are sent.**
  Mistral answers `400 invalid_request_invalid_args` ("Total number of images
  exceeds the maximum allowed of 20", code 3051) for a longer image history, which
  a screenshot-heavy Session reaches within a few turns. The adapter keeps images
  only in the last two image-bearing messages (`imageHistoryMessages`) and
  replaces older ones with a short `[image omitted …]` note. That is deliberate:
  Mistral's prompt cache is a longest-common-prefix cache, so a transcript that
  keeps rewriting older images loses 15–25 points of cache hit; keeping the
  rewrite at the tail keeps everything before it cached.

- **Tier gating is server-side per model.** On a free plan the live catalogue
  simply omits paid models such as `deepseek-v4-1-flash-1017`, and calling one
  answers `403 {"type":"tier_not_allowed","code":"1910"}`. The picker marks rows
  that never appeared in a live read; nothing is hidden automatically.
- **Thinking models answer with `content` as an array of typed blocks**
  (`{"type":"thinking",…}`), which this adapter normalises into reasoning deltas.
- **`max_tokens` includes reasoning tokens**, so a small cap can end a turn
  before any answer text arrives.
- The bundle is derived from **[dsh-mistral-vibe](https://github.com/meltartica/dsh-mistral-vibe)**
  by Meltartica (MIT): the wire adapter, catalogue, thinking-level contract and
  client shell are theirs. This bundle replaces its settings half with the
  account card and adds the sign-in and billing routes. See `NOTICE`.

## License

MIT © 2026 Meltartica and Mars-Sea — see `LICENSE` and `NOTICE`.
