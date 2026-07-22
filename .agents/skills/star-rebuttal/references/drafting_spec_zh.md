# 起草规格 — 结构、模式、语气、转投、质检（中文版）

改编自 TobiasLee/Rebuttal-Skill（作者授权，2026-07-22）与 Galaxy-Dawn/claude-scholar review-response（MIT）。此处一切以 `evidence_spec_zh.md` 为前提：没有锚定就没有论断。与英文版 `drafting_spec.md` 冲突时以英文版为准。Rebuttal 正文语言随 venue 惯例（通常为英文）；下述模板保留英文原文，中文说明只解释用法。

## Part A：写作原则

1. **写给中立的裁决者。** 名义收件人是评审，真正的读者可能是要略读十二份 rebuttal 的 area chair。每个 major response 讲清：疑虑是什么、底层疑问是什么、作者同意/不同意/部分同意、证据是什么、论文会改什么。
2. **答案先行** —— Direct Answer → Evidence → Revision。
   - 弱："We thank the reviewer for this interesting question. Our method contains…"
   - 强："**Yes. The improvement remains under matched compute.** In the new experiment, our method obtains [X ± s] versus [Y ± t] for Baseline A using the same data, backbone, tuning budget, and FLOPs (results.md · claim 1 · run 00_mvp). We will add the result to Table [N] and clarify the comparison protocol."
3. **按决策关键疑虑组织**，不逐评审复读：① fatal 或核心技术疑虑；② 共享的 major 疑虑；③ 实证有效性与公平对比；④ novelty 与定位；⑤ 泛化、鲁棒性、效率、可复现性；⑥ 范围与清晰度；⑦ minor comments。共享疑虑合并作答，除非 venue 表单不允许。
4. **目标不是均匀回答每句话**，而是解决少数决定录取的疑点。投入随 matrix 的严重度 × 共享度 × 决策影响走，不随评论出现的顺序走。

## Part B：模板

**开场摘要**（绝不编造赞扬；引用的优点必须存在于 `reviews_raw.md`）：

> We thank the reviewers for their careful feedback. They recognize [strength 1] (R1, R2), [strength 2] (R3). The main concerns are **(1)** [major concern], **(2)** [major concern], and **(3)** [major concern]. We address these below with new evidence and concrete revisions.

批评性评审集变体：

> We thank the reviewers for the detailed feedback. While they raise important concerns about [central issue], they also recognize [merit]. We clarify the intended scope, provide the requested evidence where feasible, and specify the corresponding revisions below.

**Major response 块**（每个合并疑虑一块，标题带意见 ID 与评审号）：

```markdown
### C3. Performance under matched compute — R1, R3

**Concern.** <忠实的一句话转述>

**Response.** <首句即直接答案>

**Evidence.** <结果/推导/稿件证据，附解释所需的对比条件与不确定度，逐条按
evidence_spec 锚定>

**Revision.** <对论文的确切修改：位置 + 改什么>
```

**Minor comments**，紧凑归组：

> **Minor comments.** We will define [term] at first use (R1), add the missing citation to [@citekey] (R2), correct Eq. (5) (R2), and expand the implementation details in Appendix D (R3).

**修订清单**：每条承诺的修改一行编号——位置（按 `evidence_spec_zh.md` Part A 核实）、修改内容、服务的意见 ID。这份清单就是日后 `$star-paper-writer revise` 要执行的东西——写到可执行的精度。

## Part C：回应模式与语气

**纠正误解**——先揽论文的责任，绝不质疑评审能力：

> **The method does not require [assumption]; it requires only [actual assumption].** This is stated in Section [N], but our presentation may have obscured the distinction. We will revise the paragraph and add [example].

**承认成立的局限**：

> **We agree that the current evidence does not establish [broad claim].** It supports the narrower claim that [supported claim] under [conditions]. We will narrow the abstract and conclusion and add this limitation to Section [N].

**汇报已完成的实验**：

> **We completed the requested [comparison/ablation/robustness test].** Under matched [data/compute/tuning], our method obtains [result] versus [baseline result] over [N] runs. This supports [specific claim]. We will add the setup and result to [location].

**无法按时可靠完成的实验**：

> We agree this experiment would be informative. Completing it reliably requires [reason], and we do not want to report an under-validated result. The current evidence supports [narrow claim]; we will clarify this scope and add the requested experiment to the revision plan.

**Novelty 疑虑**——先建 delta 表再落笔；绝不只用"已知组件的未见组合"论证 novelty：

| Prior work | Capability or assumption | This paper's difference | Why it matters |
|---|---|---|---|

> The contribution is not merely [common component]. It is **(i)** [new formulation], **(ii)** [new capability], and **(iii)** [new finding]. [@workA] differs in [specific distinction]; [@workB] assumes [specific assumption].

**缺 baseline / 对比不公**：同意条件应当对齐，写出现已对齐的协议（[split]、[budget]、[backbone]、[selection]），给出带锚定的结果，承诺在论文中写明对照。

**统计可靠性**：以 mean ± sd 汇报 [N] 次独立运行的 [metric] 并点名区间或检验；没有有效检验 → 不出现显著性措辞。

**分数与文字不符**——公开回应保持实质内容；有保密通道时：

> We respectfully ask the chair to consider whether the numerical score is consistent with the review text, which recognizes [positive assessment] and does not identify [fatal issue].

绝不施压评审改分。

**评审过程问题**（空泛批评、无依据的 novelty 论断、不专业语气、预期与论文自述类型不符、被引工作并不支持的事实性断言）：与技术分歧分开处理；有保密通道则用之——只引必要文字、就事论事、援引 venue 准则、说明其对公平评审的影响、绝不揣测意图或身份。

**语气**——采用："We agree…"、"We clarify…"、"Our presentation may have obscured…"、"The intended claim is…"、"The new result shows…"、"We will narrow…"、"We will revise…"。避免："The reviewer failed to understand…"、"This is obviously wrong"、"This criticism is unfair"、揣测动机、强硬要分、反复客套致谢。Rebuttal 应读起来冷静、精确、便于中立 chair 审计。

**压缩**——超限时按序删：① 重复致谢；② 重复的评审引文；③ 泛泛背景；④ 形容词与修辞装饰；⑤ 跨评审的重复回应；⑥ 低影响 minor comments；⑦ 解释证据所不必需的实现细节。不惜代价保留：直接答案、关键数字、对比条件、不确定度、假设、论断收窄、稿件修改、未解决的局限。报告最终字数/字符数与限额的对比。

## Part D：转投模式

产出 `resubmission_plan.md`，含：

1. **决定诊断**——主导拒稿机制：贡献不清 / 证据不足 / 技术缺陷 / 评测不公 / novelty 定位薄弱 / venue 不匹配 / 过度声称 / 写作与组织 / 多个独立疑虑且无支持者。
2. **Preserve / change / remove 表。**
3. **修订清单**：`R0 — 不改无法转投` / `R1 — 强烈建议` / `R2 — 提升完整性` / `R3 — 可选打磨`。
4. **下次投稿实验计划**——每个实验：假设、对应疑虑、协议、期望信息增益、成本、停止准则、以及阳性/阴性/空结果各自的含义。这些与 Stage 1 的行一样，是给 `$star-plan-decomposer` 的候选叶子。
5. **故事与论断修订**——修订后的一句话贡献、修订后的摘要论断、最强的可辩护 novelty 表述、要收窄的论断、要前置的局限、该升格或降格的结果。
6. **论文结构修订**——从标题到附录的逐节具体修改。

把转投表述为回报更高的路径，绝不是失败。

## Part E：质检清单与反模式

`quality` 模式按本清单审计草稿，最严重在前（严重度：CRITICAL / MAJOR / MINOR），只读。

**分诊**：venue 分制与 borderline 已确认或明标未知；promising / uncertain / low-return 用校准措辞区分；全员低于 borderline 触发了显式的转投考量；点名了最强正负信号。
**诊断**：每条表面评论都有底层决策疑问；含混评论带替代解释与可见置信度；共享疑虑已合并。
**计划**：每个实验挂到意见 ID 并带 P0–P3 / DO-NOT-RUN 标签；优先级反映 Part C 各维度；P0 在期限内可行；协议带 baseline 与对照；写明阴性结果含义；澄清没有被伪装成实验；长周期工作已推迟。
**草稿**：major 在 minor 之前；每个 major response 以直接答案开头；每个实证论断有锚定；相关处有匹配条件与不确定度；成立的局限已承认；证据不够处论断已收窄；修订具体；自成一体；语气专业；符合 venue 限额。
**诚信**：无编造的结果、引文、引用或位置；计划中的工作未被说成完成；评审意图未被夸大；阴性结果未被隐藏；过程投诉已分离；每个占位符可见。

**反模式**——见即标记：还没识别真正疑虑就打磨成稿；把每句话当同等重要；不排序的实验愿望清单；决策关键的 P0 之前先做省事的 P2；假定含混意图；答非所问的实验；用宏大的未来工作代替当下证据；把直接答案埋起来；对每位评审重复同一回应；把一切批评当误解；攻击评审能力；用单个仓促结果过度声称；全员明显低于 borderline 还烧完整个窗口；反之在简短事实纠正仍有用时彻底放弃。
