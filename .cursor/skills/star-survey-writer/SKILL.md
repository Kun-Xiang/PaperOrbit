---
name: star-survey-writer
disable-model-invocation: true
# Funnel protocol adapted from Lianggs8/auto-survey-agent (MIT); outline-heuristic,
# paper-card, and reviewer–refiner ideas after AutoSurvey (NeurIPS 2024), IterSurvey,
# and SurveyForge (ACL 2025). All uses author-authorized (2026-07-22). The literature
# base itself is star-refs-reviewer's — this skill never fetches records on its own
# authority or writes metds/refs/**.
description: >-
  Write a standalone survey of a field through a funnel with gates: a pre-research
  proposal the user confirms (keywords, sub-directions, selection criteria, target
  scale), a breadth scan of 100+ papers' metadata (titles/abstracts fetched and cached —
  never PDFs at this stage, never from memory), a selection pass with mandatory-inclusion
  rules (recent surveys, seminal works, top-venue SOTA) that picks a 15–25-paper deep
  pool, per-paper notes delegated to /star-refs-reviewer (whose verified reference.bib
  and analysis notes are the survey's only citation and characterization sources), an
  outline learned from how the scanned surveys structure the field, section drafting
  where every citation exists in the bib and every characterization stays within its
  note's depth, and one reviewer–refiner pass. Writes metds/survey/<slug>/ (proposal,
  broad scan, outline, sections, survey.md) plus the scan cache under
  wkdrs/survey_<date>/raw/. Use when the user runs /star-survey-writer, wants a survey /
  literature review / 综述 of a field written, or wants an existing survey cycle
  resumed, re-outlined, or refreshed against a grown refs base. Bilingual (en/zh).
---

# Research Survey Writer — a field, funneled into a survey

Match the user's language. For Chinese dialogue, read `SKILL_zh.md` in full before acting and follow it as the localized instructions; load other `*_zh.md` resources when referenced. Otherwise, follow this file and load unsuffixed resources. If `SKILL_zh.md` conflicts with this file, this `SKILL.md` is authoritative.

Invocation: `/star-survey-writer [TOPIC | SLUG | outline | draft SECTION | refine]` — free text starts a new cycle on that topic; a slug resumes the cycle under `metds/survey/<slug>/`; `outline` / `draft <section>` / `refine` force a stage on the resolved cycle; no argument resumes the unfinished cycle or asks for a topic.

**Shared conventions.** Read `docs/mds/star-workflow/research-workflow-conventions.md` (Chinese: `research-workflow-conventions.zh-CN.md`) before acting: §1 git, §2 the STOP line, §3 `.env` runtime, §4 real dates, §5 plan-name resolution, §6 delegation, §7 dialogue, §8 the artifact registry, §9 project layout. It is the baseline every STAR skill shares; this file states what is specific to this one, and wins wherever it is stricter.

## Role

You are the family's survey compiler — the wide-angle counterpart to `star-refs-reviewer`'s close reading. The refs reviewer builds the project's own literature base and its `synthesize` mode writes the related-work narrative *for this paper*; you write the survey *for the field's readers*: a funnel from 100+ scanned papers down to a structured, citation-verified document a newcomer could start from. The division is strict: the refs reviewer owns records, notes, and the bib; you own the funnel, the outline, and the prose — and every fact you write is bounded by what its machinery verified.

## Core Principles

1. **The funnel narrows in public.** Proposal → breadth → selection → depth → outline → draft, each stage written to disk before the next begins (`references/funnel_spec.md`). The proposal is gated: keywords, sub-directions, selection criteria, and target scale are confirmed by the user before any scan runs — a survey of the wrong slice of the field is expensive exactly in proportion to how far the funnel got.
2. **Breadth is metadata; depth is the refs reviewer's.** The breadth scan fetches titles, venues, years, and abstracts through the refs family's source policy (serialized, backed off, Google Scholar never scraped), caches every payload under `wkdrs/survey_<date>/raw/` before use, and downloads no PDFs. The selected deep pool is routed to `/star-refs-reviewer` paper by paper — its notes and its `reference.bib` entries are the only sources the draft may characterize from or cite. This skill fetches nothing on its own authority beyond scan metadata and writes nothing under `metds/refs/**`.
3. **Selection has mandatory rows.** The deep pool always includes: the field's recent surveys (they calibrate the taxonomy), the seminal most-cited works (they anchor the history), and the last year's top-venue representatives (they date the frontier) — plus the user's own picks, all confirmed in one gate (`funnel_spec.md` Part C). What was excluded and why stays recorded in `broad_scan.md`.
4. **The outline is learned, not invented.** Section structure derives from how the scanned surveys organize the field — their fetched abstracts and, for pool members, their notes — merged and adapted per `references/outline_spec.md`; every outline section names the papers that will carry it, and a section with no papers is a coverage gap to resolve before drafting, not during.
5. **Drafting is bounded by the base.** Every `[@citekey]` exists in `reference.bib`; every characterization comes from that paper's note and goes no deeper than its `depth:` admits; a paper with only a scan record may be named, never characterized; nothing comes from memory (`references/section_rules.md`). A thin theme becomes a stated gap with a read-next list, never padded prose.
6. **One refiner pass, then the mirror.** After the sections exist, one reviewer–refiner pass checks coherence, transition quality, citation–claim faithfulness, and taxonomy consistency (`section_rules.md` Part C) — `/star-paper-reviewer <path>` supplies a deeper persona review on demand. `survey.md`'s frontmatter records the refs base's state (`reference.bib` entry count, `refs_index.md` audit date) as read — the exact-comparison contract `star-flow-status` uses to flag a survey the base has outgrown.

## Workflow

### Step 0: Resolve the cycle

List `metds/survey/*/` and read each `proposal.md` frontmatter `stage:` map. A slug resumes that cycle at its first unfinished stage; a stage keyword forces that stage; free text starts a new cycle (derive the slug, create `metds/survey/<slug>/`, write `proposal.md` from `assets/proposal_template.md`); no argument resumes the single unfinished cycle or asks for a topic.

### Step 1: Proposal (gate)

Run 2–3 exploratory queries (top 10–20 results, metadata only) to sense the field's shape, then fill the proposal: search keyword sets, apparent sub-directions, selection criteria (venues, year window, the mandatory rows), target breadth (~100+; scale down honestly for narrow fields), and the intended reader. Confirm with one plain-text question — *approve / adjust / narrow the topic* — and iterate until approved. Lock the proposal (`stage.proposal: done`); later changes reopen it explicitly.

### Step 2: Breadth scan

Execute the approved queries through the source policy; collect metadata to the target scale; cache raw payloads under `wkdrs/survey_<date>/raw/` before use; deduplicate by title. Write `broad_scan.md`: the full table (title / venue / year / citations / one-clause relevance / record URL), per-sub-direction counts, and the scan's honest limits (queries that failed, rate limits hit). No PDFs, no full texts.

### Step 3: Selection (gate)

Apply the criteria per `funnel_spec.md` Part C: mandatory rows first, then ranked fill to the 15–25 pool. Present the pool with one-clause justifications as one plain-text question (recommendations marked; the user may add or strike several). Record the confirmed pool and the exclusion note in `broad_scan.md`.

### Step 4: Depth via the refs reviewer

Route the pool to `/star-refs-reviewer <id>` paper by paper (append mode — it fetches the record, writes the note, updates the bib and index). Track coverage in the proposal's checklist; resume here as notes land. Do not draft a section whose papers lack notes — that is the coverage check, not an inconvenience.

### Step 5: Outline (gate)

Derive candidate structures from the scanned surveys per `outline_spec.md`, merge into one outline with per-section paper assignments and target lengths, run the coverage check (every pool paper placed; every section carried by ≥2 papers or flagged), and confirm with one plain-text question. Write `outline.md`.

### Step 6: Draft sections

Per section, per `section_rules.md`: restate its assignment; draft from the notes (and scan records for named-only mentions); enforce the citation and depth bounds mechanically where possible (`grep` the citekeys against the bib); end each section with its takeaway; write `sections/<n>_<slug>.md` immediately. Sections may be drafted across sessions; the outline's status map tracks them.

### Step 7: Refine and assemble

One refiner pass over the assembled draft (`section_rules.md` Part C): transitions, taxonomy-term consistency, citation–claim spot-check (re-open 5 random citekeys' notes and confirm the sentences they carry), intro/conclusion written last from the sections. Assemble `survey.md` with frontmatter: `type: survey`, `language`, `generated:` (real date), `sources:` (bib entry count + `refs_index.md` audit date as read, plus the note list). Overwrite behavior follows the family rule: a generated file gets a section-level change list and one question; a hand-authored file is never overwritten on a diff alone.

### Step 8: Digest & handoff

≤400 words: funnel numbers (scanned → pool → notes → sections), coverage gaps with their read-next routes, the refiner's findings, and the routing — deepen a paper via `/star-refs-reviewer <id>`, a full persona review via `/star-paper-reviewer metds/survey/<slug>/survey.md`, refresh when the base grows via `/star-survey-writer refine`. Offer once to commit the cycle (State & File Rules).

## State & File Rules

- Writes are confined to `metds/survey/<slug>/**` (`proposal.md`, `broad_scan.md`, `outline.md`, `sections/`, `survey.md`) and the scan cache `wkdrs/survey_<date>/raw/**`. Never touch `metds/refs/**` (route to `/star-refs-reviewer`), `metds/plans/*`, the compiled `metds/*.md`, `paper/**`, `${CODE_NAME}/`, `.env`.
- Network use is scan metadata and abstracts only, through the refs family's source policy — serialized, backed off, cached before use; no PDFs at breadth, no paid APIs, no scraping past rate limits, and nothing here crosses the STOP line (conventions §2).
- Real dates only (conventions §4). Resume from the proposal's `stage:` map and the outline's section status; `survey.md` regeneration with unchanged sources writes nothing.
- Git: offered once at session end — `star-survey-writer: <slug> — <milestone>`, staging only `metds/survey/<slug>/` (conventions §1).

## Dialogue Discipline

- Three gates asked as single plain-text questions — one at a time, each with concrete options and the recommendation marked: the proposal (Step 1), the pool (Step 3), the outline (Step 5) — plus the standard overwrite question on regeneration. An explicit approval is required before scans or writes the gate covers.
- Report the funnel honestly: papers scanned vs target, failed queries, notes still missing, sections drafted vs outlined. Depth is never overstated — "the abstracts suggest" is the verb at abstract depth, and a named-only paper is introduced as such.
- Reply in the user's language. The cycle's body language follows the dialogue language at creation and is kept on resume; titles, venue names, citekeys, and technical terms stay in English inside Chinese documents.
