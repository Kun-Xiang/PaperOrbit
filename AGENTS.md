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
- Readers must use their own encrypted OpenAI-compatible API session (public HTTPS Base URL, model ID, and API Key) for model-backed Copilot requests. The explicit loopback-only local development mode may additionally use `http://127.0.0.1` or `http://localhost`; production must retain the public-HTTPS rule. Never route readers to `OPENAI_API_KEY` or another shared paid credential.
- arXiv metadata search uses its public API and has no personal API key. Readers may optionally connect their own Semantic Scholar API key for influence metadata.
- Shared `OPENAI_API_KEY` and `SEMANTIC_SCHOLAR_API_KEY` credentials are legacy administrator fallbacks and may only be used by the configured owner and manager accounts. One deliberate exception: the explicit loopback local-development identity may use the shared `OPENAI_*` environment credential, because a self-hosted local deployment's `.env` belongs to the machine owner. Public production deployments keep the owner/manager-only rule.
- Preferences, library state, reading history, affinity data, explicit paper feedback, candidate cache, and generated reports are device-local browser data namespaced by the authenticated email. Legacy unscoped data may be claimed once by the first privileged account after upgrade.
- Do not commit API keys, tokens, `.env` files, browser data, or generated credentials.

## Architecture

- `app/page.tsx`: server-rendered authenticated entry point.
- `app/paper-orbit-client.tsx`: product UI and device-local state.
- `app/local-user-storage.ts`: per-email browser namespaces and one-time privileged legacy-data claim.
- `app/local-development.ts`: explicit loopback-only development identity and request boundary; it must never authenticate a public or HTTPS production origin.
- `app/access-control.ts`: authenticated-reader access plus owner/manager role policy.
- `app/api/encrypted-session.ts`: shared AES-GCM envelope, account binding, expiration, and secure cookie helpers for personal provider sessions.
- `app/api/arxiv/route.ts`: structured arXiv search, generic daily candidate feed, Atom pagination metadata, and public citation enrichment.
- `app/api/arxiv/session/route.ts`: per-browser Semantic Scholar API key validation and connection lifecycle.
- `app/api/arxiv/research-session.ts`: encrypted Semantic Scholar session plus privileged shared-key isolation.
- `app/api/arxiv/search-query.ts`: environment-neutral search parameter normalization and safe arXiv query generation.
- `app/api/arxiv/recommendation.ts`: named `orbit-v2` baseline weights plus `orbit-v3-local` affinity migration/decay, explicit feedback, deterministic ranking, seed fill, and diversity logic.
- `app/api/ai/route.ts`: full-text arXiv PDF Copilot orchestration, report prompts, failure attribution, language consistency, source-overlap guard, token usage, and safe preview mode.
- `app/api/ai/copilot-transport.ts`: arXiv PDF availability/size preflight plus JSON/SSE Responses transport, provider request IDs, bounded timeouts, redacted upstream errors, and usage extraction.
- `app/api/ai/bounded-response.ts`: byte-limited upstream body reading, oversized-response cancellation, and bounded JSON parsing shared by connection validation and Copilot transport.
- `app/api/ai/session/route.ts`: per-browser OpenAI API key validation, minimal live Responses inference, and encrypted session lifecycle.
- `app/api/ai/openai-session.ts`: AES-GCM session encryption, scoped cookies, and OpenAI configuration.
- `app/api/ai/provider-config.ts`: OpenAI-compatible Base URL, model, and key normalization plus public-HTTPS SSRF protection.
- `app/markdown.ts`: dependency-free Markdown token parser for Copilot answers and reading reports; rendering stays in React elements (no raw HTML), links are limited to http/https, and TeX blocks pass through as monospaced source.
- `.openai/hosting.json`: existing OpenAI Sites project binding; preserve its opaque `project_id` exactly.
- `scripts/dev-local.mjs`: keeps the local site on the default loopback host, creates or reuses a Git-ignored local session secret, and enables only the loopback development mode.
- `tests/paper-orbit-core.test.mjs`: direct query, migration, decay, feedback, deduplication, and deterministic ranking behavior checks.
- `tests/rendered-html.test.mjs`: product, authorization, API contract, privacy boundary, and Copilot quality checks.

## AI behavior

- `PAPER_ORBIT_SESSION_SECRET` enables encrypted, per-browser user-owned OpenAI API sessions. Never commit its value. Explicit local mode may persist only its randomly generated encryption secret in the Git-ignored `.paperorbit` directory; provider URLs, models, and API keys remain inside encrypted HttpOnly cookies.
- Personal sessions may use the official OpenAI API or a user-selected OpenAI-compatible public HTTPS Base URL and model. `npm run dev:local` additionally allows HTTP loopback providers on the same computer; this exception must remain gated by the explicit local-mode flag and a loopback HTTP Paper Orbit origin. Custom providers must implement `/models`, Responses `/responses`, and PDF `input_file` URL support; redirects are rejected. A personal session is sealed only after `/models` succeeds and the selected model returns standard JSON text from a minimal non-streaming `/responses` inference. Stored sessions lacking this live-validation marker are rejected.
- Session validation proves the credential, selected model, and small text Responses path only. It intentionally does not spend PDF tokens. `/models` and validation Responses bodies are byte-limited and cancelled when oversized. Every full-text request separately preflights the server-generated arXiv URL with HEAD plus an eight-byte range request, validates the final arXiv host, PDF signature, content type, and complete size, and only then invokes the model.
- `OPENAI_API_KEY` remains an optional shared server credential for owner/manager accounts only; readers can never consume it. The explicit loopback local-development identity is treated as the machine owner and may use it.
- `OPENAI_MODEL` optionally selects the model; the default is `gpt-5.6`.
- `OPENAI_BASE_URL` optionally points the shared credential at an OpenAI-compatible endpoint. It must satisfy the same public-HTTPS policy; only explicit local mode may use HTTP loopback. A configured-but-invalid value disables the shared credential instead of silently falling back to the official endpoint.
- Model-backed requests attach the validated arXiv PDF as an OpenAI Responses API `input_file`; the client never controls the file host.
- Custom providers receive long PDF requests over SSE streaming when supported; an explicit stream-capability rejection falls back once to the already validated JSON path. Provider success bodies are limited to 4 MiB, error bodies to 32 KiB, and oversized streams are cancelled without retry. Only fast, transient failures receive one automatic retry. Slow full-text requests are never automatically duplicated because doing so may consume the PDF token cost twice.
- Full-text failures are classified independently as arXiv availability/content/size errors, provider authentication/quota/model/protocol/timeout/format/oversize errors, or a provider PDF-ingestion failure. After a retryable provider failure, a tiny text-only probe distinguishes a healthy text service from a broken provider connection. Client-visible diagnostics include a redacted Paper Orbit ID, stage, upstream HTTP status/request ID, transport, timing, attempts, arXiv status/size, and text-probe result; provider request IDs pass a strict character/length and credential-overlap filter, and diagnostics never include credentials or raw provider response bodies.
- Without a personal or shared API key, the API intentionally returns `mode: "preview"` and avoids pasting or translating the source abstract verbatim.
- Chinese questions should receive coherent Simplified Chinese; English questions should receive English.
- Model output is checked for long source overlap and language drift. A failed answer is rewritten once, then safely falls back to preview mode if it still violates the policy.

## Development

Use the existing npm/vinext project structure and lockfile.

```bash
npm install
npm run dev
npm run dev:local
npm test
```

Because this repository contains `.openai/hosting.json`, use the installed Sites building and hosting workflows for deployable website changes. Preserve the existing Sites project rather than creating a new one. Build and test before saving and deploying a new version.

## Current state

- Daily recommendation count: 10.
- Recommendation pipeline: generic server candidate pool plus browser-local `orbit-v3-local` ranking; named `orbit-v2` weights remain the public-signal baseline.
- Authentication: dispatch-owned Sign in with ChatGPT; every authenticated account is a reader, while the two existing accounts retain owner/manager roles.
- Site access mode: public outer login entry with sign-in-gated application access; anonymous API requests remain blocked.
- Paper Copilot: user-owned encrypted OpenAI-compatible Base URL/model/key sessions, live text validation before session creation, per-paper arXiv preflight, SSE full-text transport, bounded transient retry, text-probe failure attribution, message-bound token metadata, conversation context, monolingual prompt rules, anti-copy constraints, automatic quality repair, and unsafe-endpoint rejection are implemented locally.
- Local development: `npm run dev:local` serves `http://localhost:3000` with a loopback-only development identity, permits `http://127.0.0.1:8080/v1`-style local providers, and retains encrypted local provider sessions for at most 90 days by reusing a Git-ignored local encryption secret. Each development process generates a private ingress marker that is added only to non-TLS loopback socket requests after deleting any client-supplied copy; forwarded headers cannot create a local identity. The loopback identity may alternatively chat through the Git-ignored `.env` credential (`OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_BASE_URL`) without a per-browser session. Production remains limited to 12-hour temporary sessions and keeps its existing URL and authentication policy.
- Research metadata: arXiv uses its public API without a key; users may connect an encrypted personal Semantic Scholar key, while shared metadata credentials remain owner/manager-only.
- Production AI key: not configured as of 2026-07-15, so the deployed Copilot uses safe preview mode.

## STAR research workspace (STAR branch)

The `STAR` branch overlays the [STAR](https://github.com/wanghao9610/STAR) research
workflow onto this repository so PaperOrbit can be studied and extended as a research
project. Framework files (MIT, see `LICENCE-STAR`) live under `.agents/skills/`,
`.claude/skills/`, `.cursor/skills/`, and `docs/mds/star-workflow/`; the adoption
record is `metds/adopt.md`.

- Layout mapping: application code stays exactly where it is. `CODE_NAME=app` names
  the core source directory; `worker/`, `db/`, `tests/`, and `scripts/` remain part of
  the application. `metds/` holds methodology notes and plans, `tasks/<plan-name>/`
  holds plan tool scripts, `wkdrs/` holds generated research outputs, `paper/` holds
  manuscript sources, and `datas/`/`inits/` stay empty until an experiment needs them.
- Runtime: the product runtime is Node >= 22.13 via npm and is unchanged. The `.env`
  values `CODE_NAME`/`PYTHON_HOME` exist so the STAR launcher (`execs/run.sh`) can
  resolve an interpreter and export project paths; point `PYTHON_HOME` at any python3
  until a research plan actually needs a dedicated Conda environment.
- Launchers: `bash execs/run.sh --list` shows wrapper scripts. `dev_local` and `test`
  wrap `npm run dev:local` and `npm test` unchanged; the npm commands remain the
  source of truth. Never edit `execs/run.sh`/`execs/update.sh` locally — they sync
  from upstream STAR via `bash execs/update.sh`.
- Research flow: start with `/star-plan-coach` (reads `metds/adopt.md` as the seed),
  then `/star-plan-decomposer`, `/star-plan-executor`, and the paper-lifecycle skills.
  Shared conventions live in `docs/mds/star-workflow/`.
