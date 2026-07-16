# PaperOrbit Project Guide

## Product

Paper Orbit is a sign-in-gated, multi-user daily paper-reading companion. It recommends 10 high-impact papers per day, supports arXiv search, provides a paper-aware Copilot, and generates structured reading reports.

The production site is:

- `https://paper-orbit-daily.xiangk123.chatgpt.site`

The canonical local checkout is:

- `/Users/xiangkun/Documents/GitHub/PaperOrbit`

The older Codex-generated checkout is retained only as a migration backup.

## Access and privacy

- Sites uses a public outer entry so any visitor can reach ChatGPT sign-in.
- Application authorization is enforced server-side by `app/access-control.ts`.
- Every authenticated ChatGPT user may view the product and call authenticated Paper Orbit APIs. Anonymous requests remain rejected.
- The existing owner and manager emails retain privileged roles; all other authenticated accounts receive the `reader` role.
- Readers must use their own encrypted OpenAI-compatible API session (public HTTPS Base URL, model ID, and API Key) for model-backed Copilot requests. Never route readers to `OPENAI_API_KEY` or another shared paid credential.
- arXiv metadata search uses its public API and has no personal API key. Readers may optionally connect their own Semantic Scholar API key for influence metadata.
- Shared `OPENAI_API_KEY` and `SEMANTIC_SCHOLAR_API_KEY` credentials are legacy administrator fallbacks and may only be used by the configured owner and manager accounts.
- Preferences, library state, reading history, affinity data, explicit paper feedback, candidate cache, and generated reports are device-local browser data namespaced by the authenticated email. Legacy unscoped data may be claimed once by the first privileged account after upgrade.
- Do not commit API keys, tokens, `.env` files, browser data, or generated credentials.

## Architecture

- `app/page.tsx`: server-rendered authenticated entry point.
- `app/paper-orbit-client.tsx`: product UI and device-local state.
- `app/local-user-storage.ts`: per-email browser namespaces and one-time privileged legacy-data claim.
- `app/access-control.ts`: authenticated-reader access plus owner/manager role policy.
- `app/api/encrypted-session.ts`: shared AES-GCM envelope, account binding, expiration, and secure cookie helpers for personal provider sessions.
- `app/api/arxiv/route.ts`: structured arXiv search, generic daily candidate feed, Atom pagination metadata, and public citation enrichment.
- `app/api/arxiv/session/route.ts`: per-browser Semantic Scholar API key validation and connection lifecycle.
- `app/api/arxiv/research-session.ts`: encrypted Semantic Scholar session plus privileged shared-key isolation.
- `app/api/arxiv/search-query.ts`: environment-neutral search parameter normalization and safe arXiv query generation.
- `app/api/arxiv/recommendation.ts`: named `orbit-v2` baseline weights plus `orbit-v3-local` affinity migration/decay, explicit feedback, deterministic ranking, seed fill, and diversity logic.
- `app/api/ai/route.ts`: full-text arXiv PDF Copilot, report prompts, language consistency, source-overlap guard, token usage, and safe preview mode.
- `app/api/ai/session/route.ts`: per-browser OpenAI API key validation and encrypted session lifecycle.
- `app/api/ai/openai-session.ts`: AES-GCM session encryption, scoped cookies, and OpenAI configuration.
- `app/api/ai/provider-config.ts`: OpenAI-compatible Base URL, model, and key normalization plus public-HTTPS SSRF protection.
- `.openai/hosting.json`: existing OpenAI Sites project binding; preserve its opaque `project_id` exactly.
- `tests/paper-orbit-core.test.mjs`: direct query, migration, decay, feedback, deduplication, and deterministic ranking behavior checks.
- `tests/rendered-html.test.mjs`: product, authorization, API contract, privacy boundary, and Copilot quality checks.

## AI behavior

- `PAPER_ORBIT_SESSION_SECRET` enables encrypted, per-browser user-owned OpenAI API sessions. Never commit its value.
- Personal sessions may use the official OpenAI API or a user-selected OpenAI-compatible public HTTPS Base URL and model. Custom providers must implement `/models`, Responses `/responses`, and PDF `input_file` URL support; redirects are rejected.
- `OPENAI_API_KEY` remains an optional shared server credential for owner/manager accounts only; readers can never consume it.
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
- Authentication: dispatch-owned Sign in with ChatGPT; every authenticated account is a reader, while the two existing accounts retain owner/manager roles.
- Site access mode: public outer login entry with sign-in-gated application access; anonymous API requests remain blocked.
- Paper Copilot: user-owned encrypted OpenAI-compatible Base URL/model/key sessions, full arXiv PDF input, conversation context, token usage, monolingual prompt rules, anti-copy constraints, automatic quality repair, and unsafe-endpoint rejection are implemented locally.
- Research metadata: arXiv uses its public API without a key; users may connect an encrypted personal Semantic Scholar key, while shared metadata credentials remain owner/manager-only.
- Production AI key: not configured as of 2026-07-15, so the deployed Copilot uses safe preview mode.
