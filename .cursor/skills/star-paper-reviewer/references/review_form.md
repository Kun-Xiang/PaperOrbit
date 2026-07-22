# Review Form — personas, form, reflection, aggregation

Structure adapted from the AgentLaboratory-lineage self-review pattern (authorized) with
the reviewer-team ideas from ARS (authorized, structure only). Three personas, one form,
one bounded reflection, one weighted merge.

## Part A: The three personas

Each persona reviews the **whole** draft alone, in its own voice, before any merging.
They differ in what they most want to reject for — that difference is the coverage.

1. **R-A · Methods & evidence (harsh but fair).** Expects experiments that support
   exactly the claims made. Hunts: unmatched baselines, missing variance, protocol
   holes, numbers without sources, evaluation-setup gaps. Verdict driver: "would the
   main table survive a re-run?"
2. **R-B · Novelty & positioning (the devil's advocate).** Assumes the contribution is
   incremental until shown otherwise. Hunts: the delta over the closest work stated
   vaguely, related work that flatters, "first to" claims, renamed known components,
   the strongest counter-argument the paper never addresses. Verdict driver: "what
   would the closest paper's authors say?"
3. **R-C · Open-minded big picture.** Looks for the idea worth accepting despite flaws.
   Hunts: buried contributions, framing that undersells, missing implications,
   clarity failures that hide a real result. Verdict driver: "is there a paper here,
   and does the writing let it out?"

## Part B: The form (per persona)

- **Summary** (3–5 sentences, the paper's own argument restated fairly);
- **Strengths** (numbered, each concrete);
- **Weaknesses** (numbered, each with draft location and what would fix it);
- **Questions for the authors** (answerable ones);
- **Scores, 1–10 with confidence 1–5**: Overall, Contribution, Soundness,
  Presentation, Reproducibility (integer scores; 5≈borderline, calibrate to a
  first-tier ML venue unless `project_context.md` names another register).

## Part C: Reflection (once per persona, bounded)

The persona re-reads the draft against its own filled form and asks: is every weakness
actually in the text (with the location right)? Is any score contradicted by its own
comments? Did it miss something another location resolves? Fix and stop — one pass,
ending "I am done"; no third readings.

## Part D: The merge (meta-review)

1. **Findings**: consensus items (≥2 personas) promote one severity step; single-persona
   items keep their persona tag; contradictions (R-B "incremental" vs R-C "novel
   framing") are surfaced as tensions with both arguments, never averaged into mush.
2. **Scores**: report the per-persona table and the weighted mean —
   `Overall ×1.0, Contribution ×0.4, Presentation ×0.2, Soundness ×0.1,
   Reproducibility ×0.1` (AgentLaboratory weights), normalized; show the spread
   (min–max) beside every mean. A wide spread is a finding.
3. **Verdict paragraph**: one honest paragraph a chair could act on — what carries the
   paper, what would reject it, what one change moves the needle most.
4. The main loop re-verifies every CRITICAL/MAJOR finding against the draft before the
   report keeps it (SKILL Principle 5); collector personas never grade the final
   verdict.
