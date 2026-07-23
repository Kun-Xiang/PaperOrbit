# Methodology Checklist — the objections reviewers actually raise

Checklist framing after Nyhan's peer-review checklist manifesto (via lcrawfurd's
review skills, authorized), rewritten for empirical ML. Walk every item; report only
items that fire, or that pass with something worth saying. Each finding cites the
draft location **and** the evidence (or its absence) behind it.

1. **Seeds and variance.** Single numbers presented where variance matters; "improves
   by 0.3" with no seed count; mean without sd. Evidence check: what the `results.md`
   rows actually record. A single-seed MVP is fine *when the sentence says so*.
2. **Matched comparisons.** Baselines differing in backbone, training budget, data, or
   tuning effort from the method; a released-checkpoint baseline against a tuned
   method. The classic rejection.
3. **Leakage smells.** Validation used for selection and reporting; test-set tuning;
   pretraining overlap with evaluation data; a "too good" jump the draft never
   explains. Check what `EXPT_ANALYSIS` reports already flagged.
4. **Significance wording.** "Significant(ly)" without a test; claims of superiority
   inside noise; comparisons across different splits presented as one series.
5. **Ablation coverage.** A central mechanism with no ablation row; an ablation that
   varies two things at once; components claimed necessary but never removed.
6. **Generalization scope.** All evidence from one benchmark family while the abstract
   claims a task-level result; distribution-shift claims without a shifted test set.
7. **Reproducibility surface.** Hyperparameters, data processing, and compute stated
   somewhere (paper or named appendix); the repo's own `training.md` consistent with
   the draft; anything the venue's checklist will ask for that is absent.
8. **Claim-scope overreach.** Abstract or intro promising more than the evaluation
   shows ("consistently", "across diverse settings"); conclusions introducing new
   claims; limitations section missing the limitation a reviewer will find first.
9. **Fairness of related-work characterization.** Prior methods described by their
   weakest configuration; missing the obvious closest work (check against
   `related_work.md`'s themes); numbers quoted for others without source.
10. **Figure–text agreement.** Figures contradicting prose numbers; captions claiming
    what the plot does not show; axes chosen to exaggerate (truncated, log without
    saying).

Severity: an item that undermines the headline claim is CRITICAL; one any reviewer
would list as a weakness is MAJOR; polish is MINOR. Route with the same table as the
claim audit (missing evidence → the plan loop; wording → `revise`).
