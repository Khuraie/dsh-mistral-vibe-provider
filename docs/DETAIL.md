# Mistral Vibe

A provider route for Mistral's Vibe Code subscription, with the account surface
the Mistral API actually supports.

## What it adds

- **Route `mistral-vibe`** — chat, streaming, tool calls and usage against
  `https://api.mistral.ai/v1/chat/completions`, with per-model thinking levels
  mapped onto `reasoning_effort` and reasoning streamed back as a thinking block.
- **PKCE browser sign-in** — the console's own flow
  (`console.mistral.ai/api/vibe/sign-in`) opens in a tab; approving it stores the
  minted key in the DSH credential store, so nothing is pasted into a form.
- **Vibe vs API budget meters** — `/v1/billing/budget` reports the Vibe Code
  allowance and the Studio/API allowance separately; the account card shows both
  with percent, used-of-total and reset date, and the sidebar foot shows the same
  two meters — dollars used of the allowance, percentage and bar — above the
  account row, so the remaining allowance is visible without opening Settings.
- **Prices on every model row** — each catalogue model carries its own price line
  (`$0.30 in · $0.007 cached · $1.20 out / 1M tokens` for DeepSeek V4.1 Flash
  1017), so the cost is visible where the models are listed. DSH's model contract
  has no price field, so this is drawn by the plugin rather than by the picker.
- **A price badge and a session cost run** — the model picker badges each model
  with its input/output price, and the composer's token-usage pill gains
  `· ≈$1.51` at the end of its own text run, re-read whenever those numbers move.
  The figure is folded from that Session's own usage at the catalogue's list
  prices; other providers' messages are never priced here.

## What to keep in mind

- Mistral's default for a request with no `reasoning_effort` is *off*, so a route
  that forwards "nothing chosen" silently runs DeepSeek V4.1 Flash without a
  reasoning trace. This bundle declares `high` as the default level for every
  model that can think, matching the official DeepSeek route; `off` stays one
  pick away in the model picker.
- Request images are downscaled to 1024px / 768 KB by default. Mistral's prompt
  cache only serves a request that repeats byte-for-byte, and a large image
  payload makes image-bearing requests miss it: measured Sessions dropped to
  1–26% cache hit on steps carrying a 1–4 MB screenshot while text-only steps
  stayed at 86–100%. `imageMaxEdge` / `imageMaxBytesKb` trade detail for cache.
- Mistral refuses a request carrying more than 20 images (`400
  invalid_request_invalid_args`, code 3051). The adapter does not drop images
  itself: it fails the step with `IMAGE_OFFLOAD_REQUIRED` and the count, and the
  harness's `dsh-compaction-image-offload` plugin records a durable
  `image/offload` selection before retrying. One batch rewrite per overflow keeps
  Mistral's longest-common-prefix cache warm, where a per-request rewrite would
  break it every turn.

## Getting started

1. Install the bundle and open **Settings → Mistral Vibe**.
2. **Sign in with Mistral** (or paste a Vibe Code key).
3. **Fetch available models** to persist the live catalogue.
4. Pick a model under **Mistral Vibe** in the model picker.

## What to keep in mind

- Tier gating is decided by Mistral per model: a free plan's catalogue omits
  paid models, and calling one directly answers `403 tier_not_allowed` (`code
  "1910"`). The picker keeps such rows visible but marked rather than hiding
  them, so a plan upgrade is one **Fetch available models** away.
- The key is read from the credential record named by `apiKeyEnv`
  (`MISTRAL_API_KEY` by default), so a key stored by an earlier Mistral bundle
  keeps working unchanged.
- This is an unofficial integration. Your plan and Mistral's terms apply, and
  usage through this route draws on the same Vibe Code allowance the official
  CLI uses.
- Derived from [dsh-mistral-vibe](https://github.com/meltartica/dsh-mistral-vibe)
  by Meltartica (MIT); see `NOTICE` in the package.
