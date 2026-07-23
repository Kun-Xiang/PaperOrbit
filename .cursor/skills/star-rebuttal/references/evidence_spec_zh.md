# 证据规格 — 锚定、校验、诚信（中文版）

本文件落实的规则：**rebuttal 里每一句证据要么有锚定，要么有可见占位符。** 锚定指向磁盘上读者（或后续会话）能重新打开的东西；占位符准确告诉作者缺什么。两者之间不存在第三态。与英文版 `evidence_spec.md` 冲突时以英文版为准。

## Part A：锚定类型 — STAR 项目里证据在哪

按以下权威顺序只读扫描，锚定记入意见-证据映射：

| 锚定形式 | 指向 | 示例 |
|---|---|---|
| 结果台账行 | `metds/results.md` —— claim/消融表行：run、指标、数值、来源、verdict | `results.md · claim 1 表 · run 00_mvp-3way-ablation · mIoU 41.2 (val)` |
| 分析报告 | `wkdrs/<run>/EXPT_ANALYSIS_<date>.md` —— 记分卡行或带来源的指标 | `wkdrs/00_mvp/EXPT_ANALYSIS_2026-07-10.md · D 行 mIoU · 来源 eval/metrics.json` |
| 运行记录 | `wkdrs/<run>/EXEC_LOG.md` —— 某步骤的校验证据（用于"我们做了 X"类过程性论断） | `EXEC_LOG.md · step 3 check` |
| 文献库 | `metds/refs/reference.bib` citekey（特征化还需笔记 `metds/refs/<ABBREV>.md`） | `[@2021_CLIP_Radford]`，笔记 `CLIP.md §5` |
| 稿件位置 | `paper/` 中的 Section/Table/Eq（打开文件核实），或无 `paper/` 时经用户确认 | `paper/sections/eval.tex · Table 2` |
| 评审原文 | `reviews_raw.md` 逐字引文 —— 引述评审说过什么的唯一合法来源 | `reviews_raw.md · R2 ¶3` |

规则：

1. **数字的权威顺序**：`metds/results.md`（聚合且复核过）> 该 run 的 `EXPT_ANALYSIS` 报告 > 原始产物。绝不从聊天记忆或计划文本引数字——计划承载意图，不承载结果。
2. **特征化被引论文**沿用 refs 家规：只从该论文自己的笔记出发、深度不超过其 `depth:` 所允许；没有笔记的 bib 条目可以点名，不可特征化。
3. **稿件位置靠核实，不靠回忆**：有 `paper/` 就打开文件确认 Section/Table 编号；否则该位置带 `[MANUSCRIPT LOCATION NEEDED]` 直到作者确认。rebuttal 里一个错误指针，在唯一会去查证的读者眼里就是草率。
4. **既有锚定能回答的意见绝不变成实验**——其回应模式是 `EXISTING_EVIDENCE` 或 `CLARIFICATION`。

### 占位符

只用这些可见记号，绝不留无声空洞：`[RESULT NEEDED]`、`[SETTING NEEDED]`、`[NUMBER OF SEEDS NEEDED]`、`[MANUSCRIPT LOCATION NEEDED]`、`[VENUE RULE NEEDS VERIFICATION]`、`[AUTHOR CONFIRMATION NEEDED]`。仍开放的占位符全部列入 Step 7 摘要。

## Part B：校验返回的结果（`integrate`）

台账行的结果通过以下检查后才进入 rebuttal——analyst 的报告是主来源，其自身纪律（磁盘优先于日志、每个指标点名来源）默认成立但**要重开核对，不能光信**：

1. 重开该 run 的 `EXPT_ANALYSIS_<date>.md`；将出现在 rebuttal 里的每个数字，沿报告引用的来源确认数值与 split。
2. 实验是否真的回答了**底层**疑虑（而非表面句子）？
3. 对比条件是否匹配（数据、backbone、预算、调参、FLOPs——看疑虑落在哪一项）？指标是否就是 criterion 所指的那个？
4. runs/seeds 与不确定度是否配得上论断强度？没有有效显著性检验 → 不写显著性。
5. 归类：阳性 / 阴性 / 混合 / inconclusive；准确点名它支持哪条论断、以及它带来的新局限。
6. 绝不把 inconclusive 转写成阳性；绝不隐藏阴性。

整合后的意见状态词表：`RESOLVED` / `PARTIALLY_RESOLVED` / `UNRESOLVED` / `RESOLVED_BY_CLARIFICATION` / `CONCEDED_AND_NARROWED` / `DEFERRED_TO_RESUBMISSION`。

### 什么进入 rebuttal

纳入：与决定相关、方法上可解释、已核实、能简洁说清、直接挂到意见 ID 的结果。省略或限定：仓促不可靠、缺公平对照、篇幅内讲不清的自相矛盾、答非所问的结果。**阴性或混合结果**仍可通过支撑更窄、更可信的论断加强论证：

> 所要求的分析并不支持 [宽论断]。它显示增益在 [条件] 下成立、在 [条件] 下不成立。我们将在摘要与结论中收窄该论断，并显式写明此局限。

## Part C：诚信规则

**允许的证据**：提供的摘要与稿件文本；按 Part A 核实的稿件位置；经报告触达的已完成实验与分析；修正后的推导；可复现的数值汇总；来自 `reference.bib` 的引用（以 venue 政策为限）。

**无一例外的禁止**：编造实验数值；编造评审引文；编造稿件位置；把计划中的工作说成已完成（对 `[RESULT NEEDED]` 行写"we have run"）；暗示评审同意过不存在的事；没有检验就声称显著；隐瞒补做实验的阴性结果；把不确定的评审意图说成确定；承诺未来实验必然成功；推荐缺乏可解释对照的仓促实验。不确定时明说，并给出最安全的下一步。

## Part D：路由

本技能发现但不归它管的事，一律路由、绝不就地代办：

| 发现 | 路由 |
|---|---|
| 证据缺失 → 确认要跑的实验 | `/star-plan-decomposer`（候选叶子；protocol = done-criterion） |
| 叶子已建、未跑 / STOP 线命令待执行 | `/star-plan-executor <leaf>` |
| 已跑完、还没有分析报告 | `/star-expt-analyst <leaf>` |
| 结果与某计划文本相矛盾 | `/star-plan-reviser <slug>` |
| 评审点出 bib 缺失的更近论文 | `/star-refs-reviewer <arxiv-id>` |
| 修订清单承诺的稿件改动（有 `paper/` 时） | `/star-paper-writer revise`（可用后） |
| 结果命中 root §5 kill-criterion | 作为 **Strategy signal** 呈报：`/star-plan-reviser`，再视情 coach/decomposer |
