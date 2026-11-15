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
- **Screenshots that do not wreck the cache.** Images are downscaled to
  1024px / 768 KB, capped at Mistral's 20-image ceiling through the harness's
  durable offload protocol, and kept visible by default so a visual workflow can
  compare one render against the next. See [Images](#images).
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

## Images

Screenshots are the one input that can wreck Mistral's prompt cache, so this
route manages them rather than forwarding whatever the harness hands it. The
cache is a longest-common-prefix cache: it only serves a request that repeats the
previous one byte for byte, and an image payload is the biggest thing that can
change.

### Downscaling

Every image is re-encoded before it is sent: **1024px** on the longest edge,
**768 KB** encoded. In a measured Session, steps carrying a 1–4 MB screenshot
fell to 1–26% cache hit while text-only steps in the same Session stayed at
86–100%. The harness default for other providers is 1568px / 4 MB; this route
trades that detail for cache.

| setting | default | effect |
| --- | --- | --- |
| `imageMaxEdge` | `1024` | longest edge, in pixels, of the image sent |
| `imageMaxBytesKb` | `768` | encoded byte budget for one request image |

### The 20-image ceiling

Mistral refuses a request carrying more than **20 images** —
`400 invalid_request_invalid_args`, "Total number of images exceeds the maximum
allowed of 20", code 3051. The route does not drop images itself: that would
rewrite the transcript on every request and break the prefix cache. Instead it
fails the step with `IMAGE_OFFLOAD_REQUIRED` and the count it needs, and the
harness's `dsh-compaction-image-offload` plugin records one durable
`image/offload` selection before retrying. The count is retired **four at a
time**, so the retained window stays between 17 and 20 images instead of
collapsing to one.

An offloaded image becomes a named placeholder rather than a silent gap:

```text
[image omitted from this request to stay inside the image limit (not a failed
 read); "render-04.png" (sha256:…)]
```

The "not a failed read" wording is load-bearing: without it a model finds the
placeholder where its own `read_image` result used to be and reports the read as
broken, then re-reads the file.

### Keeping images visible

By default images stay on the wire up to the ceiling, because a visual workflow —
render, look, edit, re-render — needs the previous render to compare against.
`offloadSeenImages` is the **opt-in** cache mode, off by default the way Command
Code ships its equivalent: once the model has answered on an image, that image
becomes a placeholder, so a new screenshot no longer rolls the cache back. The
cost is that seeing an old image again means reading it again.

| setting | default | effect |
| --- | --- | --- |
| `offloadSeenImages` | `false` | opt-in: retire images the model has already answered on |
| `imageKeepBatches` | `3` | in that mode, how many recent image batches keep their pixels |

### Measured

| Session | images | offloads | cache efficiency |
| --- | --- | --- | --- |
| 52-image judging, batch-cap design | 52 | 4 | 78.8% |
| 192-step visual iteration, current default | 40 | 17 (2 after the fix) | **95.4%** |

Keeping images and letting the budget retire four at a time measured *better*
than the aggressive offloading it replaced: fewer transcript rewrites means more
of the prefix survives.

## Notes and limits

- **Thinking is on by default.** Mistral's own default for a request that carries
  no `reasoning_effort` is *off*, and a plugin that simply forwards "no level
  chosen" ends up running DeepSeek V4.1 Flash with no reasoning trace at all.
  This route declares `high` as the default level for every model that can think
  (the official DeepSeek route does the same), so a fresh Session thinks unless
  you pick `off` in the model picker.
- **Images are managed, not forwarded.** Downscaling, the 20-image ceiling, the
  durable offload protocol and the opt-in cache mode are all in
  [Images](#images) above.
- **Sticky routing for the prefix cache.** Mistral's prompt cache lives on the
  backend instance that served a prefix, so a request routed to another instance
  misses even when the prefix is byte-identical — the whole-prefix drops that
  show up a few times per Session. Every request now carries
  `x-affinity: <session id>`, the same header Mistral's own Vibe CLI sends, so a
  Session stays on one instance. It is only sent to `*.mistral.ai` hosts and can
  be turned off with `sendAffinity: false`.
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
