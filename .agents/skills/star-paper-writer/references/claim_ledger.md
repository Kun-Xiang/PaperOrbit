# Claim Ledger — the gate between sources and prose

The rule: **prose never outruns the artifacts.** Every load-bearing statement in the
manuscript traces to a project artifact; what cannot be traced enters as a visible
placeholder with a route. This file defines the anchors, the checks, and the behavior
when a check fails. The gate runs on *every* tex edit — drafting, integration,
compression, and revision alike.

## Part A: Anchor taxonomy

| Statement type | Legal source | Anchor recorded (tex comment or interception list) |
|---|---|---|
| A number (metric, gain, cost, count) | a `metds/results.md` row not excluded as invalid/inconclusive | `% anchor: results.md · <table> · <run> · <metric>` |
| A citation | a citekey present in `metds/refs/reference.bib` | the citekey itself (existence-checked) |
| A characterization of prior work | that paper's note behind `related_work.md`, within its `depth:` | `% anchor: refs/<ABBREV>.md §5` |
| A method statement | `metds/{framework,training,dataset,evaluation,overview}.md` section | `% anchor: framework.md §<n>` |
| A framing/motivation claim | root plan §1–§2, idea §5, or a cited work | as above |
| A figure | `wkdrs/<run>/analysis/<name>.png` (copied to `paper/figures/`) | `% source: <run>/analysis/<name>.png` |

Checks, mechanical where possible:

- **Citekeys**: `grep -o '\\cite[tp]\?{[^}]*}' paper/sections/*.tex` → split keys → each
  must appear in `reference.bib`. A missing key is `[CITATION NEEDED — $star-refs-reviewer <id>]`,
  never an invented entry and never a from-memory BibTeX block.
- **Numbers**: every numeral that states a result is matched against its anchored row —
  value and split must agree with the source exactly; rounding is stated ("41.2"
  from 41.23 is fine, "41.5" is not).
- **Not-yet-verified propagation**: method-doc passages marked *not yet verified* may be
  described as design intent ("we design X to…"), never as an achieved result ("X
  improves…"). The mark travels into the draft as a `% not-yet-verified` comment so
  integration can re-check it after the leaf executes.
- **Excluded rows stay excluded**: a `results.md` §5-excluded number (invalid,
  inconclusive, failed re-verification) does not appear in the paper in any form.

## Part B: Placeholders and interception

Visible tokens, one per failure class: `[RESULT NEEDED — <what run/metric>]`,
`[CITATION NEEDED — <paper hint>]`, `[METHOD DETAIL NEEDED — <doc §>]`,
`[FIGURE NEEDED — <what it must show>]`, `[VENUE RULE NEEDS VERIFICATION]`.

On interception the gate does three things, every time: writes the placeholder in
place; adds a line to the section's **interception list** (statement, why it failed,
the route); repeats the list in the digest. The failure mode this prevents is silence —
a fluent sentence whose number was invented reads exactly like a true one.

## Part C: Routing

| Gap | Route |
|---|---|
| Number missing / metric never measured | `$star-expt-analyst` (report exists but not aggregated → `aggregate`); a run that never happened → `$star-plan-decomposer` for the leaf |
| Citation missing / new closest work | `$star-refs-reviewer <arxiv-id>` |
| Method detail unstated in the docs | `$star-metd-summarize` names the owning plan §; the fix is a plan sync (`$star-plan-executor`) or a coach session — never prose that fills the gap |
| Draft contradicts a method doc | the plans moved or the doc is stale — `$star-metd-summarize`, then `$star-plan-reviser` if the plan itself is wrong |
| Figure missing | `$star-expt-analyst` (it renders from existing series) or the leaf that would produce the series |

## Part D: The `sources:` staleness contract

`paper/project_context.md` frontmatter records, per source document, the state value it
carried when read: each method doc's `generated:`, `results.md`'s `generated:`,
`related_work.md`'s `generated:`, `reference.bib`'s entry count, the root plan's
`updated:`. `star-flow-status` compares recorded against current by exact value — never
mtime — and fires its coverage row when a source moved. Integration's
stale-reconciliation re-reads the moved source, updates the affected sections behind
per-section approval, and refreshes the recorded value. Every re-read updates the map;
a stale map is a lie to the status skill.
