# PaperOrbit Project Guide

## Product

Paper Orbit is a private daily paper-reading companion. It recommends 10 high-impact papers per day, supports arXiv search, provides a paper-aware Copilot, and generates structured reading reports.

The production site is:

- `https://paper-orbit-daily.xiangk123.chatgpt.site`

The canonical local checkout is:

- `/Users/xiangkun/Documents/GitHub/PaperOrbit`

The older Codex-generated checkout is retained only as a migration backup.

## Access and privacy

- Sites uses a public outer entry so any visitor can reach ChatGPT sign-in.
- Application authorization is enforced server-side by `app/access-control.ts`.
- Only the configured owner and manager accounts may view the product or call the arXiv and AI APIs.
- Never broaden, remove, or replace the two-person allowlist without explicit user approval.
- Preferences, library state, reading history, affinity data, and generated reports are device-local browser data.
- Do not commit API keys, tokens, `.env` files, browser data, or generated credentials.

## Architecture

- `app/page.tsx`: server-rendered authenticated entry point.
- `app/paper-orbit-client.tsx`: product UI and device-local state.
- `app/access-control.ts`: owner/manager authorization policy.
- `app/api/arxiv/route.ts`: arXiv search and daily feed endpoint.
- `app/api/arxiv/recommendation.ts`: `orbit-v2` multi-signal ranking and diversity logic.
- `app/api/ai/route.ts`: Paper Copilot, report prompts, language consistency, source-overlap guard, and safe preview mode.
- `.openai/hosting.json`: existing OpenAI Sites project binding; preserve its opaque `project_id` exactly.
- `tests/rendered-html.test.mjs`: product, authorization, recommendation, and Copilot quality checks.

## AI behavior

- `OPENAI_API_KEY` enables model-backed Paper Copilot and deep reading reports.
- `OPENAI_MODEL` optionally selects the hosted model.
- Without an API key, the API intentionally returns `mode: "preview"` and avoids pasting or translating the source abstract verbatim.
- Chinese questions should receive coherent Simplified Chinese; English questions should receive English.
- Model output is checked for long source overlap and language drift. A failed answer is rewritten once, then safely falls back to preview mode if it still violates the policy.

## Development

Use the existing npm/vinext project structure and lockfile.

```bash
npm install
npm run dev
npm test
```

Because this repository contains `.openai/hosting.json`, use the installed Sites building and hosting workflows for deployable website changes. Preserve the existing Sites project rather than creating a new one. Build and test before saving and deploying a new version.

## Current state

- Daily recommendation count: 10.
- Recommendation pipeline: `orbit-v2`.
- Authentication: dispatch-owned Sign in with ChatGPT plus a two-account server allowlist.
- Site access mode: public outer login entry with app-level authorization.
- Paper Copilot: monolingual prompt rules, anti-copy constraints, and automatic quality repair are implemented.
- Production AI key: not configured as of 2026-07-15, so the deployed Copilot uses safe preview mode.

