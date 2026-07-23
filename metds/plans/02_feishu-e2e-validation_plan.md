---
title: 飞书端到端验证执行计划
slug: feishu-e2e-validation
language: zh
prefix: "02"
parent: 0_research-workbench_plan.md
level: 2
traces_to: "§4 A4/A6；§6 M2 真实端到端"
depends_on: ["01"]
created: 2026-07-22
updated: 2026-07-22
exec_status: done
exec_runs:
  - 02_feishu-e2e-validation
status:
  objective: done
  deps: done
  steps: done
  deliverables: done
  verification: done
  risks: done
---

# 飞书端到端验证执行计划

## 1. 目标与范围

本子计划用真实输入完成根计划 M2：一份 PaperOrbit reading report 和一份 STAR survey 产物分别通过 `feishu-sync` 同步到飞书，并验证中文、公式、表格、代码块和文档标题层级的可读性。它对应 A4 与 A6，是对外展示“PaperOrbit 阅读成果进入知识库”的最终验收。

Non-goals：不新增 Web 功能，不修改 STAR survey writer，不把飞书 URL 自动写回 PaperOrbit 本地浏览器状态。

## 2. 输入与依赖

- 上游子计划 `01`：交付可运行的 `scripts/feishu-sync.mjs` 与通过的 mock 测试。
- Reading report 输入：优先从本地 PaperOrbit 流程生成并导出一份真实 `.md` 阅读报告，暂存到 `tasks/02_feishu-e2e-validation/inputs/reading-report.md`；若本地 UI/API 流程受限，则使用结构等价样例并在验收记录中明确标注降级原因。
- Survey 输入：`metds/survey/<slug>/survey.md`；若当前没有 survey 产物，则用 `tasks/02_feishu-e2e-validation/inputs/survey-sample.md` 标注为替代样例，并在验收记录中说明缺口。
- 凭据：`.env` 中 M0/M1 已验证可用的 `FEISHU_FOLDER_TOKEN` 与本机已登录的 `lark-cli --as user` 用户身份。

## 3. 任务分解

1. 准备两个真实或准真实输入文件：reading report 优先来自本地 PaperOrbit 生成 / 下载；若本地 UI/API 流程受限，则创建结构等价样例并在验收记录中标注。survey 优先使用 STAR 真实产物，没有时创建一份覆盖标题、引用式列表、表格、公式文本和代码块的样例。
2. 运行 `node scripts/feishu-sync.mjs <reading-report.md> <survey.md>`，保存命令输出中的 URL、文件名、耗时和错误分类。
3. 打开两个飞书 URL，人工检查标题层级、中文段落、列表、表格、代码块和公式文本是否完整可读；公式按根计划约定接受文本 / 代码形态保留。
4. 在 `wkdrs/02_feishu-e2e-validation/E2E_REPORT.md` 中记录每个输入文件、输出 URL、检查项结果、截图或人工验收说明，以及任何格式降级。
5. 如发现格式问题，判断是 CLI 可修复、飞书转换限制，还是输入 Markdown 本身问题；只修复 CLI 范围内的问题，飞书限制记为已知限制。
6. 最后重跑 `npm test`，确认端到端补充文件没有污染产品测试。

## 4. 产出物与输出

- `tasks/02_feishu-e2e-validation/inputs/reading-report.md`：用于验收的 reading report 输入；若含私密内容，执行时改放 `wkdrs/02_feishu-e2e-validation/inputs/` 并避免提交。
- `tasks/02_feishu-e2e-validation/inputs/survey-sample.md` 或真实 `metds/survey/<slug>/survey.md`：survey 验收输入。
- `wkdrs/02_feishu-e2e-validation/E2E_REPORT.md`：端到端验收记录，包含两个飞书 URL、检查表与已知限制。
- `wkdrs/02_feishu-e2e-validation/EXEC_LOG.md`：由 `$star-plan-executor 02` 记录执行命令与测试结果。

## 5. 验证 / 完成判据

完成判据是 A4 与 A6 同时达标：两个输入文件均得到可打开的飞书 URL；reading report 使用真实本地 PaperOrbit 产物或结构等价样例并记录来源；阅读报告中的中文、公式文本、表格和代码块内容完整；survey 产物或替代样例在飞书中保持可读结构；`wkdrs/02_feishu-e2e-validation/E2E_REPORT.md` 记录验收结果；最终 `npm test` 通过。

## 6. 局部风险与备选

主要风险是真实 survey 产物尚不存在，导致 M2 无法完全覆盖根计划声明的 survey 链路。局部备选是先用结构等价的 survey sample 完成 CLI 和飞书链路验收，并在报告中明确“真实 survey 产物待 `/star-survey-writer` 生成后复跑”。另一个风险是 reading report 含私密笔记；如果出现这种情况，输入只保留在 `wkdrs/` 或本地未跟踪目录，提交时只提交去敏验收报告。

## Revision History

### 2026-07-22 — star-plan-executor (run: 02_feishu-e2e-validation, 审批门)
- MODIFIED §2/§3/§4/§5：执行目录从 `tasks/feishu-e2e-validation/` / `wkdrs/feishu_e2e_validation/` 改为 STAR 标准 `tasks/02_feishu-e2e-validation/` / `wkdrs/02_feishu-e2e-validation/` —— 原因：用户确认按 STAR executor 标准路径执行 M2。
- MODIFIED §2/§3/§5：reading report 输入从“必须来自 PaperOrbit 下载”改为“优先真实本地 PaperOrbit 产物；本地流程受限时允许结构等价样例并记录降级” —— 原因：当前仓库没有现成 reading report，用户确认允许先尝试真实生成，失败时用样例完成端到端链路验收。
