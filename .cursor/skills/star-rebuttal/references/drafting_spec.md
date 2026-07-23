# Drafting Spec — structure, patterns, tone, resubmission, quality

Adapted from TobiasLee/Rebuttal-Skill (with the author's permission, 2026-07-22) and Galaxy-Dawn/claude-scholar review-response (MIT). Everything here presumes `evidence_spec.md`: no anchor, no claim.

## Part A: Writing principles

1. **Write for the neutral decision-maker.** The addressee is the reviewer; the real reader may be an area chair or editor skimming twelve rebuttals. Every major response makes clear: the concern, the underlying doubt, whether the authors agree / disagree / partly agree, the evidence, and what will change in the paper.
2. **Lead with the answer** — Direct Answer → Evidence → Revision.
   - Weak: "We thank the reviewer for this interesting question. Our method contains…"
   - Strong: "**Yes. The improvement remains under matched compute.** In the new experiment, our method obtains [X ± s] versus [Y ± t] for Baseline A using the same data, backbone, tuning budget, and FLOPs (results.md · claim 1 · run 00_mvp). We will add the result to Table [N] and clarify the comparison protocol."
3. **Organize by decision-critical concern**, not reviewer by reviewer: ① fatal or central technical concerns; ② shared major concerns; ③ empirical validity and fair comparison; ④ novelty and positioning; ⑤ generalization, robustness, efficiency, reproducibility; ⑥ scope and clarity; ⑦ minor comments. Merge shared concerns into one response unless the venue's form prevents it.
4. **The goal is not to answer every sentence equally** — it is to resolve the few decision-critical doubts. Effort follows the matrix's severity × sharedness × decision impact, not the order the comments arrived in.

## Part B: Templates

**Opening summary** (never manufacture praise; strengths quoted must exist in `reviews_raw.md`):

> We thank the reviewers for their careful feedback. They recognize [strength 1] (R1, R2), [strength 2] (R3). The main concerns are **(1)** [major concern], **(2)** [major concern], and **(3)** [major concern]. We address these below with new evidence and concrete revisions.

Critical review set variant:

> We thank the reviewers for the detailed feedback. While they raise important concerns about [central issue], they also recognize [merit]. We clarify the intended scope, provide the requested evidence where feasible, and specify the corresponding revisions below.

**Major response block** (one per merged concern, heading carries the concern IDs and reviewers):

```markdown
### C3. Performance under matched compute — R1, R3

**Concern.** <faithful one-sentence paraphrase>

**Response.** <direct answer in the first sentence>

**Evidence.** <result / derivation / manuscript evidence, with the comparison
conditions and uncertainty needed to interpret it, each anchored per evidence_spec>

**Revision.** <the exact change to the paper: location + what changes>
```

**Minor comments**, grouped compactly:

> **Minor comments.** We will define [term] at first use (R1), add the missing citation to [@citekey] (R2), correct Eq. (5) (R2), and expand the implementation details in Appendix D (R3).

**Revision list**: one numbered row per promised change — location (verified per `evidence_spec.md` Part A), the change, the concern IDs it serves. This list is what `/star-paper-writer revise` executes later; write it precisely enough to be executable.

## Part C: Response patterns and tone

**Correcting a misunderstanding** — the paper's fault first, never the reviewer's competence:

> **The method does not require [assumption]; it requires only [actual assumption].** This is stated in Section [N], but our presentation may have obscured the distinction. We will revise the paragraph and add [example].

**Acknowledging a valid limitation**:

> **We agree that the current evidence does not establish [broad claim].** It supports the narrower claim that [supported claim] under [conditions]. We will narrow the abstract and conclusion and add this limitation to Section [N].

**Reporting a completed experiment**:

> **We completed the requested [comparison/ablation/robustness test].** Under matched [data/compute/tuning], our method obtains [result] versus [baseline result] over [N] runs. This supports [specific claim]. We will add the setup and result to [location].

**An experiment that cannot be completed reliably in time**:

> We agree this experiment would be informative. Completing it reliably requires [reason], and we do not want to report an under-validated result. The current evidence supports [narrow claim]; we will clarify this scope and add the requested experiment to the revision plan.

**Novelty concern** — build the delta table first, then write from it; never argue novelty purely as "an unseen combination of known components":

| Prior work | Capability or assumption | This paper's difference | Why it matters |
|---|---|---|---|

> The contribution is not merely [common component]. It is **(i)** [new formulation], **(ii)** [new capability], and **(iii)** [new finding]. [@workA] differs in [specific distinction]; [@workB] assumes [specific assumption].

**Missing baseline / unfair comparison**: agree that conditions should align, state the now-matched protocol ([split], [budget], [backbone], [selection]), give the anchored result, promise the explicit controls in the paper.

**Statistical reliability**: report [metric] over [N] independent runs as mean ± sd with the interval or test named; no valid test → no significance wording.

**Score–text mismatch** — keep the public response substantive; where a confidential channel exists:

> We respectfully ask the chair to consider whether the numerical score is consistent with the review text, which recognizes [positive assessment] and does not identify [fatal issue].

Never pressure reviewers to change scores.

**Review-process issues** (nonspecific criticism, unsupported novelty judgment, unprofessional tone, expectations mismatching the paper's stated type, factual claims the cited work does not support): separate them from technical disagreement; use the confidential channel when one exists — quote only the necessary text, describe the issue factually, reference venue guidelines, explain the effect on fair evaluation, never speculate about intent or identity.

**Tone** — prefer: "We agree…", "We clarify…", "Our presentation may have obscured…", "The intended claim is…", "The new result shows…", "We will narrow…", "We will revise…". Avoid: "The reviewer failed to understand…", "This is obviously wrong", "This criticism is unfair", speculation about motives, aggressive score requests, repeated ceremonial thanks. A rebuttal should read calm, precise, and easy for a neutral chair to audit.

**Compression** — over the limit, remove in this order: ① repeated thanks; ② repeated reviewer quotations; ③ generic background; ④ adjectives and rhetorical flourish; ⑤ duplicate responses across reviewers; ⑥ low-impact minor comments; ⑦ implementation detail not needed to interpret the evidence. Preserve at all costs: direct answers, key numbers, comparison controls, uncertainty, assumptions, claim narrowing, manuscript changes, unresolved limitations. Report the final word/character count against the limit.

## Part D: Resubmission mode

Produce `resubmission_plan.md` with:

1. **Decision diagnosis** — the dominant rejection mechanism: unclear contribution / insufficient evidence / technical flaw / unfair evaluation / weak novelty positioning / venue mismatch / overclaiming / writing and organization / several independent concerns with no advocate.
2. **Preserve / change / remove table.**
3. **Revision backlog** ranked `R0 — blocks resubmission` / `R1 — strongly recommended` / `R2 — improves completeness` / `R3 — optional polish`.
4. **Next-submission experiment plan** — per experiment: hypothesis, concern addressed, protocol, expected information gain, cost, stopping criterion, and the implication of positive / negative / null results. These are candidate leaves for `/star-plan-decomposer` exactly like Stage-1 rows.
5. **Story and claim revision** — revised one-sentence contribution, revised abstract claim, strongest defensible novelty statement, claims to narrow, limitations to foreground, results to promote or demote.
6. **Paper-structure revision** — concrete changes per section, title to appendix.

Frame resubmission as the higher-return path, never as failure.

## Part E: Quality checklist and anti-patterns

`quality` mode audits a draft against this list and reports findings worst-first (severity: CRITICAL / MAJOR / MINOR), read-only.

**Triage**: venue scale and borderline identified or marked unknown; promising / uncertain / low-return distinguished with calibrated language; all-below-borderline triggered explicit resubmission consideration; strongest positive and negative signals named.
**Diagnosis**: every surface comment has an underlying decision question; ambiguous comments carry alternatives with visible confidence; shared concerns merged.
**Plan**: every experiment maps to concern IDs and carries a P0–P3 / DO-NOT-RUN label; priorities reflect the Part C dimensions; P0 feasible in time; protocols carry baselines and controls; negative-result implications specified; clarifications not disguised as experiments; long-horizon work deferred.
**Draft**: majors before minors; each major response opens with the direct answer; each empirical claim anchored; matched conditions and uncertainty present where relevant; valid limitations acknowledged; claims narrowed where evidence is short; revisions concrete; self-contained; professional tone; fits the venue limit.
**Integrity**: no fabricated result, quote, citation, or location; planned work not presented as completed; reviewer intent not overstated; negative results not hidden; process complaints separated; every placeholder visible.

**Anti-patterns** — flag on sight: drafting a polished rebuttal before the real concerns are identified; treating every sentence as equally important; an unranked experiment wishlist; easy P2 work before decision-critical P0; assuming ambiguous intent; experiments that miss the underlying question; promising broad future work instead of current evidence; burying the direct answer; repeating one response per reviewer; treating all criticism as misunderstanding; attacking reviewer competence; overclaiming from a single rushed result; spending the whole period when every review is clearly below borderline; giving up entirely when a short factual correction is still useful.
