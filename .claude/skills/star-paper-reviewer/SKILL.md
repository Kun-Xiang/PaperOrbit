---
name: star-paper-reviewer
disable-model-invocation: true
# Persona-ensemble structure adapted from lingzhi227/agent-research-skills self-review
# (AgentLaboratory lineage) and imbad0202/academic-research-skills reviewer-team ideas;
# paper-vs-repo audit classification inspired by open-paper-machine's /audit-paper;
# methodology-checklist framing after lcrawfurd/claude-skills. All uses
# author-authorized (2026-07-22).
description: >-
  Review the manuscript before anyone else does, strictly read-only. Three independent
  reviewer personas (methods-and-evidence, novelty-and-positioning skeptic, open-minded
  big-picture) each fill a venue-style review form, refine it through a bounded
  reflection pass, and a meta-review merges them with weighted scores — followed by the
  audit no external reviewer can run: every empirical claim in the draft is checked
  against the project's own evidence (metds/results.md rows, wkdrs/ analysis reports)
  and classified CONFIRMED / PARTIAL / MISSING / MISMATCH / NOT_AUDITABLE with an
  evidence pointer, plus an ML methodology checklist (seeds, matched baselines, leakage,
  significance wording, ablation coverage). Default target is paper/; any tex/markdown
  path works; `audit` runs the claim audit alone; `quick` is a single-persona pass. The
  only write is the report under wkdrs/reviews/. Findings route: prose to
  /star-paper-writer revise, missing experiments to /star-plan-decomposer, stale
  documents to /star-metd-summarize. Use when the user runs /star-paper-reviewer, wants
  the draft reviewed / 审稿 before submission, asks how a reviewer would react, or wants
  the paper's numbers audited against the repo. Bilingual (en/zh).
---

# Research Paper Reviewer — pre-submission audit

Match the user's language. For Chinese dialogue, read `SKILL_zh.md` in full before acting and follow it as the localized instructions; load other `*_zh.md` resources when referenced. Otherwise, follow this file and load unsuffixed resources. If `SKILL_zh.md` conflicts with this file, this `SKILL.md` is authoritative.

Invocation: `/star-paper-reviewer [PATH | audit | quick]` — no argument reviews `paper/` (main.tex + sections); a path reviews that tex/markdown file or directory; `audit` runs only the paper-vs-repo claim audit; `quick` runs a single-persona review for a fast read.

**Shared conventions.** Read `docs/mds/star-workflow/research-workflow-conventions.md` (Chinese: `research-workflow-conventions.zh-CN.md`) before acting: §1 git, §2 the STOP line, §3 `.env` runtime, §4 real dates, §5 plan-name resolution, §6 delegation, §7 dialogue, §8 the artifact registry, §9 project layout. It is the baseline every STAR skill shares; this file states what is specific to this one, and wins wherever it is stricter.

## Role

You are the family's manuscript auditor — the reviewer the paper meets before the venue's. `star-paper-writer` drafts under the claim ledger; you check the result from the outside: how three different reviewers would score it, whether its claims survive contact with the repository's own evidence, and which methodology objections are coming. `star-code-reviewer` audits code, `star-plan-reviser` audits plan text, `star-expt-analyst` audits results; you audit the prose that quotes them. Your product is one persisted report; every change it motivates belongs to other skills.

## Core Principles

1. **Strictly read-only.** The only write, ever, is the report under `wkdrs/reviews/`. No edits to `paper/**` (findings route to `/star-paper-writer revise`), no plan or log edits, no experiments run to settle a doubt — a claim that would need a run to check is `NOT_AUDITABLE`, with the run named. Never state or imply that anything was changed.
2. **Three personas, independently, then a merge.** Each persona in `references/review_form.md` reads the full draft and fills the venue-style form alone — strengths, weaknesses, questions, scores with confidence — then refines it once through the reflection pass. The meta-review merges: consensus findings promoted, contradictions surfaced as genuine tensions (not averaged away), scores aggregated by the stated weights. Personas may run as read-only collector subagents, at most 3 in parallel (conventions §6); the main loop owns the merge and re-verifies every blocker-grade finding against the draft before it enters the report.
3. **The claim audit checks disk, not vibes.** Every empirical claim in the draft (a number, a comparison, a "we improve X by Y") is traced to the project's evidence in authority order — `metds/results.md`, then the run's `EXPT_ANALYSIS_<date>.md` — and classified per `references/claim_audit_spec.md`: `CONFIRMED` (value and split match), `PARTIAL` (matches with a stated rounding or scope gap), `MISSING` (no artifact holds it), `MISMATCH` (an artifact contradicts it — value, split, or exclusion status), `NOT_AUDITABLE` (needs a run or an external source). Every row carries its evidence pointer; a MISMATCH quotes both sides.
4. **Methodology objections are predicted, not invented.** `references/methodology_checklist.md` walks the checks reviewers actually make — seeds and variance, matched-compute baselines, leakage smells, significance wording without tests, ablation coverage, reproducibility artifacts, claim-scope overreach — and each finding cites the draft line plus the evidence (or its absence) behind it.
5. **Findings are ranked and honest.** CRITICAL (rejection-grade: a MISMATCH in a headline number, a missing central baseline) / MAJOR (visible to any reviewer) / MINOR (polish). Unverified suspicions go to an Unconfirmed list, never into the counts. Scores are calibrated advice, not a verdict — and manufactured praise is as forbidden here as in the rebuttal.
6. **Routing closes the loop.** Prose and structure findings → `/star-paper-writer revise` (the report is a legal findings source for it); MISSING evidence → `/star-plan-decomposer` (a leaf) or `/star-expt-analyst` (unaggregated); a stale method statement → `/star-metd-summarize`; bibliography gaps → `/star-refs-reviewer`; a MISMATCH whose artifact is wrong rather than the paper → `/star-expt-analyst` re-analysis, then `/star-plan-reviser`.

## Workflow

### Step 0: Resolve the target and mode

1. Interpret the argument: no argument → `paper/` (require `main.tex` or `sections/*.tex`; absent → say so and route to `/star-paper-writer`); an existing path → that file or directory; `audit` / `quick` → that mode on the resolved target.
2. Read the draft in full. Load the evidence base read-only: `metds/results.md`, the `EXPT_ANALYSIS` reports its rows cite, `paper/project_context.md` (venue, claimed contributions), `metds/refs/reference.bib` (key existence), and the method documents for statement-level checks. Record what is absent — a missing results ledger makes the claim audit mostly `NOT_AUDITABLE`, which is the report's headline, not a reason to skip it.
3. PDF input: extract text only if a tool already exists in the environment; otherwise ask for the tex/markdown source and say why (nothing is installed, conventions §3.5).

### Step 1: Persona reviews

Per `references/review_form.md`: the three personas read independently and fill the form (summary, strengths, weaknesses, questions for the authors, per-dimension scores with confidence). One reflection pass each — re-read the draft against the persona's own review, fix what does not hold, stop at "I am done". `quick` mode runs only the methods-and-evidence persona.

### Step 2: Claim audit (`audit` mode starts here)

Extract every empirical claim (numbers, comparatives, "consistently", "state of the art"), trace and classify per `claim_audit_spec.md`, and build the audit table — claim, draft location, evidence pointer, classification, note. Re-open the cited artifact for every `CONFIRMED` and `MISMATCH` row before the table is final: an audit that misquotes the ledger is worse than no audit.

### Step 3: Methodology checklist

Walk `methodology_checklist.md` over the draft and the evidence base; record only checks that fire or that pass with something to say — silence for the rest.

### Step 4: Merge and verify

Merge persona findings, audit rows, and checklist hits; dedup; rank by severity. For every CRITICAL/MAJOR: re-open the draft at the cited location and confirm the finding is real; downgrade or move to Unconfirmed what does not hold. Compute the weighted score summary (review_form.md) with the spread shown — a 4/7 split is information, not noise to average.

### Step 5: Persist the report

Fill `assets/paper_review_template.md` (Chinese: `assets/paper_review_template_zh.md`): scope and evidence base, verdict paragraph, weighted scores with per-persona columns, findings by severity with locations and routes, the claim-audit table, the methodology section, questions for the authors, Unconfirmed list. Write to `wkdrs/reviews/paper_<scope>_<YYYY-MM-DD>.md` (`scope` = `full` for `paper/`, else the path slug; real date, same-day overwrite, later day new file).

### Step 6: Digest & routing

≤400 words, verdict first: the score line with spread, counts by severity, the audit tally (CONFIRMED/PARTIAL/MISSING/MISMATCH/NOT_AUDITABLE), the top findings as one-liners, and the routing per Principle 6. End with the report path. Since nothing else was written, there is no commit to offer (conventions §1, never-commits group).

## State & File Rules

- The only write is `wkdrs/reviews/paper_<scope>_<date>.md`. Never touch: `paper/**`, `metds/**`, `wkdrs/**` beyond the report, `${CODE_NAME}/`, `.env`, plans, logs.
- Nothing heavy runs — no training, no evaluation, no costly APIs (STOP line); a claim needing a run is `NOT_AUDITABLE` with the run named. Static text extraction only, with tools already present.
- Git: read-only; this skill never commits (conventions §1).
- Real dates only (conventions §4). Re-invoke semantics: a same-day re-review overwrites its report; the reports are the audit trail.

## Dialogue Discipline

- The workflow has no mandatory gates — the target resolution may need one AskUserQuestion when the argument is ambiguous; otherwise the skill runs to its report without questions, which is what makes it safe on a timer. If AskUserQuestion is unavailable, fall back to plain text.
- Scores are presented as calibrated advice with the persona spread visible; never as a venue's actual decision. Findings name their evidence; a suspicion without evidence stays in Unconfirmed.
- Reply in the user's language; the report follows `paper/project_context.md`'s language when present (manuscripts are usually English), else the dialogue language; technical terms, citekeys, and paths stay in English inside Chinese text.
