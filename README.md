# Paper Orbit

Paper Orbit is a daily paper-reading site for everyone who signs in with ChatGPT. It recommends 10 papers aligned with your research interests each day, supports arXiv search and full-PDF conversations with Paper Copilot, generates reading reports, and tracks your paper library and reading progress.

## Identity, roles, and cost isolation

- Anyone who completes Sign in with ChatGPT can access Paper Orbit; anonymous page and API requests are still rejected.
- The two existing privileged accounts continue to appear as `OWNER` and `MANAGER`; every other signed-in account appears as `READER`.
- Each `READER` must connect their own OpenAI or OpenAI Responses-compatible service—API Base URL, model ID, and API Key—to use the real full-PDF Copilot. Without a personal connection, the product provides only a safe summary preview that consumes no model tokens.
- Even when the server has a shared `OPENAI_API_KEY`, it is available only to OWNER/MANAGER accounts. Readers can never consume the site administrator's model quota.
- arXiv metadata queries use its public API; this retrieval path neither needs nor offers a personal “arXiv API Key.” Users may optionally connect their own Semantic Scholar API Key for more reliable citation and influential-citation signals.
- Personal AI Base URLs, model IDs, API Keys, and Semantic Scholar Keys are stored separately in identity-bound, AES-GCM-encrypted `HttpOnly` cookies. They never enter browser `localStorage`, a database, or Git. Production continues to use temporary sessions lasting at most 12 hours, while explicit local mode keeps encrypted sessions only on the local machine for at most 90 days.
- The library, reading state, research interests, feedback, candidate cache, and reports remain device-local browser data. Storage keys are partitioned by the current ChatGPT account's email, so switching accounts in one browser does not share personal data. Pre-upgrade data from the legacy unscoped namespace may be claimed once, and only by the first existing OWNER/MANAGER account that signs in; legacy keys are retained for rollback.

## Recommendation system (Orbit v3 Local)

Recommendations are explicitly split into two layers: public candidate generation and browser-local personalization.

1. `/api/arxiv?mode=feed` uses a fixed OR query spanning every supported research direction and retrieves up to 60 public candidates from arXiv at once. The request does not read interests, profiles, libraries, reading state, reports, or feedback.
2. The server batch-fetches citation and influential-citation data from Semantic Scholar. Readers may use the public keyless allowance or connect their own Semantic Scholar API Key. If the service is unavailable, the pipeline falls back automatically to native arXiv signals. The API returns a candidate pool and public signals, not any user's final set of 10 papers.
3. In the browser, the full candidate pool is scored using interest relevance, time-decayed local preferences, explicit feedback, recency, influence, and experimental/open-source evidence, followed by deterministic topic-diversity reranking.
4. The final list is deduplicated by arXiv ID and filled with built-in seed papers, always targeting 10 papers. The algorithm never uses `Math.random()`; identical inputs evaluated at the same time produce identical output.
5. Each Today card's “Why this paper?” panel shows 0–100 scores for relevance, local preference, freshness, influence, and evidence strength, together with citation count, influential-citation count, and whether the paper is an exploration item. These values are rule-based and do not call an LLM.

`app/api/arxiv/recommendation.ts` retains the named Orbit v2 baseline weights: relevance 42%, reading preference 12%, freshness 16%, influence 17%, and evidence signals 13%. Orbit v3 Local adds a decaying local profile, explicit feedback, and deterministic diversity selection on top of that baseline.

## Advanced arXiv search

The search endpoint accepts the following structured parameters. It does not accept raw arXiv query syntax assembled by the client.

- `q`: required in search mode; it may also be a direct arXiv ID.
- `field`: `all`, `title`, `author`, or `abstract`; defaults to `all`.
- `match`: `all`, `any`, or `phrase`; defaults to `all`.
- `exclude`, `category`, `fromYear`, and `toYear`: optional excluded terms, category, and submission-year range.
- `sort`: `relevance`, `submittedDate`, or `lastUpdatedDate`; defaults to `relevance`.
- `order`: `ascending` or `descending`; defaults to `descending`.
- `start`: zero-based result offset; `limit`: 1–50 papers per page, defaulting to 20.

The response's `meta` object contains `totalResults`, `start`, `limit`, `hasPrevious`, `hasNext`, and the effective search configuration. Atom values from `opensearch:totalResults`, `startIndex`, and `itemsPerPage` are parsed into stable JSON. Search and feed responses both use `Cache-Control: private, no-store` so user queries are not retained in shared caches.

## Local profile and feedback

- The v3 profile is stored under `paper-orbit:affinity-v3`; every signal records both `value` and `updatedAt`. If no v3 profile exists, data is migrated from `paper-orbit:affinity-v2` and written to v3. The legacy key is not deleted.
- Preferences decay with a 90-day half-life: `effective value = original value × 2^(-elapsed days / 90)`. Saving a paper is a positive signal, starting it for the first time has a higher weight, and generating a report has the highest weight. Removing a paper from the library only partially retracts the save signal.
- Explicit paper feedback is stored under `paper-orbit:paper-feedback-v1`: `Relevant` strongly boosts a paper, `Not relevant` strongly penalizes it, `Too broad` applies a smaller penalty, and `Already read / familiar` lowers only that paper without penalizing its topic. Clicking the current choice again clears it, and every change also offers an immediate undo action.
- Feedback history remains visible in the interest settings, so users retain a way to clear feedback even after a paper leaves the current daily candidate pool. Corrupt local JSON safely falls back to an empty state.

Interests, profiles, explicit feedback, the library, reading history, the candidate-pool cache, and reports remain in a browser namespace isolated by the signed-in email and are never uploaded as feed parameters. Search terms are sent to the ChatGPT-sign-in-protected `/api/arxiv` endpoint only when a user performs a search. Paper Copilot requests continue to follow the separate full-PDF and API Key boundaries described below.

## Local development

Node.js `>=22.13.0` is required.

For the complete local Paper Orbit experience—including a local development identity, encrypted personal API sessions, and loopback model services—run:

```bash
npm install
npm run dev:local
```

Then open `http://localhost:3000`. This command listens only on the local loopback interface and uses `local@paperorbit.dev` as the local development identity. On the first run, it generates a random encryption key with `0600` permissions at the Git-ignored path `.paperorbit/local-session-secret`. Later runs reuse that key, allowing a connected local session to survive a browser close or local-server restart for at most 90 days.

Every local development process also generates an independent ingress marker in memory. The development server first deletes any same-named request header supplied by the browser, then adds the marker back only for a non-TLS loopback connection whose direct Host and listening port match. Forged `X-Forwarded-Host`, `X-Forwarded-Proto`, or internal marker headers therefore cannot turn a public request into a local identity. The marker requires no configuration and is never written to `.env`, a cookie, the repository, or a deployment artifact.

The actual API Base URL, model ID, and API Key are not written to the local secret file. They exist only as AES-GCM ciphertext in a host-only, `HttpOnly`, `SameSite=Strict` browser cookie. The `.paperorbit` directory is excluded from Git and Sites deployment artifacts. Clearing the personal service session in the web UI immediately removes the corresponding cookie. Deleting `.paperorbit/local-session-secret` makes existing ciphertext undecryptable, so the service must then be connected again.

In local mode, the “Connect your research services” panel can use values such as:

```text
API Base URL: http://127.0.0.1:8080/v1
Model ID:     the model ID exposed by your local service
API Key:      your local service key
```

Alternatively, you can skip the web connection flow and configure the local service in the Git-ignored `.env` file:

```text
OPENAI_API_KEY=your local service key
OPENAI_MODEL=the model ID exposed by your local service
OPENAI_BASE_URL=http://127.0.0.1:8080/v1
```

After `npm run dev:local` starts, the loopback identity uses this shared credential directly and the page loads in a connected state. A personal session connected through the web UI still takes precedence over `.env`. This exception applies only in explicit local mode: shared credentials in public deployments remain restricted to OWNER/MANAGER accounts, and `OPENAI_BASE_URL` must be a public HTTPS address. An invalid configured address disables the shared credential instead of falling back and sending the Key to the official endpoint.

The local service must still provide compatible `/models`, `/responses`, and PDF `input_file` support. When “Validate and connect” is selected, Paper Orbit first reads `/models`, then sends one tiny, non-streaming `/responses` text request to the selected model. The encrypted session is saved only if the model actually returns standard JSON text. This validation proves only the Key, model, and text Responses path, consumes a small number of model tokens, sends no paper PDF, and does not replace later PDF-capability validation. The two HTTP loopback hosts are allowed only when the app was started with `npm run dev:local` and the Paper Orbit page itself is running at `http://127.0.0.1` or `http://localhost`. Public production deployments continue to reject HTTP, loopback, and private-network Base URLs.

To override the displayed local identity, set `PAPER_ORBIT_LOCAL_USER_EMAIL` and `PAPER_ORBIT_LOCAL_USER_NAME` before starting the process. These values affect only the local data namespace and displayed identity; they do not create a ChatGPT login.

The standard development workflow remains available:

```bash
npm install
cp .env.example .env
# Edit .env and set PAPER_ORBIT_SESSION_SECRET to at least the output of openssl rand -hex 32
npm run dev
```

Then open `http://localhost:3000`.

Note: `/signin-with-chatgpt`, `/signout-with-chatgpt`, and `/callback` are provided by the Sites dispatch layer and are not local vinext routes. Without a platform-forwarded identity header, a standard `npm run dev` process still redirects to a sign-in route that does not exist locally. `npm run dev:local` provides an explicitly enabled development identity that is restricted to loopback ingress and cannot be activated on a production hostname; it neither replaces nor bypasses production Sign in with ChatGPT.

## Full-PDF Copilot

A website cannot use a personal ChatGPT or Codex subscription as its third-party model API. Paper Orbit uses API quota that is separate from subscriptions: users may connect the [OpenAI Platform API](https://platform.openai.com/) or a third-party service that satisfies the protocol requirements below.

1. In the “Research services” panel, the user enters an API Base URL, model ID, and API Key. The default is `https://api.openai.com/v1`, and third-party OpenAI-compatible services are supported. Paper Orbit first checks `/models`, then performs one real, non-streaming `/responses` text inference with at most 16 output tokens on the selected model. A failure at either step does not create or replace a session. Only after both checks succeed are all three configuration values AES-GCM-encrypted into an identity-bound `HttpOnly`, `SameSite=Strict` browser cookie; they are never written to `localStorage`, a database, or the repository. Production sessions expire when the browser closes or after 12 hours, while local mode started through `npm run dev:local` uses a persistent local cookie lasting at most 90 days. Keys for non-OpenAI services do not need an `sk-` prefix.
2. For every question, the server accepts only a valid arXiv ID and constructs the `https://arxiv.org/pdf/...` URL itself, preventing the client from asking the model to read an arbitrary URL. Before invoking the model, it independently checks arXiv: HEAD establishes status and a preliminary size, followed by a fixed eight-byte Range request that verifies the final host, `%PDF-` signature, content type, and complete file size. The model is not called when the complete size cannot be proven, the signature is invalid, or the file exceeds 50 MB.
3. The server sends the validated full paper PDF to the connected service's `/responses` endpoint through `input_file.file_url`. Ordinary questions and reports use low image detail to conserve tokens; questions about figures, tables, equations, or other visual content automatically use high detail. Custom compatible services prefer SSE streaming to reduce long-request timeouts and fall back to the JSON path validated during connection only when the service explicitly rejects streaming. Successful response bodies are limited to 4 MiB and error bodies to 32 KiB. Abnormally large or unbounded output is cancelled and is not retried automatically.
4. Only fast 502/503/504 responses, dropped connections, or short timeouts receive one automatic retry. A PDF request that has already run for a substantial time is never duplicated automatically, avoiding double billing for the same PDF. A retryable provider failure also runs a text probe capped at 16 output tokens to distinguish “the AI text service is also unavailable” from “text works, but this full-PDF request failed.”
5. Copilot retains the eight most recent conversation turns. Input/output token counts, arXiv verification results, file size, transport, and attempt count are attached to the current answer, so metadata from an earlier successful call is not shown under a later failure. Model output is checked for language drift and long copied passages from the source. A failing answer is rewritten once and then explicitly falls back to a safe summary preview if it still violates policy.

Custom services must support OpenAI-compatible `/models`, Responses `/responses`, and [PDF `input_file` input from an external URL](https://developers.openai.com/api/docs/guides/file-inputs). A service that supports only Chat Completions cannot complete the full-text path. Connection validation confirms `/models` and a real text `/responses` inference; external-URL PDF support is verified independently for every paper question. A “text validated” label in the management panel does not mean the model has read a PDF. Copilot reports “full text validated” only after at least one successful full-PDF request. In production, the Base URL must use a public HTTPS hostname on standard port 443, may not contain credentials, a query, or a fragment, and may not resolve to localhost, a private network, a link-local address, cloud metadata, or another restricted target. Upstream redirects are rejected rather than followed, preventing the Key from being forwarded to a different address. Explicit `npm run dev:local` mode adds only the loopback services `http://127.0.0.1` and `http://localhost` on the current machine.

When a request fails, the chat message shows layered diagnostics instead of blaming every failure on arXiv. Diagnostics include arXiv reachability, file size, the model text probe, compatible-service HTTP status, transport, attempt count, and a Paper Orbit diagnostic ID that can be correlated with server logs. Categories cover unavailable or rate-limited arXiv, invalid PDFs, unverifiable sizes, oversized files, Key or permission failures, quota or rate limits, missing models, incompatible Responses or PDF input, oversized responses, long-request timeouts, empty responses or malformed SSE, and unavailable upstream services. An upstream request ID appears only after strict character, length, and current-credential-overlap checks. Diagnostics never return an API Key or raw upstream error body.

PDF input extracts both text and page images, so long papers may consume many input tokens. File limits and billing rules vary across compatible services. Paper Orbit's backend necessarily handles the API Key while making a request, and the connected provider also receives the arXiv PDF URL, paper metadata, user question, and recent conversation. Connect only to Paper Orbit deployments and model providers you trust.

## Research data APIs

- arXiv: structured searches use the public `https://export.arxiv.org/api/query` endpoint and require no personal Key. Users configure search field, matching mode, category, year range, sorting, count, and their browser-local interest profile in Paper Orbit.
- Semantic Scholar: public keyless calls can provide citation signals but share unauthenticated rate limits. A user may connect a personal Semantic Scholar API Key from the “Research services” panel. After server-side validation, it is encrypted into a separate `HttpOnly` session cookie and is sent in the `x-api-key` request header only when Paper Orbit calls Semantic Scholar.
- A `READER` never uses the server's `SEMANTIC_SCHOLAR_API_KEY`. Like the shared OpenAI Key, that environment credential remains restricted to OWNER/MANAGER accounts.

## Environment variables

- `PAPER_ORBIT_SESSION_SECRET`: enables per-user encrypted OpenAI and Semantic Scholar sessions; it must contain at least 32 characters and can be generated with `openssl rand -hex 32`. In production it must be configured as a deployment secret and must never be committed to Git. If it is not set explicitly, `npm run dev:local` automatically generates and reuses a Git-ignored local key.
- `OPENAI_MODEL`: overrides the default model, `gpt-5.6`, only for administrator-shared connections and older personal sessions that did not select a model explicitly. New personal connections use the model ID entered in the web UI.
- `OPENAI_API_KEY`: optional shared backend Key restricted to OWNER/MANAGER accounts; readers can never fall back to it. Leave it unset for a public deployment where every user should pay for their own usage. The loopback development identity created by `npm run dev:local` is treated as the owner of the local deployment and may chat through this `.env` credential.
- `OPENAI_BASE_URL`: optionally points the shared credential to an OpenAI-compatible service. Production requires a public HTTPS root URL; `npm run dev:local` additionally permits an `http://127.0.0.1` or `http://localhost` loopback service. An invalid configured URL disables the shared credential rather than falling back to the official endpoint.
- `SEMANTIC_SCHOLAR_API_KEY`: optional shared paper-metadata Key, likewise restricted to OWNER/MANAGER accounts. Readers may connect their own Key in the web UI.

Without a personal session or shared `OPENAI_API_KEY`, the endpoint returns only a safe summary preview that consumes no model tokens, and the UI clearly labels the AI as disconnected.

## Common commands

```bash
npm run dev       # Standard local development
npm run dev:local # Full local mode: loopback identity + localhost/127.0.0.1 model API
npm run build     # Create a deployable build
npm run lint      # Run static checks
npm test          # Build and verify product, API, search, and local recommendation behavior
```

## Project structure

- `app/page.tsx`: product entry point protected by Sign in with ChatGPT.
- `app/paper-orbit-client.tsx`: site interactions, the interest profile, and local reading data.
- `app/local-user-storage.ts`: browser storage keys isolated by signed-in email and the one-time claim migration for legacy unscoped data.
- `app/access-control.ts`: reader authorization for every signed-in user plus OWNER/MANAGER role assignment.
- `app/api/encrypted-session.ts`: shared encrypted envelope, email binding, expiration, and cookie boundaries for personal external-service Keys.
- `app/api/arxiv/route.ts`: generic arXiv candidate generation, Semantic Scholar batch influence data, Atom metadata, and advanced search.
- `app/api/arxiv/session/route.ts`: validation, status, and disconnection for personal Semantic Scholar API Keys.
- `app/api/arxiv/research-session.ts`: encrypted Semantic Scholar sessions and isolation of administrator-shared Keys.
- `app/api/arxiv/search-query.ts`: environment-neutral parameter normalization and safe arXiv query generation.
- `app/api/arxiv/recommendation.ts`: the Orbit v2 baseline, local profile migration and decay, feedback semantics, explainable scoring, and deterministic diversity reranking.
- `app/api/ai/route.ts`: OpenAI Responses API orchestration, full arXiv PDF input, continuing conversations, reading reports, and output-quality safeguards.
- `app/api/ai/copilot-transport.ts`: arXiv PDF availability and size preflight plus JSON/SSE Responses transport, timeouts, request IDs, error redaction, and token-usage extraction.
- `app/api/ai/bounded-response.ts`: byte-bounded upstream body reads, oversized-response cancellation, and safe JSON parsing for connection validation and Copilot requests.
- `app/api/ai/session/route.ts`: validation of personal Base URLs, models, and API Keys plus encrypted-session status and disconnection.
- `app/api/ai/openai-session.ts`: AES-GCM session encryption, cookies, legacy-session compatibility, and model configuration.
- `app/api/ai/provider-config.ts`: normalization of OpenAI-compatible addresses, models, and Keys plus public-HTTPS and SSRF protections.
- `.openai/hosting.json`: Sites project binding.

The library, reading state, interests, behavioral profile, explicit feedback, candidate pool, and reports are stored by default in browser `localStorage` namespaced by the signed-in email. Clearing site data removes all of this content.
