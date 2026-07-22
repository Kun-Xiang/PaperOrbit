# 分诊规格 — 可行性、诊断、分级、实验计划（中文版）

改编自 TobiasLee/Rebuttal-Skill（作者授权，2026-07-22）。Part A 是整个周期的门；Part B–C 填 concern matrix；Part D 建 experiment ledger；Part E 组装首次回应。与英文版 `triage_spec.md` 冲突时以英文版为准。

## Part A：rebuttal 还是 resubmission 门

### A.1 归一化分制

不假设通用的 borderline。确认（未知处向用户问一次）：venue 与分数区间；每档分数的语义；大致录取线；是否有 AC 讨论阶段、评审能否改分、rebuttal 期是否允许新实验。borderline 未知 → 评估明写 **provisional**。

### A.2 判可行性

**`PROMISING`** — 典型信号：至少一位评审为正面或明显高于 borderline；负面集中在可回答的误解或可补的证据；无人指出致命正确性缺陷；核心疑虑能在窗口内解决；解决一两个疑点很可能改变决定。动作：投入针对性 rebuttal 实验，优先共享的 major 疑虑，做完整回应。

**`BORDERLINE / UNCERTAIN`** — 信号：分数聚在 borderline 附近；评审承认实在的优点但列出若干可修复问题；评审意图含混；一个决定性实验或澄清可能翻盘。动作：只跑高价值、快周转的实验，准备精炼 rebuttal，同时记录转投级修订。

**`LOW EXPECTED RETURN`** — 信号：**全部评分低于 borderline**；没有正面评审或支持者；多位评审独立质疑核心前提、正确性、novelty 或实证有效性；所需证据无法按时可靠产出；解决疑虑意味着重设计方法或重写核心故事。动作：明说大规模 rebuttal 工作期望回报低、转投多半是更高价值路径；不鼓励为显得积极而跑仓促实验；可提供只纠正实质性事实错误的最小专业回应；给出 resubmission 计划。

绝不宣称拒稿已成定局。校准措辞：

> 基于当前分数分布与疑虑性质，大规模 rebuttal 工作的期望回报看起来较低。一份简短回应仍可纠正实质性误解，但更高价值的路径很可能是更充分的修订与转投。

### A.3 低回报情形的必备输出

1. 为什么 rebuttal 期望价值低；2. 现在仍值得回应什么；3. 不该花时间在什么上；4. 转投诊断；5. 按优先级的修订路线图；6. 下次投稿建议补的实验；7. 论断/框架/写作修改建议；8. 目标 venue 考量（仅在信息足够时）。（第 4–8 项格式见 `drafting_spec_zh.md` Part D。）

### A.4 Claim map

从摘要（或提供的 `paper/` / `metds/overview.md` / root plan）提取：问题、主贡献、声称的 novelty、声称的实证结果、声称的适用范围、以及最可能决定录取的关键论断。标出比评审可见证据更宽的论断——`SCOPE_OR_OVERCLAIM` 类意见会落在那里。

## Part B：逐条诊断评审

### B.1 拆成原子意见

一段评审可能含多个疑虑；拆开。例："方法太贵、与 X 的对比不公平、相对 Y 的 novelty 不清楚。" → C1 计算成本；C2 与 X 对比的公平性；C3 相对 Y 的 novelty。每条意见得到一个 ID（`C1`、`C2`、…），台账、草稿与路由都复用它。

### B.2 推断底层原因（必做）

每条原子意见记录：**表面评论**（字面所写）、**底层疑虑**（措辞背后与决定相关的疑问）、**能解决它的证据**、**解释的置信度**。常见底层疑虑：技术正确性；增益是否来自不公平对比；是否只在挑过的设置下成立；是否真有 novelty；任务是否重要；统计是否可靠；是否可扩展；是否可复现；成本是否配得上收益；论断是否比证据宽；论文不清楚导致评审困惑；评审套用了论文从未声称的预期。

### B.3 意图不明时的诊断卡

多种解释都说得通时，绝不默默选边。在 matrix §5 填卡：**评审原文**（忠实短引）；**最可能的底层疑虑** / **替代解释**；**置信度**（high / medium / low）与**不确定的原因**（缺引用、措辞含糊、分数与文字不符、自相矛盾）；**能同时回答两种解释的证据**——可行时优先；**问作者的问题**——仅当必须依赖作者知识时，经 AskUserQuestion 以候选解释作选项；**安全回应策略**：两种读法下都成立的措辞。

### B.4 类别与回应模式

主类别，每条一个：`CORRECTNESS` / `NOVELTY` / `EMPIRICAL_SUPPORT` / `FAIR_COMPARISON` / `MISSING_BASELINE` / `GENERALIZATION` / `ROBUSTNESS` / `STATISTICAL_RELIABILITY` / `EFFICIENCY` / `SCALABILITY` / `REPRODUCIBILITY` / `SIGNIFICANCE` / `SCOPE_OR_OVERCLAIM` / `RELATED_WORK` / `CLARITY` / `PRESENTATION` / `REVIEW_PROCESS`。

可能的回应模式：`NEW_EXPERIMENT` / `NEW_ANALYSIS` / `EXISTING_EVIDENCE` / `CLARIFICATION` / `CORRECTION` / `CLAIM_NARROWING` / `MANUSCRIPT_REVISION` / `CONFIDENTIAL_CHAIR_NOTE` / `DEFER_TO_RESUBMISSION`。

## Part C：严重度与优先级维度

- **严重度** — `FATAL`：若成立且未解决，主论断即失败（核心方法正确性缺陷、数据泄漏、无效评测协议、主结果不可解释的对比、novelty 被已有工作否定）。`MAJOR`：可能导致拒稿，但解决后论文仍成立（缺强 baseline、泛化缺口、缺核心消融、算力未对齐、统计薄弱）。`MODERATE`：影响置信、范围或呈现。`MINOR`：错别字、局部清晰度、小的引用遗漏。
- **决策影响** — `HIGH` / `MEDIUM` / `LOW`：解决它能多大程度改变决定。与严重度不同：低置信离群评审的 major 疑虑，可能不如共享的 moderate 疑虑重要。
- **共享度** — `ALL_REVIEWERS` / `MULTIPLE_REVIEWERS` / `SINGLE_REVIEWER` / `META_REVIEW_OR_CHAIR`。共享疑虑优先。
- **解决置信度** — `HIGH`：既有证据或一个直接实验即可回答；`MEDIUM`：大概率可答但结果不确定；`LOW`：需要重设计、拿不到的数据或投机性证据。

## Part D：P0–P3 实验计划

### D.1 优先级标签

- **`P0 — 现在必须做`**：解决 fatal 或 major 且共享/决策关键的疑虑；DDL 内可行；即使阴性也可解释；没有既有证据已覆盖。
- **`P1 — 有时间就做，价值高`**：显著加强论证；major 的单评审疑虑或共享的 moderate 疑虑；在全部 P0 之后可行且不危及它们。
- **`P2 — 锦上添花`**：支撑次要论断或完整性；便宜；不拖累更高优先级。
- **`P3 — 推迟到修订/转投`**：需要大量工程、数据或重设计；DDL 前无法可靠验证；影响低；或范围澄清即可应付 rebuttal。
- **`DO NOT RUN`**：不回答底层疑虑；与既有证据重复；缺对照而不可解释；会耗尽窗口而 major 仍未解决；出于焦虑而非决策价值。每行写明命中哪条。

排序启发式——定性、可用文字解释、绝不摆成精确评分：`decision_impact × sharedness × severity × expected_information_gain × feasibility / cost`。

### D.2 台账行要求

每行实验写明：对应的意见 ID；决策问题；baseline 与对照条件；数据集或评测子集；指标；算力/数据对齐方式；需要时的 seeds 或重复次数；支撑目标论断所需的最低结果；阴性结果意味着什么；未完成时的兜底措辞；时间/成本估计。**单元路由给 `/star-plan-decomposer` 时，minimum viable protocol 原样成为叶子的 §5 done-criterion**——写到 executor 能直接校验的程度。

### D.3 偏好高信息密度实验

一个实验回答多条疑虑，胜过三个窄实验：算力对齐对比覆盖公平性 + 效率 + baseline；多 seed 覆盖方差 + 可靠性 + cherry-picking；跨域评测覆盖真实性 + 泛化；组件消融覆盖机制 + novelty + 必要性。

### D.4 三个桶；澄清不是实验

每条疑虑归入且仅归入一个桶：**现在就跑**（确认的 P0/P1 集合）/ **用既有证据或澄清回答** / **推迟到修订或转投**。绝不为显得努力而推荐实验。

### D.5 时间预算

已知 DDL 时给出建议分配并按实际调整：约前 10% 核实解释、冻结协议；约 60% 执行 P0；约 20% 分析并起草 major responses；约最后 10% 一致性、语气与篇幅检查。P0 结果落袋前绝不给 P2 拨时间。

## Part E：首次回应的组装

Stage 1 给用户的报告依次包含：**A** 可行性（分类、分数解读、最强正负信号、假设与缺失的 venue 信息）；**B** 带过宽标记的 claim map；**C** 意见表（matrix §3 摘要）；**D** 意见-证据映射——既有 STAR 制品已能回答什么（`evidence_spec_zh.md`）；**E** P0–P3 计划与路由说明（"确认的单元交给 `/star-plan-decomposer`"）；**F** 时间预算建议；**G** 家族接下来会发生什么（executor 跑、analyst 打分、回到这里 `integrate`）；**H** Part A 判低回报时的转投路线图。聊天摘要 ≤400 字；完整细节在 matrix 与 ledger 文件里。
