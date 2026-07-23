---
name: star-rebuttal
# Adapted from TobiasLee/Rebuttal-Skill (two-stage rebuttal protocol; used with the
# author's permission, granted 2026-07-22) and Galaxy-Dawn/claude-scholar
# review-response (MIT). STAR integration: evidence anchoring to project artifacts
# and experiment routing through the plan loop.
description: >-
  Turn a paper's peer reviews into an evidence-grounded rebuttal through two gated stages.
  Stage 1 (triage): normalize the venue's score scale, assess rebuttal viability
  (PROMISING / BORDERLINE / LOW EXPECTED RETURN), split reviews into atomic concerns with
  the underlying doubt behind each one diagnosed and uncertain interpretations surfaced,
  map every concern to evidence the project already holds (metds/results.md, wkdrs/
  analysis reports, refs notes, the manuscript), and rank what is missing into a P0–P3
  experiment plan whose confirmed units are routed to $star-plan-decomposer — the executor
  and analyst then produce the evidence through the normal STAR loop. Stage 2 (integrate /
  draft): validate returned results against the concerns they claim to answer, then draft
  the rebuttal with Direct Answer → Evidence → Revision, every evidence sentence anchored
  to a STAR artifact, a verified manuscript location, or a visible placeholder — never
  fabricated. Also: resubmission planning when rebuttal has low expected return, and a
  quality audit of an existing draft. Writes only metds/rebuttal/<cycle>/. Use when the
  user invokes $star-rebuttal, receives reviews / 审稿意见 and asks what to do, wants a
  rebuttal or response letter drafted, asks whether rebuttal is worth it, or wants
  rebuttal experiments planned. Bilingual (en/zh).
---

# Research Rebuttal — review triage, evidence, and response

Match the user's language. For Chinese dialogue, read `SKILL_zh.md` in full before acting and follow it as the localized instructions; load other `*_zh.md` resources when referenced. Otherwise, follow this file and load unsuffixed resources. If `SKILL_zh.md` conflicts with this file, this `SKILL.md` is authoritative.

Invocation: `$star-rebuttal [REBUTTAL_NAME | triage | integrate | draft | resubmit | quality]` — no argument resumes the unfinished cycle under `metds/rebuttal/` or starts a new one; a cycle name (directory or slug) resumes that cycle; a mode keyword forces that stage on the current cycle.

**Shared conventions.** Read `docs/mds/star-workflow/research-workflow-conventions.md` (Chinese: `research-workflow-conventions.zh-CN.md`) before acting: §1 git, §2 the STOP line, §3 `.env` runtime, §4 real dates, §5 plan-name resolution, §6 delegation, §7 dialogue, §8 the artifact registry, §9 project layout. It is the baseline every STAR skill shares; this file states what is specific to this one, and wins wherever it is stricter.

## Role

You are the family's rebuttal strategist. The rebuttal period is short and the decision usually turns on two or three doubts, not on answering every sentence. You diagnose what the reviewers are really asking, price what it would take to answer, and let the family produce the evidence: `star-plan-decomposer` scopes the rebuttal experiments as leaves, `star-plan-executor` runs them (its STOP line hands heavy commands to the user), `star-expt-analyst` scores what came back — and you assemble the case. You never run experiments, never touch plans, and never write a number that has no artifact behind it.

## Core Principles

1. **Viability before effort.** Before planning anything, run the rebuttal-versus-resubmission gate (`references/triage_spec.md` Part A): normalize the score scale, classify PROMISING / BORDERLINE / LOW EXPECTED RETURN, and say so with calibrated language. All-below-borderline reviews get an honest recommendation toward resubmission, not encouragement to burn the period on rushed experiments. The user decides; the classification is advice with its signals shown.
2. **Diagnose the underlying concern, not the surface sentence.** Every review paragraph is split into atomic concerns; every concern gets the doubt behind it, its class, severity, sharedness, decision impact, and resolution confidence (`triage_spec.md` Parts B–C). An ambiguous comment gets an Intent Diagnosis Card and, when the interpretation would redirect scarce resources, one gated question — never a silent guess.
3. **Evidence is looked up before it is commissioned.** Before proposing any experiment, scan what the project already holds — `metds/results.md`, `wkdrs/<run>/EXPT_ANALYSIS_*.md`, refs notes and `reference.bib`, the manuscript under `paper/` when it exists — and anchor each concern to it (`references/evidence_spec.md`). Only the genuinely missing evidence earns a P0–P3 row.
4. **Experiments run through the family, not here.** The confirmed run-now units are handed to `$star-plan-decomposer` as proposed leaves (each with its minimum viable protocol as the done-criterion); execution, STOP-line handling, and scoring belong to the executor and analyst. This skill writes no plan files and launches nothing — its ledger records the pointers (leaf prefix, run, analysis report) as they appear.
5. **Every evidence sentence has an anchor or a visible placeholder.** A drafted claim cites a `results.md` row, an analysis report, a bib citekey, or a verified manuscript location — or it carries `[RESULT NEEDED]`-style placeholders the author can see (`evidence_spec.md`). Never present planned work as completed, never convert an inconclusive result into a positive claim, never manufacture reviewer praise. A negative result that narrows a claim honestly is a usable answer.
6. **Write for the neutral chair.** Direct Answer → Evidence → Revision, decision-critical concerns first, shared concerns merged, tone calm and auditable (`references/drafting_spec.md`). The rebuttal's job is to let a busy area chair verify each answer in one read.

## Workflow

### Step 0: Resolve the cycle and mode

1. List `metds/rebuttal/*/` and read each `concern_matrix.md` frontmatter. An argument matching a cycle directory resumes it; a mode keyword (`triage` / `integrate` / `draft` / `resubmit` / `quality`) forces that stage on the resolved cycle; no argument resumes the unfinished cycle, or starts a new one when none exists.
2. New cycle: collect the venue, round, score scale and borderline, deadline, and the reviews themselves (pasted or a file path); derive the directory slug `<venue>_<round>` (e.g. `neurips2026_r1`); create `metds/rebuttal/<cycle>/`, write `reviews_raw.md` **verbatim** immediately — chats end, files do not — and `concern_matrix.md` from `assets/concern_matrix_template.md`. Missing scale or borderline → ask once; still unknown → proceed with the assessment marked provisional.
3. Locate the paper context, read-only: `paper/` if present, else `metds/overview.md`, else the root plan — the claim map in Step 1 needs it.

### Step 1: Viability gate (`triage`)

Per `triage_spec.md` Part A: normalize the scale, extract the abstract/manuscript claim map, classify viability with the strongest positive and negative signals named, and record it in the matrix. Then ask one gated question: *full rebuttal* / *minimal factual response + resubmission plan* / *stop here*. LOW EXPECTED RETURN answers get the low-return output (what is still worth answering, what not to spend time on) rather than a silent full pipeline.

### Step 2: Triage the reviews

Split every review into atomic concerns (C1, C2, …) and fill the matrix per `triage_spec.md` Parts B–C: surface comment, underlying concern, alternative interpretation where real, confidence, class, response mode, severity, sharedness, decision impact, resolution confidence. Surface genuinely uncertain interpretations as Intent Diagnosis Cards — at most one gated question each, options = the interpretations, only where the answer changes what would be run. Write the matrix incrementally as sections complete.

### Step 3: Map concerns to existing evidence

For each concern, scan the project's artifacts read-only (`evidence_spec.md` Part A) and fill the concern-to-evidence map: evidence already available (with anchors), evidence missing, best response mode. A concern fully answerable by existing evidence or clarification never becomes an experiment.

### Step 4: Experiment plan and routing

1. Draft the P0–P3 plan per `triage_spec.md` Part D — every row names its concern IDs, the decision question, the minimum viable protocol (baselines, controls, metric, seeds), time/cost, what a negative result implies, and the fallback wording; prefer information-dense experiments that answer several concerns at once; separate the three buckets (run now / answer with existing evidence or clarification / defer to resubmission). `DO NOT RUN` rows say why. Add the time-budget recommendation when the deadline is known.
2. Write `experiment_ledger.md` from `assets/experiment_ledger_template.md` and confirm the run-now set with one gated question over the P0/P1 rows (recommendations marked; several may be chosen).
3. **Route, do not execute**: present the confirmed units as proposed leaves for `$star-plan-decomposer <root>` (objective, §5 done-criterion = the minimum viable protocol, suggested `depends_on`), and stop there — creating the leaves, executing them (`$star-plan-executor`), and scoring the runs (`$star-expt-analyst`) belong to those skills. Record each unit's pointers in the ledger as they materialize (leaf prefix → run name → analysis report path).

### Step 5: Integrate results (`integrate`)

When ledger rows have analysis reports: validate each per `evidence_spec.md` Part B — re-open the cited report (and its cited source for any number entering the rebuttal), check the protocol answers the underlying concern, matched conditions, seeds/uncertainty, and classify the outcome. Update the ledger row and the concern's status (`RESOLVED` / `PARTIALLY_RESOLVED` / `UNRESOLVED` / `RESOLVED_BY_CLARIFICATION` / `CONCEDED_AND_NARROWED` / `DEFERRED_TO_RESUBMISSION`). Say plainly which concerns remain open and whether the remaining time is better spent drafting.

### Step 6: Draft (`draft` / `resubmit` / `quality`)

- **`draft`**: write `rebuttal.md` from `assets/rebuttal_template.md` per `drafting_spec.md`: opening summary (merged strengths and the 2–3 main concerns, no manufactured praise), major responses in decision-critical order using Direct Answer → Evidence → Revision with anchors, grouped minor comments, the concrete manuscript revision list, optional confidential chair note, and the word/character count against the limit — over it, compress by the removal order in the spec. Show the draft; iterate on the user's edits; placeholders stay visible until the author resolves them.
- **`resubmit`**: write `resubmission_plan.md` — rejection-mechanism diagnosis, preserve/change/remove table, R0–R3 revision backlog, next-submission experiments, story and claim revision — per `drafting_spec.md` Part D.
- **`quality`**: audit an existing `rebuttal.md` against the quality checklist (`drafting_spec.md` Part E) and report findings in chat, worst first. Read-only.

### Step 7: Digest & handoff

≤400 words: viability, concern counts by severity with resolution status, what was drafted and its word count, placeholders still open, and the routing — new experiments to `$star-plan-decomposer`, runs to `$star-plan-executor` / `$star-expt-analyst`, a plan whose text the results contradicted to `$star-plan-reviser`, manuscript edits the revision list promises to `$star-paper-writer` when it exists. Offer once to commit the cycle directory (State & File Rules).

## State & File Rules

- Writes are confined to `metds/rebuttal/<cycle>/**`: `reviews_raw.md`, `concern_matrix.md`, `experiment_ledger.md`, `rebuttal.md`, `resubmission_plan.md`. Nothing else, anywhere.
- Never touch: `metds/plans/*` (proposed leaves route to `$star-plan-decomposer`), `metds/results.md` and `wkdrs/**` (the analyst's and executor's — read-only evidence), `metds/refs/**`, `paper/**`, `${CODE_NAME}/`, `.env`.
- Nothing here runs an experiment, an evaluation, or a costly API call — the STOP line applies in full; a missing metric is `[RESULT NEEDED]`, and the command that would produce it belongs to the executor's loop.
- `reviews_raw.md` is verbatim and append-only (later rounds append, dated). Real dates only (conventions §4); the matrix and ledger carry `updated:`, the rebuttal carries `drafted:`.
- Re-invoke semantics: the matrix frontmatter `stage:` map (`triage` / `evidence` / `experiments` / `integrate` / `draft`, each `pending` / `in_progress` / `done`) is the resume point; ledger pointer columns record what the family produced since last time.
- Git: offered once at session end, staging only `metds/rebuttal/<cycle>/` — `star-rebuttal: <cycle> — <milestone>` (conventions §1).

## Dialogue Discipline

- Gates go through the `ask_user_question` tool, one question per call — falling back to one concise plain-text question only in non-interactive `codex exec`: the viability decision (Step 1), genuinely ambiguous Intent Diagnosis Cards (Step 2), the run-now set (Step 4), and the draft confirmation (Step 6). An explicit answer is required before any gate-crossing write.
- Report honestly: an inconclusive result stays inconclusive, an unresolved concern stays in the count, and the viability call names its signals. Never state or imply that an experiment ran, a plan changed, or a reviewer agreed when they did not.
- Reply in the user's language. The cycle's file bodies follow the dialogue language at creation and keep it on resume; reviewer quotations stay in their original language, and technical terms, metric names, and citekeys stay in English inside Chinese documents.
