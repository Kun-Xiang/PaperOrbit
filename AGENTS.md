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
- Preferences, library state, reading history, affinity data, explicit paper feedback, candidate cache, and generated reports are device-local browser data.
- Do not commit API keys, tokens, `.env` files, browser data, or generated credentials.

## Architecture

- `app/page.tsx`: server-rendered authenticated entry point.
- `app/paper-orbit-client.tsx`: product UI and device-local state.
- `app/access-control.ts`: owner/manager authorization policy.
- `app/api/arxiv/route.ts`: structured arXiv search, generic daily candidate feed, Atom pagination metadata, and public citation enrichment.
- `app/api/arxiv/search-query.ts`: environment-neutral search parameter normalization and safe arXiv query generation.
- `app/api/arxiv/recommendation.ts`: named `orbit-v2` baseline weights plus `orbit-v3-local` affinity migration/decay, explicit feedback, deterministic ranking, seed fill, and diversity logic.
- `app/api/ai/route.ts`: full-text arXiv PDF Copilot, report prompts, language consistency, source-overlap guard, token usage, and safe preview mode.
- `app/api/ai/session/route.ts`: per-browser OpenAI API key validation and encrypted session lifecycle.
- `app/api/ai/openai-session.ts`: AES-GCM session encryption, scoped cookies, and OpenAI configuration.
- `.openai/hosting.json`: existing OpenAI Sites project binding; preserve its opaque `project_id` exactly.
- `tests/paper-orbit-core.test.mjs`: direct query, migration, decay, feedback, deduplication, and deterministic ranking behavior checks.
- `tests/rendered-html.test.mjs`: product, authorization, API contract, privacy boundary, and Copilot quality checks.

## AI behavior

- `PAPER_ORBIT_SESSION_SECRET` enables encrypted, per-browser user-owned OpenAI API sessions. Never commit its value.
- `OPENAI_API_KEY` remains an optional shared server credential for the private owner/manager deployment; leave it unset for a public BYOK deployment.
- `OPENAI_MODEL` optionally selects the model; the default is `gpt-5.6`.
- Model-backed requests attach the validated arXiv PDF as an OpenAI Responses API `input_file`; the client never controls the file host.
- Without a personal or shared API key, the API intentionally returns `mode: "preview"` and avoids pasting or translating the source abstract verbatim.
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
- Recommendation pipeline: generic server candidate pool plus browser-local `orbit-v3-local` ranking; named `orbit-v2` weights remain the public-signal baseline.
- Authentication: dispatch-owned Sign in with ChatGPT plus a two-account server allowlist.
- Site access mode: public outer login entry with app-level authorization.
- Paper Copilot: user-owned encrypted API sessions, full arXiv PDF input, conversation context, token usage, monolingual prompt rules, anti-copy constraints, and automatic quality repair are implemented locally.
- Production AI key: not configured as of 2026-07-15, so the deployed Copilot uses safe preview mode.
