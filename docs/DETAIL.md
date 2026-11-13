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
  with percent, used-of-total and reset date.

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
