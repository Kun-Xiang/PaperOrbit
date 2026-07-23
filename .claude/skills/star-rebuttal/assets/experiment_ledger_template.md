---
type: experiment_ledger
cycle: <venue>_<round>
language: <en / zh>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---

# Experiment Ledger — <venue> <round>

Ranked per `triage_spec.md` Part D. Confirmed run-now units are routed to
`/star-plan-decomposer` as proposed leaves — this file records the pointers as the family
produces them (leaf → run → analysis report); it never replaces the plan tree or the logs.

## 1. Plan (P0–P3)

<!-- One row per proposed experiment or analysis. "Protocol" is the minimum viable
     protocol — baselines/controls, data or subset, metric, seeds — written so it can
     become the leaf's §5 done-criterion verbatim. "Neg. result means" per D.2. -->

| ID | Pri | Concerns | Decision question | Protocol (minimum viable) | Time/cost | Neg. result means | Fallback wording |
|---|---|---|---|---|---|---|---|

**DO NOT RUN** — each with the D.1 reason it trips:

<!-- e.g. E9 — duplicates existing evidence (results.md · claim 2). -->

## 2. Clarification-only actions

<!-- Concerns answered with existing evidence or wording, no experiment: concern ID →
     the anchor or the clarification to make. -->

## 3. Deferred to revision / resubmission

<!-- Concern ID → why deferred (P3 reason). -->

## 4. Time budget

<!-- Only when the deadline is known: the recommended allocation (triage_spec.md D.5),
     adjusted to this cycle. -->

## 5. Tracking

<!-- Filled as the family works. status: proposed / leaf-created / running /
     awaiting-user / analyzed / integrated. Result column quotes the analyst's verdict,
     never a chat impression. -->

| ID | status | Leaf (metds/plans/) | Run (wkdrs/) | Analysis report | Result (verdict + headline number) |
|---|---|---|---|---|---|
