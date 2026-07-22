# Claim Audit Spec — the paper against its own repository

Classification idea adapted from open-paper-machine's `/audit-paper` (authorized),
re-grounded in STAR's artifact registry. The audit answers one question per claim:
**does the project's own evidence say what the paper says?**

## Part A: What counts as an auditable claim

- Any numeral presented as a result (metric, gain, cost, speedup, count);
- any comparative about own work ("outperforms", "reduces", "matches");
- any scope adverb welded to a result ("consistently", "across all", "state of the art");
- any process claim about the evidence ("averaged over N seeds", "same backbone").

Framing, citations of others' numbers, and design intent are not audited here —
citations go through key-existence and note-depth checks (writer's ledger); design
intent is checked against the method docs only when stated as achieved.

## Part B: Evidence order and matching

Trace each claim in authority order: `metds/results.md` (the aggregated, re-verified
ledger) → the run's `wkdrs/<run>/EXPT_ANALYSIS_<date>.md` → nothing else. Raw artifacts
are the analyst's domain; if the trail ends before a report, the claim is not auditable
here. Matching is **value + unit/scale + split + run**: 34.8 mIoU (ADE20K val,
run 10_edgeseg-ade20k) matches only a row saying exactly that.

## Part C: The five classes

| Class | Meaning | Rule |
|---|---|---|
| `CONFIRMED` | an artifact states the claim | value, split, and scope all match; pointer quoted |
| `PARTIAL` | matches with a stated, benign gap | rounding within the last shown digit; a narrower scope than the sentence implies (say which); a matching number whose seeds the sentence overstates |
| `MISSING` | no artifact holds it | includes claims about runs that never reached the ledger |
| `MISMATCH` | an artifact contradicts it | wrong value, wrong split, or the row is §5-excluded (invalid/inconclusive) — quote **both** sides verbatim |
| `NOT_AUDITABLE` | deciding needs a run or an external source | name the run or source that would settle it |

Hard rules: rounding beyond the last shown digit is `MISMATCH`, not `PARTIAL`
(41.23 → "41.2" fine; → "41.5" mismatch). A number whose only row is excluded is
`MISMATCH` with the exclusion reason quoted. Before the table is final, **re-open the
cited artifact for every `CONFIRMED` and `MISMATCH` row** — an audit that misquotes the
ledger is worse than no audit. When >10 CONFIRMED rows exist, additionally spot-check 3
at random and say so.

## Part D: Output and routing

Audit table columns: claim (quoted) · draft location · evidence pointer · class · note.
Tally line: counts per class. Routing per class: `MISSING` → `/star-plan-decomposer`
(the leaf that would produce it) or `/star-expt-analyst aggregate` (report exists,
ledger stale); `MISMATCH` → `/star-paper-writer revise` when the paper is wrong,
`/star-expt-analyst` re-analysis then `/star-plan-reviser` when the artifact chain is
suspect; `NOT_AUDITABLE` → the named run through the executor loop; `PARTIAL` →
a wording fix in `revise`.
