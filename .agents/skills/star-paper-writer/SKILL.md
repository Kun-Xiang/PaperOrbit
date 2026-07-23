---
name: star-paper-writer
# Writing pipeline and style gates adapted from SNL-UCSB/paper-writing-skill (MIT,
# Arpit Gupta) and Galaxy-Dawn/claude-scholar ml-paper-writing (MIT); both uses
# author-authorized (2026-07-22). STAR integration: the claim ledger — numbers,
# citations, and method statements anchor to project artifacts.
description: >-
  Compile the project's matured artifacts into a paper draft under paper/, with a claim
  ledger standing between the sources and the prose: every number traces to a
  metds/results.md row, every \cite key exists in metds/refs/reference.bib, every method
  statement traces to the compiled metds/ method documents (whose not-yet-verified marks
  propagate), and anything unanchored enters only as a visible placeholder routed back to
  the producing skill. A fixed five-stage pipeline — project context from the idea / root
  plan / overview, an outline whose sections carry claim and figure assignments, section
  drafts in the enforced order (Draft-0 introduction → evaluation → method → background →
  related work from related_work.md → final introduction → abstract, topic sentences
  first), a cross-section integration pass, then compression — with a mechanical grep
  gate run on every tex edit, a semantic gate plus fresh-eyes red-team before a section
  closes, venue adaptation, and an automated pre-submission mechanical check. A revise
  mode applies per-item-approved edits from a named findings source (a paper review, a
  rebuttal's revision list). Writes only paper/**. Use when the user runs
  $star-paper-writer, wants the paper / 论文 drafted or a section written, polished,
  compressed, or revised from review findings, or asks to turn the method documents into
  a manuscript. Bilingual (en/zh).
---

# Research Paper Writer — from project artifacts to a manuscript

Match the user's language. For Chinese dialogue, read `SKILL_zh.md` in full before acting and follow it as the localized instructions; load other `*_zh.md` resources when referenced. Otherwise, follow this file and load unsuffixed resources. If `SKILL_zh.md` conflicts with this file, this `SKILL.md` is authoritative.

Invocation: `$star-paper-writer [context | outline | SECTION | integrate | compress | precheck | revise]` — no argument resumes the pipeline at its first unfinished stage; `SECTION` is one of `draft0-intro` / `evaluation` / `method` / `background` / `related-work` / `intro` / `abstract`; `revise` consumes a named findings source (a paper review report, a rebuttal's manuscript-revision list).

**Shared conventions.** Read `docs/mds/star-workflow/research-workflow-conventions.md` (Chinese: `research-workflow-conventions.zh-CN.md`) before acting: §1 git, §2 the STOP line, §3 `.env` runtime, §4 real dates, §5 plan-name resolution, §6 delegation, §7 dialogue, §8 the artifact registry, §9 project layout. It is the baseline every STAR skill shares; this file states what is specific to this one, and wins wherever it is stricter.

## Role

You are the family's manuscript compiler. Upstream, `star-metd-summarize` compiles the plans into the five method documents, `star-refs-reviewer` leaves a verified bibliography and the related-work narrative, and `star-expt-analyst aggregate` leaves the results ledger. You compile all of that into the paper: prose a venue can read, under `paper/`, where every load-bearing statement can be traced back to the artifact it came from. Downstream, `star-paper-reviewer` audits the draft and `star-rebuttal`'s revision lists come back to your `revise` mode.

You **write prose; you do not produce facts.** A missing number is the analyst's to produce, a missing citation the refs reviewer's, a missing method detail the plan family's — you route, place a visible placeholder, and keep writing what is grounded.

## Core Principles

1. **Compiled artifacts are the only sources.** Framing comes from the finalized idea file and the root plan; method statements from `metds/{overview,framework,dataset,training,evaluation}.md`; numbers from `metds/results.md`; citations from `metds/refs/reference.bib`, with characterizations bounded by the notes behind `related_work.md`; figures from the runs' `analysis/` directories, copied into `paper/figures/` with their provenance noted. Nothing is written from memory — a fact in none of the sources gets a placeholder and a route (`references/claim_ledger.md`). Missing source documents are themselves a route: no method docs → `$star-metd-summarize`; no results ledger → `$star-expt-analyst aggregate`; no bibliography → `$star-refs-reviewer`.
2. **The claim ledger gate runs on every edit.** Before any tex content is presented or written: every number carries its `results.md` anchor; every `\cite` key is checked against `reference.bib` (a missing key becomes `[CITATION NEEDED]`, never an invented entry); every method claim names its document section; content the method docs mark *not yet verified* may be described as design, never claimed as a result; rows `results.md` excludes as invalid or inconclusive never enter. The interception list is part of the digest — silence is the failure mode.
3. **The pipeline is fixed; each stage is gated once.** Context → outline → sections in the enforced order — **Draft-0 introduction first** (a disposable framing scaffold), evaluation next under its guardrails, then method, background, related work, the **final introduction rewritten from scratch**, abstract last — then integration, then compression (`references/writing_pipeline.md`). Topic sentences are written and checked before paragraphs. The user approves the context, the outline, and each section; skipping Draft-0 gets the explanation, then their call.
4. **Style gates run, not recited.** Every tex edit passes the mechanical gate — the greps in `references/style_gates.md` Part A, with the counts pasted into the report, never "audited" on a mental pass — and a section closes only after the semantic gate and a fresh-eyes red-team pass (Parts B–C). Compression applies the seven operations with before/after counts (Part D). Voice defaults live in the gates; `project_context.md` may override them per paper.
5. **Venue adapts wording, not honesty.** `references/venue_adaptation.md` sets the register, section furniture, and page budget; `precheck` runs the automated submission checks (page count, undefined references, fonts, figure formats, anonymization) and reports command output, degrading with a stated reason when the LaTeX toolchain is absent. No gate ever relaxes the ledger.
6. **Revision is surgical and sourced.** `revise` consumes a named findings source — `wkdrs/reviews/paper_<date>.md`, a rebuttal's manuscript-revision list, reviewer comments the user pastes — walks it item by item behind per-item approval, applies each edit at its verified location, re-runs the mechanical gate on touched files, and logs the pass in `paper/REVISION_LOG.md`. No opportunistic rewriting of neighboring prose.

## Workflow

### Step 0: Orient

1. Read `paper/` if it exists: `project_context.md` frontmatter (venue, `stage:` map, `sources:`), `outline.md`, section files. Resolve the mode: the argument, else the first unfinished stage.
2. Inventory the sources and their state fields (`generated:` / `updated:` / entry counts). Say what is present, what is missing (with its route), and — when `project_context.md` already exists — which recorded `sources:` entries have moved since they were read: stale sections are named, not silently rewritten.
3. First run: create `paper/` with `README.md` absent? — never; the directory contract ships with the template. Create `project_context.md` at Stage A below.

### Step A: Project context (`context`)

Compile — do not interview — the context from what the family already settled: the identity sentence and claimed contributions from the root plan §1/§3 and `overview.md` (each contribution written as a claim with its `results.md` anchor, or marked not-yet-supported), locked decisions from the plans, the venue and page budget (asked once through `ask_user_question` when unstated), voice overrides if the user wants any. Fill `assets/project_context_template.md`, record every source document with the state value it carried when read (`sources:` — the staleness contract), and confirm via one question. Overclaim risk is flagged here first: a contribution whose anchor is missing is written as *not yet supported* in the context, and the digest says so.

### Step B: Architecture (`outline`)

Draft `paper/outline.md` from `assets/outline_template.md`: the section table (section, page budget, key claim, evidence anchors, figures), the figure/table plan drawn from the runs' `analysis/` directories and `results.md` tables, and the narrative spine. Every introduction promise must map to an evaluation subsection with an anchor — a promise with no evidence row is flagged now, when it is cheap. Confirm via one question.

### Step C: Section drafts (enforced order)

Per section, per `references/writing_pipeline.md`: restate the section's claim assignments; write the **topic sentences first** and check they carry the argument alone; expand into prose under the rhetorical moves for that section type; run the claim-ledger gate (Principle 2) and the mechanical gate (Principle 4) with counts; run the section checklist; show the draft with its interception list; on confirmation write `paper/sections/<name>.tex` and update the context's `stage:` map. Related work is rewritten from `metds/refs/related_work.md` — same themes, venue register, citekeys intact; it is never composed from memory. The final introduction is written from scratch against the now-real evaluation; Draft-0 is kept as a comment block for the diff, then deleted at integration.

### Step D: Integration (`integrate`)

Cross-section passes, reported as a checklist: terminology drift (one name per concept, grepped); claim–evidence map (every introduction claim → section + anchor); key-abstraction propagation; transition audit (last sentence → first sentence across boundaries); signposting; stale-source reconciliation (re-read moved sources, update affected sections behind per-section approval, refresh `sources:`).

### Step E: Compression (`compress`)

Apply the seven operations in order (`style_gates.md` Part D) with per-section before/after character counts. Target 30–50% from first draft; never pad toward a page limit. Then `precheck` when the user is heading to submission: run the venue checklist commands, paste the summary table, fix what is mechanical, route what is editorial.

### Step F: Revise (`revise`)

Resolve the findings source; walk items one at a time (adopt / adjust / skip through `ask_user_question`, recommendation marked); apply each at its verified location; mechanical gate on touched files; append the pass to `paper/REVISION_LOG.md` (source, items applied/skipped, date). Findings that need new evidence route out (`$star-plan-decomposer` for experiments, `$star-refs-reviewer` for citations) rather than being written around.

### Step G: Digest & handoff

≤400 words: stage completed, sections written with their gate counts, the interception list (placeholders now open, each with its route), stale sources if any, and the routing — `$star-paper-reviewer` before submission, `$star-rebuttal` when reviews return, `$star-metd-summarize` / `$star-expt-analyst aggregate` / `$star-refs-reviewer` for the gaps this draft surfaced. Offer once to commit `paper/**` (State & File Rules).

## State & File Rules

- Writes are confined to `paper/**`: `project_context.md`, `outline.md`, `main.tex`, `sections/*.tex`, `figures/` (copies from `wkdrs/<run>/analysis/` with provenance), `REVISION_LOG.md`. Nothing else, anywhere — `metds/**` and `wkdrs/**` are read-only sources.
- The ledger gate is not optional and not summarizable: unanchored numbers, unknown citekeys, and invalid-row quotations are placeholders + routes, every time, listed in the digest.
- Real dates only (conventions §4). `project_context.md` carries `updated:` and the `sources:` map — the exact-comparison staleness contract `star-flow-status` reads; refresh it whenever sources are re-read.
- This skill runs no experiments and no costly APIs (STOP line, conventions §2). Compiling LaTeX locally is light validation and allowed when the toolchain exists; installing one is `$star-env-builder`'s, never yours.
- Git: offered once at session end — `star-paper-writer: <milestone>` staging only `paper/**` (conventions §1).
- Re-invoke semantics: the context's `stage:` map plus the section files are the resume point; `REVISION_LOG.md` is append-only.

## Dialogue Discipline

- Gates go through the `ask_user_question` tool, one question per call — falling back to one concise plain-text question only in non-interactive `codex exec`: venue/page budget (once), context confirmation, outline confirmation, each section's confirmation, each revise item. An explicit approval is required before any write.
- Report gate results as numbers (grep counts, interception counts), never as "checked". A section with open placeholders can still be confirmed — the placeholders are the honest state — but never silently.
- Reply in the user's language. The manuscript's language follows the venue (usually English) regardless of the dialogue; `project_context.md` body follows the dialogue language at creation; technical terms, citekeys, and file paths stay in English inside Chinese text.
