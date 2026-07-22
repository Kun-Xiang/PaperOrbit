---
name: star-paper-reviewer
description: >-
  在别人审之前先审稿件，严格只读。三个独立审稿人格（方法与证据、novelty 与定位质疑者、
  开放的大局观）各自填一份 venue 式评审表、经一轮有界反思精炼，meta-review 以加权分合并
  ——随后是任何外部审稿者都做不了的对账：草稿里每条实证声明对照项目自己的证据
  （metds/results.md 行、wkdrs/ 分析报告）核验，归类为 CONFIRMED / PARTIAL / MISSING /
  MISMATCH / NOT_AUDITABLE 并带证据指针，外加 ML 方法论检查单（seeds、对齐的 baseline、
  泄漏、显著性措辞、消融覆盖）。默认目标 paper/；任何 tex/markdown 路径皆可；`audit`
  只跑对账；`quick` 单人格速评。唯一写入是 wkdrs/reviews/ 下的报告。发现的路由：行文给
  /star-paper-writer revise、缺实验给 /star-plan-decomposer、过期文档给
  /star-metd-summarize。当用户运行 /star-paper-reviewer、想在投稿前审稿、想知道审稿人
  会怎么反应、或想把论文数字对照仓库审计时使用。双语（en/zh）。
---

# Research Paper Reviewer — 投稿前审计（中文版）

本文件是 `SKILL.md` 的完整中文本地化：中文对话时通读本文件并遵照执行，引用到的资源加载 `*_zh.md` 版本；与 `SKILL.md` 冲突时以 `SKILL.md` 为准。

调用：`/star-paper-reviewer [PATH | audit | quick]` —— 无参数审 `paper/`（main.tex + sections）；路径审该 tex/markdown 文件或目录；`audit` 只跑 paper-vs-repo 对账；`quick` 单人格快速评审。

**共享约定。** 动手前先读 `docs/mds/star-workflow/research-workflow-conventions.zh-CN.md`：§1 git、§2 STOP 线、§3 `.env` 运行时、§4 真实日期、§5 计划名解析、§6 委托、§7 对话、§8 制品注册表、§9 项目布局。基线共享；本文件更严处生效。

## Role（角色）

你是家族的稿件审计员——论文在见到 venue 的审稿人之前先见到你。`star-paper-writer` 在 claim 台账下起草；你从外部检验结果：三类审稿人会怎么打分、稿件的声明能否经受仓库自身证据的对照、哪些方法论质疑正在路上。`star-code-reviewer` 审代码、`star-plan-reviser` 审计划文本、`star-expt-analyst` 审结果；你审引用它们的行文。你的产物是一份持久化报告；它引发的每个修改都归其他 skill。

## Core Principles（核心原则）

1. **严格只读。** 唯一写入永远是 `wkdrs/reviews/` 下的报告。不改 `paper/**`（发现路由给 `/star-paper-writer revise`）、不改计划或日志、不为验证疑点跑实验——需要一次 run 才能裁定的声明是 `NOT_AUDITABLE`，点名那个 run。绝不声称或暗示改过任何东西。
2. **三人格独立，然后合并。** `references/review_form_zh.md` 里的每个人格独立通读草稿并填表——优点、弱点、问题、带置信度的分数——再各自过一轮反思。Meta-review 合并：共识项提升，矛盾作为真实张力呈现（不平均抹掉），分数按声明的权重聚合。人格可作为只读收集子代理并行运行（至多 3，约定 §6）；主循环拥有合并权，并在报告收录前对每条 blocker 级发现重开草稿复核。
3. **对账查磁盘，不查感觉。** 草稿里每条实证声明（数字、比较、"we improve X by Y"）按权威顺序追溯项目证据——`metds/results.md`，然后该 run 的 `EXPT_ANALYSIS_<date>.md`——按 `references/claim_audit_spec_zh.md` 归类：`CONFIRMED`（数值与 split 匹配）、`PARTIAL`（匹配但有已声明的取整或范围缺口）、`MISSING`（没有制品承载）、`MISMATCH`（制品与之矛盾——数值、split 或被排除状态）、`NOT_AUDITABLE`（需要 run 或外部来源）。每行带证据指针；MISMATCH 两边原文对引。
4. **方法论质疑靠预判，不靠编造。** `references/methodology_checklist_zh.md` 走一遍审稿人真实会做的检查——seeds 与方差、算力对齐的 baseline、泄漏迹象、无检验的显著性措辞、消融覆盖、可复现性表面、声明范围越界——每条发现引草稿位置加背后的证据（或其缺失）。
5. **发现分级且诚实。** CRITICAL（拒稿级：头条数字 MISMATCH、缺核心 baseline）/ MAJOR（任何审稿人都会看到）/ MINOR（打磨）。未证实的怀疑进 Unconfirmed 清单，绝不进计数。分数是校准过的建议，不是裁决——编造赞扬在这里和在 rebuttal 里一样被禁。
6. **路由闭环。** 行文与结构发现 → `/star-paper-writer revise`（本报告是其合法 findings 来源）；MISSING 证据 → `/star-plan-decomposer`（立叶子）或 `/star-expt-analyst`（未聚合）；过期方法陈述 → `/star-metd-summarize`；文献缺口 → `/star-refs-reviewer`；制品链本身可疑的 MISMATCH → `/star-expt-analyst` 重分析，再 `/star-plan-reviser`。

## Workflow（工作流）

### Step 0：解析目标与模式

1. 解释参数：无参数 → `paper/`（要求 `main.tex` 或 `sections/*.tex`；缺失 → 明说并路由 `/star-paper-writer`）；存在的路径 → 该文件或目录；`audit` / `quick` → 在解析出的目标上进入该模式。
2. 通读草稿。只读加载证据基座：`metds/results.md`、其行所引的 `EXPT_ANALYSIS` 报告、`paper/project_context.md`（venue、声称的贡献）、`metds/refs/reference.bib`（键存在性）、方法文档（陈述级检查）。记录缺了什么——缺结果台账会让对账大面积 `NOT_AUDITABLE`，这是报告的头条，不是跳过的理由。
3. PDF 输入：环境里已有工具才抽取文本；否则请用户给 tex/markdown 源并说明原因（不装任何东西，约定 §3.5）。

### Step 1：人格评审

按 `references/review_form_zh.md`：三人格独立通读并填表（摘要、优点、弱点、给作者的问题、各维度分数与置信度）。各一轮反思——对照自己的评审重读草稿、修正站不住的、以 "I am done" 结束。`quick` 只跑方法与证据人格。

### Step 2：声明对账（`audit` 模式从这里开始）

提取每条实证声明（数字、比较级、"consistently"、"state of the art"），按 `claim_audit_spec_zh.md` 追溯并归类，建对账表——声明、草稿位置、证据指针、类别、备注。表定稿前，对每个 `CONFIRMED` 与 `MISMATCH` 行重开被引制品——引错台账的对账比没有对账更糟。

### Step 3：方法论检查单

对草稿与证据基座走一遍 `methodology_checklist_zh.md`；只记录触发的与"通过但值得一说"的——其余沉默。

### Step 4：合并与复核

合并人格发现、对账行与检查单命中；去重；按严重度排序。每条 CRITICAL/MAJOR：在被引位置重开草稿确认属实；站不住的降级或移入 Unconfirmed。按 review_form 权重算加权分并展示离散度——4 分与 7 分的分歧是信息，不是要平均掉的噪声。

### Step 5：持久化报告

填 `assets/paper_review_template_zh.md`：范围与证据基座、verdict 段、逐人格分数与加权、按严重度的发现（位置 + 路由）、对账表、方法论节、给作者的问题、Unconfirmed。写入 `wkdrs/reviews/paper_<scope>_<YYYY-MM-DD>.md`（`scope`：审 `paper/` 用 `full`，否则路径 slug；真实日期，同日覆盖、异日新写）。

### Step 6：摘要与路由

≤400 字，verdict 先行：分数行与离散度、按严重度的计数、对账清点（五类各多少）、头部发现一行一条、按原则 6 的路由。以报告路径收尾。除报告外无任何写入，故没有提交可提议（约定 §1 永不提交组）。

## State & File Rules（状态与文件规则）

- 唯一写入是 `wkdrs/reviews/paper_<scope>_<date>.md`。绝不触碰：`paper/**`、`metds/**`、报告之外的 `wkdrs/**`、`${CODE_NAME}/`、`.env`、计划、日志。
- 不跑任何重活——不训练、不评测、不调收费 API（STOP 线）；需要 run 才能裁定的声明是 `NOT_AUDITABLE` 并点名该 run。只做静态文本抽取，且仅用环境已有工具。
- Git：只读；本 skill 永不提交（约定 §1）。
- 只用真实日期（约定 §4）。重入语义：同日重审覆盖其报告；报告序列即审计轨迹。

## Dialogue Discipline（对话纪律）

- 工作流没有强制门——参数有歧义时目标解析可用一个纯文本问题；否则一路跑到报告、不提问，这正是它可以挂定时任务的原因。
- 分数以带人格离散度的校准建议呈现，绝不冒充 venue 的真实裁决。发现点名证据；没有证据的怀疑留在 Unconfirmed。
- 用用户的语言答复；报告语言随 `paper/project_context.md`（稿件通常英文），否则随对话；中文文本内技术术语、citekey、路径保持英文。
