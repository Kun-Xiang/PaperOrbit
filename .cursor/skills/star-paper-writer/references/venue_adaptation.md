# Venue Adaptation & Pre-submission Checks

Venue changes register and furniture, never the ledger. Profiles below are defaults;
`project_context.md` records the chosen profile and any deviations.

## Part A: Venue profiles

**ML venues (NeurIPS / ICLR / ICML / ACL / AAAI / COLM):** integrated related work
(early section); colon-style subtitles; reproducibility checklist and impact statement
where required; contributions framed as methodological claims with numbers; appendix
carries per-seed tables and extra ablations; citations natbib/author-year per template.

**Systems venues (NSDI / SIGCOMM / CoNEXT / IMC):** `\smartparagraph{}`-style bolded
lead-ins; evaluation speaks latency / throughput / memory; contributions framed as
operational impact; related work after evaluation; design section carries the
architecture figure early.

**Workshop / short papers (HotNets-style):** compress everything ~50%; lead with the
intellectual provocation; one figure that carries the argument; future work is a
feature, not a confession.

Chinese-venue or thesis variants follow the same profiles with the language switched;
technical terms, metric names, and citekeys stay in English.

## Part B: Pre-submission mechanical checklist (`precheck` — run, don't recite)

Automated where the toolchain exists; each check reports its command output. LaTeX
absent → run the source-only checks, mark the PDF checks `skipped (no toolchain)`, and
recommend the user's own build; never install anything (conventions §3.5).

```bash
pdfinfo paper/main.pdf | grep Pages                    # 1 page count vs venue limit
grep -n "LaTeX Warning.*undefined" paper/main.log      # 2 undefined refs/citations
pdffonts paper/main.pdf | awk '$5=="no"'               # 3 non-embedded fonts
grep -rn '\\includegraphics' paper/sections/ paper/main.tex   # 4 figure inventory…
file paper/figures/*                                    #   …raster vs vector check
grep -rniE 'acknowledg|\\thanks|grant no' paper/        # 5 anonymization (double-blind)
grep -rn 'balance' paper/main.tex                       # 6 column balancing package
grep -rn '[a-zA-Z]\\cite' paper/sections/*.tex          # 7 dangling \cite (missing ~)
grep -rn '\\label{' paper/sections/*.tex | sort | uniq -d   # 8 duplicate labels
```

Report as a table — check / status / details — fix what is mechanical (add `~`,
`\usepackage{balance}`), and route what is editorial (a raster figure worth re-rendering
→ the run's `analysis/` plot script). Double-blind: also grep author names and
institution strings recorded in `project_context.md`.

## Part C: Figures

Data figures come from the runs (`wkdrs/<run>/analysis/`, each with its plot script) —
copy into `paper/figures/` and note provenance; regenerating them belongs to
`/star-expt-analyst`, restyling to the plot script beside the figure. Concept/architecture
figures are specified in the outline (what the figure must show, its archetype) and left
to the user's drawing tool of choice — this skill writes the spec and the caption, and
`[FIGURE NEEDED — <spec>]` holds the slot until the asset exists.
