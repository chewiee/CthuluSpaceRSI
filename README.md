# CthuluSpaceRSI 🐙

The nostalgic CthuluSpace arcade game, rewritten by its own players. Devour planets
to earn **Favor**, then spend it at the **Altar** on rituals: plain-language requests
that an AI agent turns into real code changes, which go live for everyone once they
pass automated checks. (The first free ritual can rename the world to *R'lyeh Rising*.)

The original game stays untouched at cthuluspace.rannabansal.com.

## How it fits together

```
game/               the game. The ONLY thing rituals may change.
platform/worker/    Cloudflare Worker API: players, Favor, ritual queue, budgets
platform/client/    in-game overlay (Favor, Altar, Chronicle), injected at build
platform/schema.sql D1 database schema
ritual/             GitHub Actions runner scripts + the agent's rules
scripts/            build (game + overlay + CSP) and the ritual diff gatekeeper
tests/smoke.mjs     headless Chromium smoke test every ritual must pass
```

**Ritual lifecycle** (`.github/workflows/ritual.yml`, every 6 hours):

1. **summon**: claim the oldest queued ritual if the budget allows; run Claude Code
   headless in `game/` with file tools only (no shell, no web), a $ cap and a turn cap.
2. **judge** (no secrets): the gatekeeper rejects anything outside `game/`, big diffs,
   network/storage/eval APIs and external URLs; then the smoke test boots the game,
   eats planets, dies, and checks for errors and the Favor hooks.
3. **ascend**: open a PR, squash-merge it, deploy, tag `era-<id>`.
4. **settle**: anything that fails is marked failed/rejected and the Favor is refunded.

## Guardrails

| What | Default | Where |
| --- | --- | --- |
| Per-ritual spend cap | $0.50 (`--max-budget-usd`) | `wrangler.jsonc` vars |
| Rituals per day | 2 | `wrangler.jsonc` vars |
| Monthly budget | $10, queue stops with 1.5× headroom | `wrangler.jsonc` vars |
| Model | `claude-sonnet-5-5`, medium effort, 25 turns | `wrangler.jsonc` vars |
| Ritual cost | 100 Favor (refunded if it fails) | `wrangler.jsonc` vars |
| Favor earning | ≤1 per planet, ≤1 per 1.5s, ≤30/run, ≤150/day | worker + vars |
| Prompt length | 300 chars, one pending ritual per player | `wrangler.jsonc` vars |
| Hard backstop | spend limit on the Anthropic workspace | Claude Console (you) |

Favor is computed by the platform, not from the in-game score, so a ritual that
changes scoring can't mint Favor.

## Running the world

- **Pause rituals:** `curl -X POST https://rlyeh.rannabansal.com/api/admin/pause -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"paused":true}'`
- **Reject a queued ritual (refunds):** `POST /api/admin/reject` with `{"id": 12, "note": "why"}`
- **Undo a bad ritual:** Actions → Rollback → `era-11` (or `game-v0` for the original)
- **Run a ritual now:** Actions → Ritual → Run workflow

## Local development

```bash
npm install && npx playwright install chromium
npm run db:init:local
npm run dev          # http://127.0.0.1:8787 (needs .dev.vars, see SETUP.md)
npm run smoke        # the same smoke test CI runs
```
