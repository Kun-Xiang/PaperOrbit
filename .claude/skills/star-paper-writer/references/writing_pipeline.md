# Writing Pipeline — stages, order, moves, checklists

Adapted from SNL-UCSB/paper-writing-skill (MIT; derived from forensic analysis of six
papers and 7,600+ edits) with the brainstorming stage replaced by STAR artifact
compilation. The pipeline is fixed; the voice defaults live in `style_gates.md`.

## Part A: The five stages

**A — Project context.** STAR already holds what a brainstorming interview would elicit:
the identity sentence (root plan §1 / idea §5), the contribution claims (root §3 +
`results.md` anchors), the evaluation shape (root §4), locked decisions (the plans),
the gap and positioning (`related_work.md`). Compile, show, confirm. Only the venue,
page budget, and voice overrides are genuinely the user's to add. A vague context
produces a vague paper — flag every contribution whose anchor is missing *now*.

**B — Architecture.** The outline table assigns every section its page budget, its key
claim (with anchor), and its figures before any prose exists. The test: every promise
the introduction will make maps to an evaluation subsection with an evidence anchor.
The figure plan comes from what exists — `wkdrs/<run>/analysis/` renders and
`results.md` tables — not from figures one wishes existed.

**C — Section drafts, in this order and no other:**

1. **Draft-0 introduction** — a disposable framing scaffold: stakes, problem gap, rough
   contribution claims. It sets guardrails for the evaluation and will not survive;
   writing it is a thinking tool. If the user asks to skip it, explain that an
   evaluation without framing guardrails produces experiments that don't build toward
   one argument — then follow their call.
2. **Evaluation** — constrained by Draft-0's guardrails; every number through the ledger.
3. **Method / design** — from `framework.md` + `training.md` + `dataset.md`.
4. **Background** — only what the venue's audience actually lacks.
5. **Related work** — rewritten from `metds/refs/related_work.md`, themes and citekeys
   intact, venue register applied.
6. **Final introduction** — rewritten **from scratch** against the finished evaluation:
   it promises exactly what the evidence supports. Draft-0 is reference material, not
   an editing base.
7. **Abstract** — last, from the final introduction's claims.

**Per-section scaffolding.** Write the topic sentences first and read them in sequence —
they must carry the argument alone before any paragraph is filled. In LaTeX, annotate
each paragraph with a purpose comment (`% Stakes: …`, `% Gap: …`); each comment is a
contract the paragraph must deliver.

**D — Integration.** Terminology drift (grep one name per concept), claim–evidence map,
key-abstraction propagation (the named concept appears in intro, method, evaluation
setup, and related-work positioning), transition audit (last sentence of ¶N → first of
¶N+1), signposting (every section opener states what the section concludes), visual
balance.

**E — Compression.** The seven operations (`style_gates.md` Part D), 30–50% reduction
target, character counts before/after. Never pad to a page limit.

## Part B: Rhetorical moves per section

**Introduction (6 moves):** Stakes (who suffers, why the domain matters) → Problem Gap
(the *structural* limitation — "existing tools assume X, which breaks on Y", not "not
accurate enough") → Key Abstraction (the named concept that captures the insight) →
Design Intuition (why it should work, one paragraph) → Contributions (numbered,
claim-first, each with its number where one exists) → Results Preview (the headline
anchored numbers).

**Evaluation (6 moves):** Setup Anchoring (datasets, baselines, metrics, protocol — once,
completely) → Head-to-Head (main table, interpreted not just cited) → Deep Dive (where
and why the method wins/loses) → Takeaway Synthesis (every experiment cluster ends with
a Takeaway paragraph) → Ablation (each component's necessity) → Robustness (seeds,
scales, shifts — exactly what `results.md` supports).

**Method / design (5 moves):** Abstraction Introduction (the named concept, first) →
Design Justification (every choice with its "because" immediately) → Component
Architecture (one data path a reader can follow) → Key Design Decision (the one
non-obvious choice, defended) → Robustness/Limits (what the design does not handle).

**Related work (3 moves):** Category Clustering (themes from `related_work.md`, not
chronology) → Per-Category Limitation (what these works cannot do *for this problem*,
each claim bounded by its note) → Positioning Sentence (what none of them do — the
paper's slot, grounded in the root plan §2).

## Part C: Section checklists (run after drafting, before presenting)

Severity: CRITICAL (structural, rejection-grade) / MAJOR (visible to reviewers) / MINOR.

**Introduction:** one-sentence identity? gap structural rather than quantitative? every
contribution claim-first and anchored (or marked not-yet-supported)? results previewed
with numbers? no promise without an evaluation subsection? outline paragraph present?

**Evaluation:** setup reproducible from the section alone? baselines the field expects
(per `related_work.md`) present or their absence explained? every table/figure
interpreted in prose? every cluster closed by a Takeaway? claims sized to seeds/splits
(`results.md` verdicts)? no number without an anchor?

**Method:** a reader can walk the data path end to end? every symbol defined before
use? every design choice justified? nothing depends on a result not yet shown?
consistent with `framework.md` — divergence means the plans moved, route it.

**Related work:** organized by theme? every characterization within its note's depth?
every cite key real? positioning paragraph present and consistent with the intro's gap?
no "first to" claim the survey does not support?

**Abstract:** problem, method, headline result (anchored), scope — in the venue's
register, no citations unless the venue expects them, under the venue's length norm.
