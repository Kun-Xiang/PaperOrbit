# Claim 台账 — 来源与行文之间的门（中文版）

规则：**行文绝不跑到制品前面。** 稿件里每句承重陈述都回溯到一个项目制品；无法回溯的以
可见占位符 + 路由进入。本文件定义锚定、检查与失败时的行为。此门跑在**每次** tex 编辑
上——起草、整合、压缩、修订一视同仁。与英文版 `claim_ledger.md` 冲突时以英文版为准。

## Part A：锚定类型

| 陈述类型 | 合法来源 | 记录的锚定（tex 注释或拦截清单） |
|---|---|---|
| 数字（指标、增益、成本、计数） | `metds/results.md` 中未被排除为 invalid/inconclusive 的行 | `% anchor: results.md · <表> · <run> · <指标>` |
| 引用 | `metds/refs/reference.bib` 中存在的 citekey | citekey 本身（存在性核验） |
| 对已有工作的特征化 | `related_work.md` 背后该论文的笔记，深度不超其 `depth:` | `% anchor: refs/<ABBREV>.md §5` |
| 方法陈述 | `metds/{framework,training,dataset,evaluation,overview}.md` 的章节 | `% anchor: framework.md §<n>` |
| 框架/动机论断 | root plan §1–§2、idea §5、或被引论文 | 同上 |
| 图 | `wkdrs/<run>/analysis/<name>.png`（拷入 `paper/figures/`） | `% source: <run>/analysis/<name>.png` |

检查，能机械化的机械化：

- **Citekey**：`grep -o '\\cite[tp]\?{[^}]*}' paper/sections/*.tex` → 拆键 → 每个必须
  出现在 `reference.bib`。缺失的键是 `[CITATION NEEDED — /star-refs-reviewer <id>]`，
  绝不现编条目、绝不凭记忆写 BibTeX 块。
- **数字**：每个陈述结果的数值对照其锚定行——数值与 split 必须与来源完全一致；取整要
  声明（41.23 写成 "41.2" 可以，写成 "41.5" 不行）。
- **not-yet-verified 传播**：方法文档标 *not yet verified* 的段落可描述为设计意图
  （"we design X to…"），绝不能写成已达成的结果（"X improves…"）。该标记以
  `% not-yet-verified` 注释随行入稿，叶子执行后整合阶段复查。
- **被排除的行保持被排除**：`results.md` §5 排除的数字（invalid、inconclusive、复核
  失败）以任何形式都不出现在论文里。

## Part B：占位符与拦截

可见记号，一类失败一个：`[RESULT NEEDED — <哪个 run/指标>]`、`[CITATION NEEDED —
<论文线索>]`、`[METHOD DETAIL NEEDED — <文档 §>]`、`[FIGURE NEEDED — <图须展示什么>]`、
`[VENUE RULE NEEDS VERIFICATION]`。

拦截发生时，门做三件事，每次都做：原位写占位符；向该章节的**拦截清单**加一行（陈述、
失败原因、路由）；在摘要里复述清单。它防的失败模式是沉默——一句数字被编造的流畅句子，
读起来和真句一模一样。

## Part C：路由

| 缺口 | 路由 |
|---|---|
| 数字缺失 / 指标从未测过 | `/star-expt-analyst`（报告在而未聚合 → `aggregate`）；run 压根没跑过 → `/star-plan-decomposer` 立叶子 |
| 引用缺失 / 新的最近工作 | `/star-refs-reviewer <arxiv-id>` |
| 方法细节文档未载 | `/star-metd-summarize` 点名所属计划 §；修法是计划同步（`/star-plan-executor`）或 coach 会话——绝不是用行文填缺 |
| 草稿与方法文档相矛盾 | 计划动了或文档过期——先 `/star-metd-summarize`，计划本身错则 `/star-plan-reviser` |
| 图缺失 | `/star-expt-analyst`（已有序列可渲染）或将产出该序列的叶子 |

## Part D：`sources:` 过期契约

`paper/project_context.md` frontmatter 逐来源记录读取时的状态值：各方法文档的
`generated:`、`results.md` 的 `generated:`、`related_work.md` 的 `generated:`、
`reference.bib` 的条目数、root plan 的 `updated:`。`star-flow-status` 用精确值对比——
绝不用 mtime——来源动过即触发其覆盖行。整合阶段的过期对账重读动过的来源、逐节审批更新
受影响章节、刷新记录值。每次重读都更新映射；过期的映射就是对状态 skill 撒谎。
