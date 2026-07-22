---
type: project_context
venue: <target venue + year>
page_limit: "<N pages, refs counted? appendix?>"
double_blind: <true / false>
deadline: <YYYY-MM-DD or unknown>
language: <en — manuscript language follows the venue>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
stage:                      # the pipeline resume point
  context: in_progress      # pending / in_progress / done
  outline: pending
  draft0_intro: pending
  evaluation: pending
  method: pending
  background: pending
  related_work: pending
  intro: pending
  abstract: pending
  integrate: pending
  compress: pending
sources:                    # exact-comparison staleness contract (claim_ledger.md Part D)
  overview.md: "<generated: value when read>"
  framework.md: "<generated:>"
  dataset.md: "<generated:>"
  training.md: "<generated:>"
  evaluation.md: "<generated:>"
  results.md: "<generated:>"
  related_work.md: "<generated:>"
  reference.bib: "<entry count when read>"
  root_plan: "<file · updated: value>"
---

# Project Context — <paper working title>

## Identity

<!-- ONE sentence: what this paper shows. From root plan §1 / idea §5 — confirmed, not
     re-elicited. Everything in the paper must serve this sentence. -->

## Contributions as claims

<!-- Numbered. Each written as a result with its anchor, or explicitly not-yet-supported.
     e.g. "1. Edge conditioning improves open-vocab mIoU by 1.7 on ADE20K
     (anchor: results.md · claim 1 · run 10_edgeseg-ade20k)." -->

## Locked decisions

<!-- Choices the plans already settled that the paper must not silently contradict:
     backbone, datasets, protocol, naming. Each with its plan/doc source. -->

## Positioning

<!-- The gap sentence from root §2 / related_work.md's closing paragraph, and the 2–3
     closest works the paper must position against (citekeys). -->

## Voice overrides

<!-- Deviations from style_gates.md defaults, if any — each rule id + the override.
     Empty means the defaults bind. -->

## Figure plan seed

<!-- Candidate figures: from wkdrs/<run>/analysis/ (data, with provenance) and concept
     figures to be specced in the outline. -->

## Overclaim watch

<!-- Contributions whose anchors are missing or single-seed — the wording constraints
     the drafts must respect until the evidence lands. -->
