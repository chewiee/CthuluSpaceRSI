# First-time setup

Everything below is one-off. Steps marked **(you)** involve accounts, keys or money,
so they're yours to do.

## 1. Anthropic key with a hard spend limit (you)

1. In the Claude Console, create a **new workspace** just for this (e.g. `cthuluspace-rsi`).
2. Set that workspace's **monthly spend limit to $10**. This is the backstop that holds
   even if every other guardrail has a bug.
3. Create an API key in that workspace. It goes into GitHub secrets only, never into
   the repo or the Worker.

## 2. Cloudflare

```bash
npx wrangler login
npx wrangler d1 create cthuluspace-rsi        # paste database_id into wrangler.jsonc
npm run db:init:remote
npx wrangler secret put RUNNER_TOKEN           # long random string, e.g. `openssl rand -hex 32`
npx wrangler secret put ADMIN_TOKEN            # a different long random string
npm run deploy                                 # first deploy; creates rlyeh.rannabansal.com
```

Create a Cloudflare API token (you) with *Workers Scripts: Edit*, *D1: Edit* and
*Workers Routes / Custom Domains* for rannabansal.com, for GitHub Actions to deploy with.

## 3. GitHub

```bash
gh repo create chewiee/CthuluSpaceRSI --public --source . --push
git push origin game-v0
```

Then in the repo settings:

- **Secrets:** `ANTHROPIC_API_KEY`, `RSI_RUNNER_TOKEN` (same value as the Worker's
  `RUNNER_TOKEN`), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Variables:** `RSI_URL` = `https://rlyeh.rannabansal.com`
- **Actions → General → Workflow permissions:** allow GitHub Actions to create and
  approve pull requests.
- Don't require reviews on `main`, because rituals merge themselves once checks pass.
  To switch to approving each one yourself later, require a review on `main` and
  remove the `gh pr merge` line in `ritual.yml`.

## 4. Smoke-test the pipeline

Play a few runs, give yourself Favor for a test ritual, and trigger it by hand:

```bash
npx wrangler d1 execute cthuluspace-rsi --remote --command "UPDATE players SET favor = 100 WHERE id = '<your player id>'"
gh workflow run Ritual
```

Your player id is in the browser's localStorage under `rsi.token` (the part before the dot).
