# Evidence Spec — anchors, validation, integrity

The rule this file operationalizes: **every evidence sentence in a rebuttal has an anchor or a visible placeholder.** An anchor points at something on disk that a reader (or a later session) can re-open; a placeholder tells the author exactly what is missing. Nothing in between exists.

## Part A: Anchor taxonomy — where evidence lives in a STAR project

Scan read-only, in this order of authority, and record anchors in the concern-to-evidence map:

| Anchor form | Points at | Example |
|---|---|---|
| Results-ledger row | `metds/results.md` — the claim/ablation table row: run, metric, value, source, verdict | `results.md · claim 1 table · run 00_mvp-3way-ablation · mIoU 41.2 (val)` |
| Analysis report | `wkdrs/<run>/EXPT_ANALYSIS_<date>.md` — scorecard row or metric with its named source | `wkdrs/00_mvp/EXPT_ANALYSIS_2026-07-10.md · D-row mIoU · source eval/metrics.json` |
| Run record | `wkdrs/<run>/EXEC_LOG.md` — a step's check evidence (for "we did X" process claims) | `EXEC_LOG.md · step 3 check` |
| Bibliography | `metds/refs/reference.bib` citekey (+ the note `metds/refs/<ABBREV>.md` for characterizations) | `[@2021_CLIP_Radford]`, note `CLIP.md §5` |
| Manuscript location | Section/Table/Eq in `paper/` (verified by opening the file) or user-confirmed when no `paper/` exists | `paper/sections/eval.tex · Table 2` |
| Reviewer text | `reviews_raw.md` verbatim quote — the only legal source for what a reviewer said | `reviews_raw.md · R2 ¶3` |

Rules:

1. **Authority order for numbers**: `results.md` (aggregated & re-verified) > the run's `EXPT_ANALYSIS` report > raw artifacts. Never quote a number from chat memory or from the plan text — plans hold intent, not results.
2. **Characterizing a cited paper** follows the refs rules: only from that paper's note, no deeper than its `depth:` admits; a bib entry without a note may be named, not characterized.
3. **Manuscript locations are verified, not recalled**: open the file and confirm the Section/Table number when `paper/` exists; otherwise the location carries `[MANUSCRIPT LOCATION NEEDED]` until the author confirms it. A wrong pointer in a rebuttal reads as carelessness to the one reader who checks.
4. **A concern answerable by existing anchors never becomes an experiment** — its response mode is `EXISTING_EVIDENCE` or `CLARIFICATION`.

### Placeholders

Use these visible tokens, never silent gaps: `[RESULT NEEDED]`, `[SETTING NEEDED]`, `[NUMBER OF SEEDS NEEDED]`, `[MANUSCRIPT LOCATION NEEDED]`, `[VENUE RULE NEEDS VERIFICATION]`, `[AUTHOR CONFIRMATION NEEDED]`. Every placeholder still open is listed in the Step 7 digest.

## Part B: Validating returned results (`integrate`)

A ledger row's result enters the rebuttal only after this check — the analyst's report is the primary source, and its own discipline (disk over log, source named per metric) is assumed but **re-opened, not trusted**:

1. Re-open the run's `EXPT_ANALYSIS_<date>.md`; for any number that will appear in the rebuttal, follow the report's cited source and confirm value and split.
2. Does the experiment actually answer the **underlying** concern (not the surface sentence)?
3. Are comparison conditions matched (data, backbone, budget, tuning, FLOPs — whichever the concern turns on)? Is the metric the one the criterion means?
4. Are runs/seeds and uncertainty adequate for the claim's strength? No valid significance test → no significance claim.
5. Classify: positive / negative / mixed / inconclusive; name exactly which claim it supports and any new limitation it creates.
6. Never convert an inconclusive result into a positive claim; never hide a negative one.

Concern status vocabulary after integration: `RESOLVED` / `PARTIALLY_RESOLVED` / `UNRESOLVED` / `RESOLVED_BY_CLARIFICATION` / `CONCEDED_AND_NARROWED` / `DEFERRED_TO_RESUBMISSION`.

### What enters the rebuttal

Include results that are decision-relevant, methodologically interpretable, verified, concise enough to explain, and directly linked to concern IDs. Omit or qualify results that are rushed, missing a fair control, contradictory without space to explain, or aimed at a different concern than the reviewer's. A **negative or mixed result** can still strengthen the case by supporting a narrower claim:

> The requested analysis does not support the broader claim that [broad claim]. It shows the gain holds under [conditions] but not under [conditions]. We will narrow the claim in the abstract and conclusion and state this limitation explicitly.

## Part C: Integrity rules

**Allowed evidence**: supplied abstract and manuscript text; manuscript locations verified per Part A; completed experiments and analyses reached through their reports; corrected derivations; reproducible numerical summaries; citations from `reference.bib` (venue policy permitting).

**Forbidden, without exception**: inventing experimental values; inventing reviewer quotes; inventing manuscript locations; presenting planned work as completed ("we have run" for a `[RESULT NEEDED]` row); implying a reviewer agreed when they did not; claiming significance without the test; concealing a negative added result; stating uncertain reviewer intent as certain; promising a future experiment will succeed; recommending a rushed experiment without interpretable controls. When uncertain, say so and give the safest next action.

## Part D: Routing

What this skill finds but does not own gets routed, never done in place:

| Finding | Route |
|---|---|
| Evidence missing → experiment confirmed to run | `$star-plan-decomposer` (proposed leaf; protocol = done-criterion) |
| Leaf created, not yet run / STOP-line command pending | `$star-plan-executor <leaf>` |
| Run finished, no analysis report yet | `$star-expt-analyst <leaf>` |
| A result contradicts what a plan's text claims | `$star-plan-reviser <slug>` |
| A reviewer surfaced a closer paper the bib lacks | `$star-refs-reviewer <arxiv-id>` |
| The revision list's manuscript edits, when `paper/` exists | `$star-paper-writer revise` (once available) |
| A result matching a root §5 kill-criterion | surface as a **Strategy signal**: `$star-plan-reviser`, then coach/decomposer as needed |
