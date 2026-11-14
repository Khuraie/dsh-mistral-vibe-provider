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
- **Screenshots are downscaled to 1024px / 768 KB.** Mistral's prompt cache only
  serves a request that repeats byte-for-byte, and a large image payload makes
  image-bearing requests miss it entirely: in a measured Session, steps carrying
  a 1–4 MB screenshot fell to 1–26% cache hit while text-only steps stayed at
  86–100%. The default target is therefore smaller than the harness default for
  other providers (1568px / 4 MB). Raise `imageMaxEdge` / `imageMaxBytesKb` for
  finer detail at the cost of cache hits.
- **Sticky routing for the prefix cache.** Mistral's prompt cache lives on the
  backend instance that served a prefix, so a request routed to another instance
  misses even when the prefix is byte-identical — the whole-prefix drops that
  show up a few times per Session. Every request now carries
  `x-affinity: <session id>`, the same header Mistral's own Vibe CLI sends, so a
  Session stays on one instance. It is only sent to `*.mistral.ai` hosts and can
  be turned off with `sendAffinity: false`.
- **Already-seen images are offloaded, so the cache break lands at the tail.**
  Once the model has answered on an image, re-sending it cannot teach it
  anything — it only pushes the transcript's first difference deeper into the
  cached prefix. With `offloadSeenImages` on (the default) the adapter asks for
  those images to be offloaded before replay, so the change happens at the
  recent tail where the cache misses anyway. The newest `imageKeepBatches`
  batches (default 3) keep their pixels, because a visual workflow compares one
  render against the previous one — offloading that previous render is what makes
  a model report that it forgot what it just looked at. Turn the flag off when
  the model must keep re-reading an older screenshot.
- **At most 20 images per request — enforced through the harness's offload
  protocol.** Mistral answers `400 invalid_request_invalid_args` ("Total number
  of images exceeds the maximum allowed of 20", code 3051) for a longer image
  history. Instead of dropping images itself — which rewrites the transcript on
  every request and breaks Mistral's longest-common-prefix cache — the adapter
  fails the step with `IMAGE_OFFLOAD_REQUIRED` and the count it needs. The
  harness's `dsh-compaction-image-offload` plugin records one durable
  `image/offload` selection (the oldest images become placeholders naming each
  attachment) and retries, so the transcript changes once per batch instead of
  once per turn and the cached prefix survives between batches.

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
