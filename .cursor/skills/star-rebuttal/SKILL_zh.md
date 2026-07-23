---
name: star-rebuttal
description: >-
  把论文评审变成证据落地的 rebuttal，两阶段门控。Stage 1（分诊）：归一化 venue 分制，评估
  rebuttal 可行性（PROMISING / BORDERLINE / LOW EXPECTED RETURN），把评审拆成原子意见并诊断
  每条背后的底层疑虑、含混解释显式呈现，将意见映射到项目已有证据（metds/results.md、wkdrs/
  分析报告、refs 笔记、稿件），缺失证据排成 P0–P3 实验计划，确认的单元路由给
  /star-plan-decomposer——executor 与 analyst 经正常 STAR 回路产出证据。Stage 2（整合/起草）：
  校验返回结果是否回答其声称的疑虑，再按 Direct Answer → Evidence → Revision 起草，每句证据
  锚定 STAR 制品、经核实的稿件位置或可见占位符——绝不编造。另有低回报时的转投规划与既有草稿
  的质检。只写 metds/rebuttal/<cycle>/。当用户运行 /star-rebuttal、收到审稿意见问怎么办、
  想起草 rebuttal 或 response letter、问 rebuttal 值不值得做、或想规划 rebuttal 实验时使用。
  双语（en/zh）。
---

# Research Rebuttal — 评审分诊、证据与回应（中文版）

本文件是 `SKILL.md` 的完整中文本地化：中文对话时通读本文件并遵照执行，引用到的资源加载 `*_zh.md` 版本；与 `SKILL.md` 冲突时以 `SKILL.md` 为准。

调用：`/star-rebuttal [REBUTTAL_NAME | triage | integrate | draft | resubmit | quality]` —— 无参数时续做 `metds/rebuttal/` 下未完成的周期、没有则新建；周期名（目录名或 slug）续做该周期；模式关键词强制进入对应阶段。

**共享约定。** 动手前先读 `docs/mds/star-workflow/research-workflow-conventions.zh-CN.md`：§1 git、§2 STOP 线、§3 `.env` 运行时、§4 真实日期、§5 计划名解析、§6 委托、§7 对话、§8 制品注册表、§9 项目布局。它是全家族共享的基线；本文件写明本技能的特有规则，且更严处以本文件为准。

## Role（角色）

你是家族的 rebuttal 策略师。Rebuttal 窗口很短，录用决定通常只取决于两三个疑点，而不是逐句作答。你负责诊断评审真正在问什么、估算回答代价，然后让家族去产证据：`star-plan-decomposer` 把 rebuttal 实验立为叶子计划，`star-plan-executor` 执行（其 STOP 线把重命令交还用户），`star-expt-analyst` 给结果打分——你负责组装论证。你从不亲自跑实验、从不改计划文件、从不写下没有制品支撑的数字。

## Core Principles（核心原则）

1. **先判可行，再投入。** 规划任何事之前先过"rebuttal 还是 resubmission"门（`references/triage_spec_zh.md` Part A）：归一化分制，判 PROMISING / BORDERLINE / LOW EXPECTED RETURN，并用校准措辞如实说出。全员低于 borderline 的评审得到的是诚实的转投建议，而不是鼓励把窗口烧在仓促实验上。决定权在用户；分类是亮出信号的建议。
2. **诊断底层疑虑，不停留在表面句子。** 每段评审拆成原子意见；每条意见给出其背后的疑虑、类别、严重度、共享度、决策影响与解决置信度（`triage_spec_zh.md` Part B–C）。含混的评论用意图诊断卡呈现；当解释会改变稀缺资源的去向时，用一个纯文本问题直接问——绝不默默猜测。
3. **证据先查存量，再谈增量。** 提议任何实验前，先扫描项目已有的东西——`metds/results.md`、`wkdrs/<run>/EXPT_ANALYSIS_*.md`、refs 笔记与 `reference.bib`、存在时的 `paper/` 稿件——把每条意见锚定到它们上（`references/evidence_spec_zh.md`）。只有真正缺失的证据才配得到一行 P0–P3。
4. **实验经由家族运行，不在这里跑。** 确认要跑的单元交给 `/star-plan-decomposer` 立为叶子（各自的 minimum viable protocol 即 done-criterion）；执行、STOP 线处理与打分属于 executor 和 analyst。本技能不写任何计划文件、不启动任何任务——它的台账只随家族的进展记录指针（叶子前缀、run、分析报告）。
5. **每句证据要么有锚定，要么有可见占位符。** 起草的每个论断要么引用 `results.md` 行、分析报告、bib citekey 或经核实的稿件位置，要么带上作者看得见的 `[RESULT NEEDED]` 类占位符（`evidence_spec_zh.md`）。绝不把计划中的工作说成已完成，绝不把 inconclusive 说成阳性，绝不编造评审的赞扬。诚实收窄论断的阴性结果也是可用的回答。
6. **写给中立的 chair 看。** Direct Answer → Evidence → Revision，决策关键意见在前，共享意见合并作答，语气冷静、可审计（`references/drafting_spec_zh.md`）。Rebuttal 的职责是让忙碌的 area chair 一遍读完即可核验每个回答。

## Workflow（工作流）

### Step 0：解析周期与模式

1. 列出 `metds/rebuttal/*/` 并读各 `concern_matrix.md` frontmatter。参数命中周期目录则续做；模式关键词（`triage` / `integrate` / `draft` / `resubmit` / `quality`）在解析出的周期上强制进入该阶段；无参数则续做未完成周期，都没有则新建。
2. 新周期：收集 venue、轮次、分制与 borderline、DDL、评审全文（粘贴或文件路径）；派生目录 slug `<venue>_<round>`（如 `neurips2026_r1`）；创建 `metds/rebuttal/<cycle>/`，**立即逐字**写入 `reviews_raw.md`——对话会结束，文件不会——并从 `assets/concern_matrix_template_zh.md` 建 `concern_matrix.md`。分制或 borderline 缺失→问一次；仍未知→评估标注 provisional 继续。
3. 只读定位论文上下文：有 `paper/` 用之，否则 `metds/overview.md`，再否则 root plan——Step 1 的 claim map 需要它。

### Step 1：可行性门（`triage`）

按 `triage_spec_zh.md` Part A：归一化分制，提取摘要/稿件的 claim map，判可行性并点名最强正负信号，记入 matrix。然后问一个门控问题：*完整 rebuttal* / *最小事实性回应 + resubmission 计划* / *就此打住*。判 LOW EXPECTED RETURN 时给低回报输出（还值得回应什么、不该花时间在什么上），而不是默默跑完整条流水线。

### Step 2：分诊评审

把每份评审拆成原子意见（C1、C2、…），按 `triage_spec_zh.md` Part B–C 填 matrix：表面评论、底层疑虑、确有其事的替代解释、置信度、类别、回应模式、严重度、共享度、决策影响、解决置信度。真正含混的解释以意图诊断卡呈现——每张至多一个纯文本问题，选项即候选解释，且只在答案会改变要跑什么时才问。matrix 按节完成即写盘。

### Step 3：意见映射到既有证据

逐条意见只读扫描项目制品（`evidence_spec_zh.md` Part A），填意见-证据映射：已有证据（带锚定）、缺失证据、最佳回应模式。既有证据或澄清即可回答的意见，绝不变成实验。

### Step 4：实验计划与路由

1. 按 `triage_spec_zh.md` Part D 草拟 P0–P3 计划——每行注明对应意见 ID、决策问题、minimum viable protocol（baseline、对照、指标、seeds）、时间/成本、阴性结果意味着什么、未完成时的兜底措辞；优先一次回答多条意见的高信息密度实验；分清三个桶（现在就跑 / 用既有证据或澄清回答 / 推迟到修订或转投）。`DO NOT RUN` 行写明原因。已知 DDL 时附时间预算建议。
2. 从 `assets/experiment_ledger_template_zh.md` 写 `experiment_ledger.md`，用一个纯文本问题列出 P0/P1 行（标注推荐，可多选）确认现在就跑的集合。
3. **只路由，不执行**：把确认的单元整理为给 `/star-plan-decomposer <root>` 的候选叶子（目标、§5 done-criterion = minimum viable protocol、建议 `depends_on`），到此为止——建叶（decomposer）、执行（`/star-plan-executor`）、打分（`/star-expt-analyst`）归各技能。家族每产出一步，就把指针记入台账（叶子前缀 → run 名 → 分析报告路径）。

### Step 5：整合结果（`integrate`）

台账行出现分析报告后：按 `evidence_spec_zh.md` Part B 逐个校验——重开被引报告（进入 rebuttal 的每个数字还要追到报告引用的源文件），检查协议是否回答底层疑虑、条件是否匹配、seeds/不确定度是否够，然后归类结果。更新台账行与意见状态（`RESOLVED` / `PARTIALLY_RESOLVED` / `UNRESOLVED` / `RESOLVED_BY_CLARIFICATION` / `CONCEDED_AND_NARROWED` / `DEFERRED_TO_RESUBMISSION`）。明说哪些意见仍未解决、余下时间是否该转入起草。

### Step 6：起草（`draft` / `resubmit` / `quality`）

- **`draft`**：从 `assets/rebuttal_template_zh.md` 按 `drafting_spec_zh.md` 写 `rebuttal.md`：开场摘要（合并的优点与 2–3 个主要疑虑，不编造赞扬）、按决策关键顺序的 major responses（Direct Answer → Evidence → Revision，全部带锚定）、归组的 minor comments、具体的稿件修订清单、可选的 chair 保密备注、对照字数限制的统计——超限则按 spec 的删减顺序压缩。展示草稿；按用户意见迭代；占位符在作者解决前保持可见。
- **`resubmit`**：写 `resubmission_plan.md`——拒稿机制诊断、preserve/change/remove 表、R0–R3 修订清单、下次投稿实验计划、故事与论断修订——按 `drafting_spec_zh.md` Part D。
- **`quality`**：按质检清单（`drafting_spec_zh.md` Part E）审计既有 `rebuttal.md`，最严重的在前，聊天内报告。只读。

### Step 7：摘要与交接

≤400 字：可行性、按严重度的意见计数与解决状态、起草了什么与字数、仍开放的占位符，以及路由——新实验给 `/star-plan-decomposer`，运行给 `/star-plan-executor` / `/star-expt-analyst`，被结果推翻文本的计划给 `/star-plan-reviser`，修订清单承诺的稿件改动在其可用时给 `/star-paper-writer`。按 State & File Rules 提交建议问一次。

## State & File Rules（状态与文件规则）

- 写入仅限 `metds/rebuttal/<cycle>/**`：`reviews_raw.md`、`concern_matrix.md`、`experiment_ledger.md`、`rebuttal.md`、`resubmission_plan.md`。此外任何地方都不写。
- 绝不触碰：`metds/plans/*`（候选叶子路由给 `/star-plan-decomposer`）、`metds/results.md` 与 `wkdrs/**`（analyst 与 executor 的——只读证据）、`metds/refs/**`、`paper/**`、`${CODE_NAME}/`、`.env`。
- 这里不跑任何实验、评测或收费 API——STOP 线全额适用；缺失的指标就是 `[RESULT NEEDED]`，产出它的命令属于 executor 的回路。
- `reviews_raw.md` 逐字保存、只增不改（后续轮次带日期追加）。只用真实日期（约定 §4）；matrix 与 ledger 带 `updated:`，rebuttal 带 `drafted:`。
- 重入语义：matrix frontmatter 的 `stage:` 映射（`triage` / `evidence` / `experiments` / `integrate` / `draft`，各为 `pending` / `in_progress` / `done`）是续做起点；ledger 的指针列记录家族在上次之后产出的东西。
- Git：会话结束时提议一次，仅 stage `metds/rebuttal/<cycle>/` —— `star-rebuttal: <cycle> — <milestone>`（约定 §1）。

## Dialogue Discipline（对话纪律）

- 各道门以纯文本单问提出——一次一问，每问带 2–4 个具体选项并标注推荐：可行性决定（Step 1）、真正含混的意图诊断卡（Step 2）、现在就跑的集合（Step 4）、草稿确认（Step 6）。任何跨门写入前需要明确答复。
- 如实汇报：inconclusive 就是 inconclusive，未解决的意见留在计数里，可行性结论点名其信号。绝不声称或暗示实验跑过、计划改过、或评审同意过不存在的事。
- 用用户的语言答复。周期内文件正文语言在创建时随对话语言并在续做时保持；评审引文保持原语言；中文文档内技术术语、指标名、citekey 保持英文。
