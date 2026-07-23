# Triage Spec — viability, diagnosis, classification, experiment plan

Adapted from TobiasLee/Rebuttal-Skill (with the author's permission, 2026-07-22). Part A gates the whole cycle; Parts B–C fill the concern matrix; Part D builds the experiment ledger; Part E composes the first response.

## Part A: The rebuttal-versus-resubmission gate

### A.1 Normalize the score scale

Do not assume a universal borderline. Establish, asking the user once where unknown:

- venue and score range;
- the semantic label of each score;
- the approximate acceptance boundary;
- whether an area-chair discussion phase exists, whether reviewers can change scores, and whether new experiments are permitted in rebuttal.

Unknown borderline → the assessment is stated as **provisional**, in those words.

### A.2 Classify viability

**`PROMISING`** — typical signals: at least one reviewer positive or clearly above borderline; negatives focus on answerable misunderstandings or missing evidence; no reviewer identifies a fatal correctness flaw; the central concern fits inside the rebuttal period; one or two resolved doubts plausibly change the decision. Action: invest in targeted rebuttal experiments, prioritize shared major concerns, produce a full response.

**`BORDERLINE / UNCERTAIN`** — signals: scores cluster around the borderline; reviews acknowledge real strengths but list several fixable concerns; reviewer intent is ambiguous; one decisive experiment or clarification may flip the case. Action: run only high-value fast-turnaround experiments, prepare a concise rebuttal, and record resubmission-grade revisions in parallel.

**`LOW EXPECTED RETURN`** — signals: **all reviews below the venue borderline**; no positive reviewer or advocate; multiple reviewers independently question the core premise, correctness, novelty, or empirical validity; the required evidence cannot be produced reliably in time; resolving the concerns means redesigning the method or rewriting the central story. Action: say plainly that extensive rebuttal work has low expected value and resubmission is likely the higher-value path; do not encourage rushed experiments merely to appear responsive; offer a minimal professional rebuttal for material factual errors; provide the resubmission plan.

Never declare rejection certain. Calibrated wording:

> Based on the current score distribution and the nature of the concerns, the expected return from extensive rebuttal work appears low. A short response may still correct material misunderstandings, but the higher-value path is likely a stronger revision and resubmission.

### A.3 Required output in a low-return case

1. why rebuttal has low expected value; 2. what is still worth answering now; 3. what not to spend time on; 4. resubmission diagnosis; 5. prioritized revision roadmap; 6. recommended experiments for the next submission; 7. recommended claim / framing / writing changes; 8. target-venue considerations, only when enough information exists. (Items 4–8 are `drafting_spec.md` Part D's format.)

### A.4 The claim map

Extract from the abstract (or `paper/` / `metds/overview.md` / the root plan when supplied): the problem, main contribution, claimed novelty, claimed empirical result, claimed scope, and the likely acceptance-critical claim. Flag claims broader than the evidence the reviews describe — those are where `SCOPE_OR_OVERCLAIM` concerns will land.

## Part B: Diagnose each review

### B.1 Split into atomic concerns

One reviewer paragraph may hold several concerns; split them. Example: "The method is expensive, the comparison to X is unfair, and the novelty over Y is unclear." → C1 computational cost; C2 fairness of the comparison to X; C3 novelty relative to Y. Every concern gets an ID (`C1`, `C2`, …) that the ledger, the draft, and the routing reuse.

### B.2 Infer the underlying reason (mandatory)

For every atomic concern, record: the **surface comment** (what was literally written), the **underlying concern** (the decision-relevant doubt behind it), the **evidence that would resolve it**, and the **confidence** of the interpretation. Common underlying doubts: technical correctness; unfair comparison behind a claimed gain; cherry-picked setting; genuine novelty; task importance; statistical reliability; scalability; reproducibility; cost vs. gain; claim broader than evidence; the paper is unclear and the reviewer is confused; the reviewer applies an expectation the paper never claimed.

### B.3 Intent Diagnosis Cards for uncertain intent

When multiple interpretations are plausible, never pick silently. Fill a card in the matrix §5:

- **Reviewer text**: faithful short quotation;
- **Most likely underlying concern** / **alternative interpretation**;
- **Confidence**: high / medium / low, and **why uncertain** (missing reference, ambiguous wording, score–text mismatch, conflicting statements);
- **Evidence that would answer both interpretations** — preferred whenever feasible;
- **Question for the author** — only when the author's knowledge is necessary; ask one plain-text question with the interpretations as options;
- **Safe response strategy**: wording valid under both readings.

### B.4 Classes and response modes

Primary class, one per concern: `CORRECTNESS` / `NOVELTY` / `EMPIRICAL_SUPPORT` / `FAIR_COMPARISON` / `MISSING_BASELINE` / `GENERALIZATION` / `ROBUSTNESS` / `STATISTICAL_RELIABILITY` / `EFFICIENCY` / `SCALABILITY` / `REPRODUCIBILITY` / `SIGNIFICANCE` / `SCOPE_OR_OVERCLAIM` / `RELATED_WORK` / `CLARITY` / `PRESENTATION` / `REVIEW_PROCESS`.

Likely response mode: `NEW_EXPERIMENT` / `NEW_ANALYSIS` / `EXISTING_EVIDENCE` / `CLARIFICATION` / `CORRECTION` / `CLAIM_NARROWING` / `MANUSCRIPT_REVISION` / `CONFIDENTIAL_CHAIR_NOTE` / `DEFER_TO_RESUBMISSION`.

## Part C: Severity and priority dimensions

- **Severity** — `FATAL`: if valid and unresolved, the main claim fails (correctness flaw in the central method, data leakage, invalid protocol, uninterpretable primary comparison, novelty claim contradicted by prior work). `MAJOR`: could cause rejection, but the paper survives if resolved (missing strong baseline, generalization gap, missing central ablation, unmatched compute, weak statistics). `MODERATE`: affects confidence, scope, or presentation. `MINOR`: typos, local clarity, small citation omissions.
- **Decision impact** — `HIGH` / `MEDIUM` / `LOW`: how much resolving it could change the decision. Not identical to severity: a major concern from a low-confidence outlier may matter less than a shared moderate one.
- **Sharedness** — `ALL_REVIEWERS` / `MULTIPLE_REVIEWERS` / `SINGLE_REVIEWER` / `META_REVIEW_OR_CHAIR`. Shared concerns rank higher.
- **Resolution confidence** — `HIGH`: existing evidence or a straightforward experiment answers it; `MEDIUM`: likely answerable, uncertain result; `LOW`: needs redesign, unavailable data, or speculative evidence.

## Part D: The P0–P3 experiment plan

### D.1 Priority labels

- **`P0 — must do now`**: addresses a fatal or major concern that is shared or decision-critical; feasible within the deadline; interpretable even if negative; no existing evidence already resolves it.
- **`P1 — high value if time permits`**: substantially strengthens the case; a major single-reviewer or shared moderate concern; feasible after all P0 items without jeopardizing them.
- **`P2 — nice to have`**: supports a secondary claim or completeness; cheap; runs without delaying higher priorities.
- **`P3 — defer to revision / resubmission`**: substantial engineering, data collection, or redesign; cannot be validated reliably before the deadline; low-impact; or a scope clarification suffices for the rebuttal.
- **`DO NOT RUN`**: does not address the underlying concern; duplicates existing evidence; uninterpretable for missing controls; would consume the period while majors stay unresolved; motivated by anxiety rather than decision value. Every such row says which of these applies.

Ranking heuristic — qualitative, explainable in prose, never presented as a precise score: `decision_impact × sharedness × severity × expected_information_gain × feasibility / cost`.

### D.2 Ledger row requirements

Each experiment row specifies: the concern IDs it addresses; the decision question; baselines and control conditions; dataset or evaluation subset; metric; compute/data matching; seeds or repeats where relevant; the minimum result that supports the intended claim; what a negative result would imply; the fallback rebuttal wording if not completed; estimated time/cost. **The minimum viable protocol becomes the leaf's §5 done-criterion when the unit is routed to `/star-plan-decomposer`** — write it so the executor can verify it.

### D.3 Prefer information-dense experiments

One experiment answering several concerns beats three narrow ones: a matched-compute comparison covers fairness + efficiency + baseline; a multi-seed run covers variance + reliability + cherry-picking; a cross-domain evaluation covers realism + generalization; a component ablation covers mechanism + novelty + necessity.

### D.4 Three buckets, and clarifications are not experiments

Return every concern in exactly one bucket: **run now** (the confirmed P0/P1 set) / **answer with existing evidence or clarification** / **defer to revision or resubmission**. Never recommend an experiment merely to signal effort.

### D.5 Time budget

When the deadline is known, recommend an allocation and adapt it: ~first 10% verify interpretations and freeze protocols; ~60% execute P0; ~20% analyze and draft major responses; ~final 10% consistency, tone, and length. Never fund P2 before P0 results are secured.

## Part E: First-response composition

The Stage-1 report to the user contains, in order: **A** viability (classification, score reading, strongest positive and negative signals, assumptions and missing venue information); **B** the claim map with overclaim flags; **C** the concern table (matrix §3 digest); **D** the concern-to-evidence map — what existing STAR artifacts already answer (`evidence_spec.md`); **E** the P0–P3 plan with the routing note ("confirmed units go to `/star-plan-decomposer`"); **F** the time-budget recommendation; **G** what happens next in the family (executor runs, analyst scores, `integrate` resumes here); **H** the resubmission roadmap when Part A classified low-return. Chat digest stays ≤400 words; the full detail lives in the matrix and ledger files.
