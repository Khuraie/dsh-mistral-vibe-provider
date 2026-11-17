<p align="center">
  <img src="docs/banner.png" alt="Mistral Vibe for DeepSeek Harness" width="100%">
</p>

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-0.2.1-FF3D00?style=flat-square&labelColor=17171D">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-FF7A00?style=flat-square&labelColor=17171D">
  <img alt="DeepSeek Harness" src="https://img.shields.io/badge/DeepSeek%20Harness-plugin-B1004B?style=flat-square&labelColor=17171D">
  <img alt="platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-2B2B33?style=flat-square&labelColor=17171D">
  <img alt="route" src="https://img.shields.io/badge/route-mistral--vibe-2B2B33?style=flat-square&labelColor=17171D">
</p>

<p align="center">
  A DeepSeek Harness provider plugin for Mistral's Vibe Code subscription.<br>
  PKCE browser sign-in · live model catalogue · real allowance meters · per-Session cost.
</p>

<p align="center">
  <a href="#overview">Overview</a> ·
  <a href="#features">Features</a> ·
  <a href="#requirements">Requirements</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#images">Images</a> ·
  <a href="#routes">Routes</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="#development">Development</a>
</p>

## Overview

This plugin registers the LLM provider route `mistral-vibe` against
`https://api.mistral.ai/v1` and adds the account surface around it: sign-in
through Mistral's own console flow, the two allowance meters, prices on every
catalogue model, and a cost figure for the Session in progress.

It is a community integration. It is not affiliated with Mistral, and usage made
through the route is billed by Mistral against the same allowance the Vibe CLI
draws on, under your own plan and terms.

## Features

**Sign-in.** *Settings → Mistral Vibe → Sign in with Mistral* runs
`console.mistral.ai/api/vibe/sign-in`, opens the approval page, polls the process,
and stores the minted key in the credential store. No copy-paste, and no key value
in the profile YAML.

**Two allowance meters.** `GET /v1/billing/budget` reports the Vibe Code allowance
and the Studio/API allowance separately. Both are drawn on the account card with
percentage, used-of-total, currency and reset date, and again in the sidebar foot
above the account row, where a click re-reads them and a ten-minute timer keeps
them current. `GET /v1/billing/subscription` supplies the plan name.

**A live catalogue with prices.** `/v1/models` fills the model picker. Every
catalogue model carries its own price line, for example
`$0.30 in · $0.007 cached · $1.20 out / 1M tokens` for DeepSeek V4.1 Flash 1017,
taken from Mistral's model card. Rows the key cannot use stay visible but marked,
so a `tier_not_allowed` rejection is a badge rather than a mid-turn surprise.

**Cost, per model and per Session.** The picker badges each model with its
input/output price (`$0.3/$1.2`). The composer's token-usage pill gains
`· ≈$1.51` for the Session in progress, folded from that Session's own
`assistant/message` usage at list prices — so a model switch mid-Session prices
each message on the model that actually ran it. The Settings page adds a Usage
panel with token, cache and cost totals across recent Sessions and the most
expensive Sessions by cost.

**Thinking levels.** Each model's reasoning levels are mapped onto
`reasoning_effort`, and reasoning is streamed as a thinking block rather than as
answer text. The default level is `high` for every model that can think, matching
the official DeepSeek route.

**Managed images.** Screenshots are downscaled, capped at Mistral's 20-image
ceiling through the harness's durable offload protocol, and kept visible by
default so a visual workflow can compare one render against the next. See
[Images](#images).

## Requirements

| | |
| --- | --- |
| DeepSeek Harness | any 0.1.x or 0.2.x host that mounts `dsh-compaction-image-offload` (the shipped base does) |
| Node.js | 20 or newer |
| Mistral account | a Vibe Code subscription, or a Studio/API key with access to the models you pick |

## Installation

The package is not published on npm yet, so install it from the repository.
`dsh plugin` forwards its arguments to `pnpm` inside the profile directory, which
means any spec pnpm accepts works: a path, `file:`, `github:owner/repo`, or a
published version.

From the repository:

```sh
dsh plugin --profile <profile> add github:Khuraie/dsh-mistral-vibe-provider
```

From a clone — the development setup, because the profile links the checkout and
an edit is live after a restart:

```sh
git clone https://github.com/Khuraie/dsh-mistral-vibe-provider
dsh plugin --profile <profile> add ./dsh-mistral-vibe-provider
```

`dsh plugin` installs the dependency only. The launcher stacks the patch layers
listed in `dsh.profile.bundles`, so the package name has to be registered there
too, in `~/.dsh/profiles/<profile>/package.json`:

```json
"dsh": {
  "profile": {
    "bundles": ["…", "@khuraie/dsh-mistral-vibe-provider"]
  }
}
```

The in-app plugin manager performs both steps in one action. Restart DSH
afterwards.

Once the package is published, the shortest form becomes
`dsh plugin --profile <profile> add @khuraie/dsh-mistral-vibe-provider`.

### First run

1. Open **Settings → Mistral Vibe**.
2. Sign in with Mistral, or paste a Vibe Code API key and select **Save key**.
3. Select **Fetch available models** to persist the live catalogue.
4. Select **Refresh** on the account card to read the meters.

## Configuration

All fields live in the plugin's row in the profile patch. Secret values are
references, never literals.

| Field | Default | Purpose |
| --- | --- | --- |
| `displayName` | `Mistral Vibe` | Name shown in the picker and settings |
| `baseURL` | `https://api.mistral.ai/v1` | API base; the affinity header is only sent to `*.mistral.ai` |
| `apiKeyEnv` | `MISTRAL_API_KEY` | Credential reference holding the route key |
| `apiKey` | — | Route key stored in the row; prefer the credential store |
| `studioApiKey` | — | Studio/API key for account reads; falls back to the route key |
| `disabledModels` | `[]` | Model ids hidden from the picker |
| `bypassRewrite` | `true` | Send `x-bili-passthrough: 1` so an in-process rewriter relays the body verbatim |
| `imageMaxEdge` | `1024` | Longest edge, in pixels, of a request image |
| `imageMaxBytesKb` | `768` | Encoded byte budget for one request image |
| `offloadSeenImages` | `false` | Opt-in cache mode; see [Images](#images) |
| `imageKeepBatches` | `3` | In that mode, how many recent image batches keep their pixels |
| `sendAffinity` | `true` | Send `x-affinity` so a Session stays on one backend instance |
| `allowRemote` | `true` | Answer this page when the web UI is exposed over HTTP/S |
| `accessToken` | — | Token required for non-same-origin requests |
| `discoveredModels` | `[]` | Ids a live read reported |
| `servedModels` | `[]` | The whole served surface of the last live read |
| `modelsJson` | — | The model list a previous fetch stored |
| `discoveredInfo` | — | Cached metadata for discovered rows |

## Images

Mistral's prompt cache is a longest-common-prefix cache: it serves a request only
when it repeats the previous one byte for byte. An image payload is the largest
thing that can change, so this route manages images explicitly instead of
forwarding whatever the harness hands it.

### Downscaling

Every image is re-encoded before it is sent: **1024 px** on the longest edge and
**768 KB** encoded. In a measured Session, steps carrying a 1–4 MB screenshot fell
to 1–26% cache hit while text-only steps in the same Session stayed at 86–100%.
The harness default for other providers is 1568 px / 4 MB; this route trades that
detail for cache. Raise `imageMaxEdge` or `imageMaxBytesKb` for finer detail at
the cost of cache hits.

### The 20-image ceiling

Mistral rejects a request carrying more than 20 images with
`400 invalid_request_invalid_args` ("Total number of images exceeds the maximum
allowed of 20", code 3051). The route does not drop images itself — that would
rewrite the transcript on every request and break the prefix cache. It fails the
step with `IMAGE_OFFLOAD_REQUIRED` and the count it needs; the harness's
`dsh-compaction-image-offload` plugin records one durable `image/offload`
selection and retries. The count is retired four at a time, so the retained window
stays between 17 and 20 images instead of collapsing to one.

An offloaded image becomes a named placeholder rather than a silent gap:

```text
[image omitted from this request to stay inside the image limit (not a failed
 read); "render-04.png" (sha256:…)]
```

The "not a failed read" wording is deliberate: without it a model finds the
placeholder where its own `read_image` result used to be and reports the read as
broken, then re-reads the file.

### Keeping images visible

Images stay on the wire up to the ceiling by default, because a visual workflow —
render, look, edit, re-render — needs the previous render to compare against.

`offloadSeenImages` is the opt-in cache mode: once the model has answered on an
image, that image becomes a placeholder, so a new screenshot no longer rolls the
cache back. The cost is that seeing an old image again means reading it again.
`imageKeepBatches` decides how many recent batches stay as pixels in that mode.

### Measured

| Session | Images | Offloads | Cache efficiency |
| --- | --- | --- | --- |
| 52-image judging, earlier batch-cap design | 52 | 4 | 78.8% |
| 192-step visual iteration, current default | 40 | 17 | **95.4%** |

Keeping images and letting the budget retire four at a time measured better than
the aggressive offloading it replaced: fewer transcript rewrites means more of the
prefix survives.

## Routes

| Route | Effect |
| --- | --- |
| `GET/POST /mistral-vibe/config` | The row as the page needs it; no key values |
| `POST /mistral-vibe/discover` | Merge a live `/v1/models` read into the stored list |
| `GET /mistral-vibe/budget` | Plan name plus the Vibe and Studio/API meters |
| `GET /mistral-vibe/session-cost?sessionId=…` | What one Session's usage cost at list prices |
| `GET /mistral-vibe/usage` | Token, cache and cost totals across recent Sessions |
| `POST /mistral-vibe/sign-in` | Start a PKCE attempt and answer the console URL |
| `GET /mistral-vibe/sign-in/status?processId=…` | Poll an attempt; on approval, store the key |

Every route passes DSH's own `connection.requestRejection` check before its
handler runs. A route mounted with `webServer.register` gets none of the host's
Host/Origin admission for free, and without that check a page on another origin
could POST to these routes. Requests that are not same-origin must present the
configured `accessToken`; that token is the one documented exception, because
another page cannot read it.

## Troubleshooting

| Symptom | Cause and remedy |
| --- | --- |
| `401 access_token_required` | The request is not same-origin and no `accessToken` is configured. Set one, or reach the page over loopback. |
| `403 {"type":"tier_not_allowed","code":"1910"}` | The model is not included in your plan. The picker marks rows that never appeared in a live read. |
| `400 … images exceeds the maximum allowed of 20` | The harness's image-offload plugin is not mounted, so `IMAGE_OFFLOAD_REQUIRED` reached ordinary recovery. Use a host that ships it. |
| Settings shows **no key** while chat works | The key is coming from the process environment or a legacy reference. The page reads the same lookup the route does; if they disagree, restart the host. |
| The Usage panel stays on **Reading…** | The first scan prepares up to 100 cold Sessions and takes a few seconds. Later reads are cached for five minutes. |
| `429` with a reset time | The route records `retry-after` and refuses further requests until the reset, rather than spending the quota on certain failures. |

## Development

```sh
node scripts/test-model-pricing.cjs      # catalogue, pricing, images, settings projection
node scripts/test-client-surfaces.cjs    # slots, sidebar card, composer cost run
node scripts/test-deepseek-readiness.mjs # model readiness and wire body
node scripts/test-tool-images.mjs        # tool-result images on the wire
node scripts/test-wire-options.mjs       # stop, effort mapping, stored-model defaults
```

The host half (`lib/index.js`) is plain ESM with no `@deepseek-ai/*` imports; the
client half (`lib/client.js`) is a lazy CommonJS bundle loaded through
`window.__ModuleLoader__`. `docs/DETAIL.md` records the design notes behind the
wire adapter, and `docs/market-entry.yml` is the catalogue submission.

## Credits

The wire adapter, catalogue, thinking-level contract and client shell are derived
from **[dsh-mistral-vibe](https://github.com/meltartica/dsh-mistral-vibe)** by
Meltartica (MIT). This bundle replaces its settings half with the account card and
adds the sign-in, billing and usage routes. See `NOTICE`.

## License

MIT © 2026 Meltartica and Mars-Sea — see `LICENSE` and `NOTICE`.
