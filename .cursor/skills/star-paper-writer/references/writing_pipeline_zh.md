# 写作流水线 — 阶段、顺序、修辞 moves、检查单（中文版）

改编自 SNL-UCSB/paper-writing-skill（MIT；源自对六篇论文、7,600+ 次编辑的取证式分析），
brainstorming 阶段替换为 STAR 制品编译。流水线固定；声音默认值在 `style_gates_zh.md`。
与英文版 `writing_pipeline.md` 冲突时以英文版为准。

## Part A：五个阶段

**A — Project context。** STAR 已经握有 brainstorming 访谈想问出的东西：身份句（root
plan §1 / idea §5）、贡献主张（root §3 + `results.md` 锚定）、评测形状（root §4）、锁定
决策（各计划）、gap 与定位（`related_work.md`）。编译、展示、确认。只有 venue、页预算
和声音覆盖才真正需要用户补。含糊的 context 产出含糊的论文——锚定缺失的贡献**现在**就标。

**B — 架构。** 大纲表在任何行文存在之前，给每个章节指派页预算、关键 claim（带锚定）与
图表。检验标准：introduction 将做出的每个承诺，都映射到一个带证据锚定的 evaluation
小节。图表计划来自已存在的东西——`wkdrs/<run>/analysis/` 的渲染与 `results.md` 的表——
而不是希望存在的图。

**C — 章节起草，按此顺序，别无其他：**

1. **Draft-0 introduction** —— 可弃的框架脚手架：stakes、问题 gap、粗贡献主张。它给
   evaluation 立护栏，注定活不到最后；写它是思考工具。用户要跳过就解释：没有框架护栏
   的 evaluation 会产出无法拧成一个论证的实验——然后听用户的。
2. **Evaluation** —— 在 Draft-0 护栏约束下；每个数字过台账。
3. **Method / design** —— 取自 `framework.md` + `training.md` + `dataset.md`。
4. **Background** —— 只写 venue 读者真正缺的。
5. **Related work** —— 从 `metds/refs/related_work.md` 改写，主题与 citekey 原样，套
   venue 语域。
6. **最终 introduction** —— 对照写完的 evaluation **从零重写**：承诺恰好等于证据所能
   支撑的。Draft-0 是参照物，不是编辑底稿。
7. **Abstract** —— 最后写，取自最终 introduction 的 claims。

**每章节脚手架。** 先写 topic sentences 并连读——它们必须在没有正文时独自撑起论证，然后
才填段落。LaTeX 里给每段加目的注释（`% Stakes: …`、`% Gap: …`）；每条注释是合同，随后
的段落必须兑现。

**D — 整合。** 术语漂移（grep：一概念一名）、claim–证据映射、关键抽象贯穿（命名概念出现
在 intro、method、evaluation setup 与 related-work 定位中）、过渡审计（¶N 末句 → ¶N+1
首句）、signposting（每个章节开头说清该节的结论）、版面平衡。

**E — 压缩。** 七操作（`style_gates_zh.md` Part D），目标降 30–50%，前后字符数报数。
绝不为页限凑字。

## Part B：各章节修辞 moves

**Introduction（6 moves）**：Stakes（谁在受苦、领域为何重要）→ Problem Gap（**结构性**
局限——"现有工具假设 X，在 Y 上失效"，而非"精度不够"）→ Key Abstraction（承载洞见的命名
概念）→ Design Intuition（为何该有效，一段）→ Contributions（编号、claim 先行、有数字的
带数字）→ Results Preview（带锚定的头条数字）。

**Evaluation（6 moves）**：Setup Anchoring（数据集、baseline、指标、协议——一次说全）→
Head-to-Head（主表，解读而非仅引用）→ Deep Dive（哪里赢/输、为什么）→ Takeaway
Synthesis（每个实验簇以 Takeaway 段收束）→ Ablation（每个组件的必要性）→ Robustness
（seeds、规模、偏移——恰好是 `results.md` 支撑的范围）。

**Method / design（5 moves）**：Abstraction Introduction（命名概念先行）→ Design
Justification（每个选择立刻带"因为"）→ Component Architecture（读者能走通的一条数据
通路）→ Key Design Decision（那个不显然的选择，给出辩护）→ Robustness/Limits（设计不
处理什么）。

**Related work（3 moves）**：Category Clustering（按 `related_work.md` 的主题，非编年）→
Per-Category Limitation（这些工作对**本问题**做不到什么，每句以其笔记为界）→
Positioning Sentence（它们都做不到的事——本文的位置，root plan §2 背书）。

## Part C：章节检查单（起草后、呈现前运行）

严重度：CRITICAL（结构性，拒稿级）/ MAJOR（评审可见）/ MINOR。

**Introduction**：一句话身份？gap 是结构性而非数量性？每条贡献 claim 先行且有锚定（或
标 not-yet-supported）？结果带数字预告？没有无 evaluation 小节对应的承诺？有 outline 段？

**Evaluation**：仅凭本节可复现 setup？领域期待的 baseline（按 `related_work.md`）在场或
缺席有解释？每个表/图有行文解读？每簇有 Takeaway 收束？论断尺寸匹配 seeds/split
（`results.md` 的 verdict）？没有无锚定的数字？

**Method**：读者能端到端走通数据通路？每个符号先定义后使用？每个设计选择有辩护？不依赖
尚未展示的结果？与 `framework.md` 一致——不一致意味着计划动了，路由出去。

**Related work**：按主题组织？每句特征化不超其笔记 depth？每个 cite 键真实存在？定位段
在场且与 intro 的 gap 一致？没有综述不支持的"first to"？

**Abstract**：问题、方法、头条结果（带锚定）、范围——用 venue 语域，无 venue 不期待的
引用，长度合规。
