# Outline Spec — learn the structure, then earn it

Idea after SurveyForge's outline heuristics and AutoSurvey's parallel-outline merge
(authorized, concept level): a survey's skeleton should come from how the field
already organizes itself, checked against what the pool actually covers.

## Part A: Derive candidate structures

From the scanned **surveys** in the breadth table (mandatory rows guarantee some
exist): read each one's abstract — and its note, when it entered the pool — and extract
the organizing axis it uses: chronology, taxonomy of methods, problem settings,
pipeline stages, evaluation regimes. Write 2–3 candidate outlines, each labeled with
its axis and the survey(s) it learns from. A field with no prior survey states that
(it is a finding worth a sentence in the intro) and derives candidates from the
sub-direction structure of `broad_scan.md` instead.

## Part B: Merge and adapt

Merge the candidates into one outline: take the axis that best fits the pool's actual
distribution, fold in sections the other candidates had and this one lacks, and adapt
for what changed since the newest prior survey (the frontier rows exist precisely for
this). Standard furniture stays unless the reader profile says otherwise:
introduction (scope + why now + what prior surveys miss), background/preliminaries
(newcomer reader only), the body sections along the chosen axis, open
challenges/future directions, conclusion.

Every body section carries: its one-sentence scope, its **paper assignment** (which
pool members and which named-only scan rows it will draw on), and a target length.

## Part C: Coverage check (before the gate)

- Every pool paper is assigned to ≥1 section; an unassigned paper means the outline
  or the pool is wrong — resolve now.
- Every body section is carried by ≥2 pool papers; a section carried by fewer is
  either merged, or explicitly flagged as a thin-coverage gap with the papers that
  would fix it (route: extend the pool via `$star-refs-reviewer`).
- The axis covers every sub-direction `broad_scan.md` counted, or names the exclusion
  as a scoping decision in the introduction's contract.

Present outline + coverage table at the gate; the user reorders, merges, or renames
freely. Write `outline.md` with a per-section `status:` map (`pending` /
`in_progress` / `done`) — the drafting resume point.
