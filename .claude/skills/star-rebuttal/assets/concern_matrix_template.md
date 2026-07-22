---
type: concern_matrix
cycle: <venue>_<round>          # = the metds/rebuttal/<cycle>/ directory name
venue: <venue>
round: <r1 / r2 / …>
score_scale: "<range + semantic labels, or unknown>"
borderline: "<approximate acceptance boundary, or unknown (assessment provisional)>"
deadline: <YYYY-MM-DD or unknown>
viability: <PROMISING / BORDERLINE_UNCERTAIN / LOW_EXPECTED_RETURN>
language: <en / zh>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
stage:
  triage: in_progress      # pending / in_progress / done
  evidence: pending
  experiments: pending
  integrate: pending
  draft: pending
---

# Concern Matrix — <venue> <round>

Reviews verbatim: `reviews_raw.md` (append-only). Experiments: `experiment_ledger.md`.

## 1. Scores

<!-- One row per reviewer: id, overall score, confidence, one-line stance. Below the table:
     the score-distribution reading and the strongest positive / negative signals
     (triage_spec.md Part A). -->

| Reviewer | Score | Confidence | One-line stance |
|---|---|---|---|

## 2. Claim map

<!-- From the abstract / paper / overview.md: problem; main contribution; claimed novelty;
     claimed empirical result; claimed scope; the likely acceptance-critical claim.
     Flag claims broader than the review-visible evidence. -->

## 3. Concerns

<!-- One row per atomic concern (triage_spec.md Parts B–C). Status starts OPEN and is
     updated at integrate (evidence_spec.md Part B vocabulary). -->

| ID | Reviewer | Surface comment | Underlying concern | Class | Response mode | Severity | Shared | Impact | Res.conf | Status |
|---|---|---|---|---|---|---|---|---|---|---|

## 4. Concern-to-evidence map

<!-- Per concern: anchors already on disk (evidence_spec.md Part A), what is missing,
     and the chosen bucket: existing-evidence / clarification / run-now (→ ledger row) /
     defer. -->

| Concern | Evidence available (anchors) | Evidence missing | Bucket |
|---|---|---|---|

## 5. Intent diagnosis cards

<!-- Only for genuinely ambiguous comments (triage_spec.md B.3): reviewer text (quoted),
     most likely concern, alternative, confidence + why uncertain, evidence answering both,
     the author's answer when one was asked, safe response strategy. -->

## 6. Decisions

<!-- Dated one-liners: the viability gate answer, the confirmed run-now set, overruled
     recommendations with the user's reason. What the user decided in chat must appear
     here — chats end, files do not. -->
