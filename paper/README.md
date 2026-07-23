# paper/ — manuscript sources

This directory is owned by `/star-paper-writer` (see `.claude/skills/star-paper-writer/`).
It holds the paper as compiled from the project's artifacts — never as free-standing
prose:

```text
paper/
├── project_context.md   # identity, contributions-as-claims, venue, voice overrides,
│                        # and the sources: map (staleness contract for star-flow-status)
├── outline.md           # section table, claim–evidence map, figure plan, narrative spine
├── main.tex             # venue skeleton; inputs sections/
├── sections/            # one .tex per section, drafted in the enforced order
├── figures/             # copies from wkdrs/<run>/analysis/, provenance noted
└── REVISION_LOG.md      # append-only record of revise-mode passes
```

The contract, in one paragraph: every number in these sources traces to a
`metds/results.md` row, every `\cite` key exists in `metds/refs/reference.bib`, every
method statement traces to the compiled `metds/` method documents, and anything
unanchored appears only as a visible `[… NEEDED]` placeholder. The directory is
committed (it is source, not a generated artifact); large build outputs (`*.pdf`,
`*.aux`, …) should be ignored per your venue workflow.

一句话中文说明：本目录由 `/star-paper-writer` 拥有——论文从项目制品编译而来，数字、引用
与方法陈述均有锚定，无锚定内容只能以可见占位符存在。
