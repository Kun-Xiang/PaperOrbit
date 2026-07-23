# PaperOrbit Research Workbench Survey Sample

## Scope

This sample stands in for a future `metds/survey/<slug>/survey.md` artifact. It is intentionally structured like a STAR survey deliverable so the Feishu import path can be validated before the real survey writer produces a manuscript-grade survey.

## 中文摘要

本样例用于验证 STAR survey 产物进入飞书知识库后的可读性。它覆盖标题层级、中文段落、列表、表格、公式文本和代码块。

## Research threads

1. Daily paper recommendation and local affinity modeling.
2. Paper-aware Copilot sessions over arXiv PDFs.
3. Research workbench synchronization into Feishu knowledge storage.

## Comparison table

| Capability | PaperOrbit status | E2E check |
| --- | --- | --- |
| Daily recommendations | Implemented | Linkable in report |
| Reading reports | Implemented | Markdown import to docx |
| Feishu sync | M1 CLI implemented | M2 live import |

## Formula notation

Formula-like text is acceptable as preserved text:

```text
knowledge_gain = reading_depth * retrieval_quality * review_frequency
```

## Code-oriented note

```bash
node scripts/feishu-sync.mjs tasks/02_feishu-e2e-validation/inputs/reading-report.md tasks/02_feishu-e2e-validation/inputs/survey-sample.md
```

## Known gap

A real STAR survey artifact has not been generated yet. After `/star-survey-writer` creates `metds/survey/<slug>/survey.md`, rerun M2 with that file to replace this sample.
