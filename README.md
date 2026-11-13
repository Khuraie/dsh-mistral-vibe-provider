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
- **A live catalogue.** `/v1/models` fills the picker; rows the key cannot use are
  kept visible but marked, so a `tier_not_allowed` 403 is a badge, not a mid-turn
  surprise.
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
**Refresh** on the account card to re-read the meters.

## Routes

| route | effect |
| --- | --- |
| `GET/POST /mistral-vibe/config` | the row as the page needs it (no key values) |
| `POST /mistral-vibe/discover` | merge a live `/v1/models` read into the stored list |
| `GET /mistral-vibe/budget` | plan name plus the Vibe and Studio/API meters |
| `POST /mistral-vibe/sign-in` | start a PKCE attempt, answer the console URL |
| `GET /mistral-vibe/sign-in/status?processId=…` | poll an attempt; on approval stores the key |

All routes are loopback/same-origin by default and accept a configured access
token for an exposed web UI.

## Notes and limits

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
