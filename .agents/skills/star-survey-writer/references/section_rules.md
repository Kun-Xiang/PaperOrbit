# Section Rules — drafting bounds, refiner pass, gaps

The drafting contract in one line: **the notes are the source, the bib is the citation
space, and the depth field is the ceiling.** Reviewer–refiner idea after IterSurvey
(authorized, concept level).

## Part A: Drafting bounds (enforced per section)

1. **Citation space**: every `[@citekey]` exists in `metds/refs/reference.bib` —
   checked mechanically (`grep` the keys) before the section is shown. A paper worth
   citing that has no entry routes to `$star-refs-reviewer`; the sentence waits or
   names it without a citation marker plus a `[CITATION NEEDED — <id>]` placeholder.
2. **Characterization ceiling**: a claim about what a paper does, assumes, or achieves
   comes from that paper's note (`metds/refs/<ABBREV>.md`) and goes no deeper than its
   `depth:` — an abstract-depth note supports "proposes X for Y", not implementation
   detail. A pool paper's §5 (relation) is the survey's comparative fuel.
3. **Named-only mentions**: a breadth-scan row without a note may be *named* with its
   record facts (title, venue, year, one-clause topic) — never characterized beyond
   its cached abstract, and its citation still requires a bib entry (route it, or name
   without citing).
4. **Nothing from memory**: no paper, number, or claim enters that is not in a note, a
   cached record, or the bib. The survey's credibility is exactly its provenance.
5. **Numbers from other papers**: quoted only as "reported by [@citekey]" with the
   note as source; never cross-normalized into a comparison table unless every cell's
   note states the same protocol — a protocol-mixed table is the survey equivalent of
   an unfair baseline.
6. **Structure per section**: opening scope sentence → the papers, organized by the
   section's internal logic (not list order) → contrasts and trends the notes support
   → a closing takeaway (what this section's slice means for the field). Length within
   ±30% of the outline's target.
7. **Write immediately**: each finished section lands in `sections/<n>_<slug>.md`
   before the next begins; the outline's status map updates in the same step.

## Part B: Gaps are output

A section whose assigned notes cannot carry its scope becomes prose that says so: what
the section should cover, which papers would cover it, and the route
(`$star-refs-reviewer <id>` each). The gap list aggregates in the digest. Padding a
thin section with generalities is the failure the funnel exists to prevent.

## Part C: The refiner pass (once, on the assembled draft)

Run after all sections exist, before `survey.md` is assembled:

1. **Transitions**: each section's opening connects to the previous takeaway; the
   axis's through-line is audible when reading only openings and takeaways.
2. **Taxonomy consistency**: one name per concept across sections (grep the synonyms);
   the intro's taxonomy figure/list matches the section structure exactly.
3. **Citation–claim spot-check**: re-open 5 random cited notes and confirm the
   sentences they carry — a mismatch triggers a re-check of that whole section, not
   an inline patch.
4. **Coverage restated**: the intro's scope contract still matches what the sections
   deliver; anything dropped since the outline gate is named.
5. **Intro and conclusion last**: written from the finished sections — the intro
   promises what exists; the conclusion synthesizes trends and open problems already
   grounded in section takeaways (open problems cite the notes that expose them).

Deeper review on demand: `$star-paper-reviewer metds/survey/<slug>/survey.md` runs the
persona review and its checklist over the assembled survey.

## Part D: Assembly and the staleness contract

`survey.md` = intro + sections (in outline order) + conclusion + the gap list as an
appendix note. Frontmatter: `type: survey`, `language`, `generated:` (real date),
`sources:` — the `reference.bib` entry count and `refs_index.md` audit date **as
read**, plus the list of notes consumed. `star-flow-status` compares these recorded
values against the current base by exact value; a grown base flags the survey stale
(`$star-survey-writer refine`). Regeneration with unchanged sources writes nothing;
substantive regeneration shows the section-level change list behind one question, and
a hand-authored file at the target is never overwritten on a diff alone.
