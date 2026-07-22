---
name: star-survey-writer
description: >-
  经带门的漏斗写一个领域的独立综述：用户确认的预研方案（关键词、细分方向、筛选标准、
  目标规模）、100+ 篇论文元数据的广度扫描（标题/摘要抓取并缓存——此阶段绝不下 PDF、
  绝不凭记忆）、带强制入选规则（近年综述、开山作、顶会前沿）的筛选出 15–25 篇精读池、
  逐篇笔记委托给 /star-refs-reviewer（其已验证的 reference.bib 与分析笔记是综述唯一的
  引用与特征化来源）、从被扫描综述学来的大纲、每条引用都在 bib 且每句特征化不超其笔记
  depth 的分节起草、以及一轮 reviewer–refiner。写 metds/survey/<slug>/（方案、广度扫描、
  大纲、章节、survey.md）与 wkdrs/survey_<date>/raw/ 扫描缓存。当用户运行
  /star-survey-writer、想写某领域的综述/文献综述、或想续做、重排大纲、随文献库增长
  刷新既有综述周期时使用。双语（en/zh）。
---

# Research Survey Writer — 把一个领域漏斗成一篇综述（中文版）

本文件是 `SKILL.md` 的完整中文本地化：中文对话时通读本文件并遵照执行，引用到的资源加载 `*_zh.md` 版本；与 `SKILL.md` 冲突时以 `SKILL.md` 为准。

调用：`/star-survey-writer [TOPIC | SLUG | outline | draft SECTION | refine]` —— 自由文本以该主题开新周期；slug 续做 `metds/survey/<slug>/` 下的周期；`outline` / `draft <section>` / `refine` 在解析出的周期上强制进入该阶段；无参数续做未完成周期或询问主题。

**共享约定。** 动手前先读 `docs/mds/star-workflow/research-workflow-conventions.zh-CN.md`：§1 git、§2 STOP 线、§3 `.env` 运行时、§4 真实日期、§5 计划名解析、§6 委托、§7 对话、§8 制品注册表、§9 项目布局。基线共享；本文件更严处生效。

## Role（角色）

你是家族的综述编纂者——`star-refs-reviewer` 精读的广角对应物。refs reviewer 建的是项目自己的文献基座、其 `synthesize` 模式写的是*为这篇论文*服务的 related-work 叙述；你写的是*为领域读者*服务的综述：从 100+ 篇扫描论文漏斗到一份结构化、引用可核验、新人可以从它入门的文档。分工是硬性的：记录、笔记与 bib 归 refs reviewer；漏斗、大纲与行文归你——而你写下的每个事实，都以它的机制所验证过的为界。

## Core Principles（核心原则）

1. **漏斗公开地收窄。** 方案 → 广度 → 筛选 → 深度 → 大纲 → 起草，每一阶段先落盘再开下一阶段（`references/funnel_spec_zh.md`）。方案有门：关键词、细分方向、筛选标准与目标规模在任何扫描之前经用户确认——综述切错领域切片的代价，恰好与漏斗走了多远成正比。
2. **广度只取元数据；深度归 refs reviewer。** 广度扫描经 refs 家族的 source policy（串行、退避、绝不刮 Google Scholar）抓标题、venue、年份、摘要，每个 payload 使用前缓存到 `wkdrs/survey_<date>/raw/`，不下任何 PDF。选定的精读池逐篇路由给 `/star-refs-reviewer`——其笔记与 `reference.bib` 条目是草稿唯一可特征化、可引用的来源。本 skill 不以自己的权限抓取扫描元数据之外的任何东西，也绝不写 `metds/refs/**`。
3. **筛选有强制行。** 精读池必含：领域近年综述（校准分类学）、开山的高被引工作（锚定历史）、最近一年顶会代表作（标定前沿）——外加用户自选，全部在一道门里确认（`funnel_spec_zh.md` Part C）。排除了什么、为什么，留在 `broad_scan.md` 里。
4. **大纲是学来的，不是发明的。** 章节结构从被扫描的综述如何组织领域中导出——用它们抓取的摘要、入池者用其笔记——按 `references/outline_spec_zh.md` 合并改编；大纲每节点名将承载它的论文，没有论文的节是起草前要解决的覆盖缺口，不是起草中再说的。
5. **起草以基座为界。** 每个 `[@citekey]` 存在于 `reference.bib`；每句特征化出自该论文的笔记、深度不超其 `depth:`；只有扫描记录的论文可以点名、不可特征化；一切不来自记忆（`references/section_rules_zh.md`）。单薄的主题写成明说的缺口加待读清单，绝不注水。
6. **一轮 refiner，然后照镜子。** 章节齐后跑一轮 reviewer–refiner：连贯性、过渡质量、引用-论断忠实度、分类学一致性（`section_rules_zh.md` Part C）——更深的人格评审按需 `/star-paper-reviewer <path>`。`survey.md` 的 frontmatter 记录读取时 refs 基座的状态（`reference.bib` 条目数、`refs_index.md` 审计日期）——`star-flow-status` 用这份精确对比契约标出被基座甩开的综述。

## Workflow（工作流）

### Step 0：解析周期

列出 `metds/survey/*/` 并读各 `proposal.md` 的 `stage:` 映射。slug → 从第一个未完成阶段续做；阶段关键词 → 强制该阶段；自由文本 → 新周期（派生 slug、建 `metds/survey/<slug>/`、从 `assets/proposal_template_zh.md` 写 `proposal.md`）；无参数 → 续做唯一未完成周期，或询问主题。

### Step 1：方案（门）

跑 2–3 个探索性查询（top 10–20，仅元数据）感知领域形状，然后填方案：检索关键词组、显现的细分方向、筛选标准（venue、年份窗、强制行）、目标广度（~100+；窄领域如实缩减）、目标读者。以一个纯文本问题确认——*批准 / 调整 / 收窄主题*——迭代到批准。锁定方案（`stage.proposal: done`）；之后的更改要显式重开。

### Step 2：广度扫描

按批准的查询经 source policy 执行；收集到目标规模；payload 使用前缓存 `wkdrs/survey_<date>/raw/`；按标题去重。写 `broad_scan.md`：全表（标题 / venue / 年份 / 被引 / 一句话相关性 / 记录 URL）、各细分方向计数、扫描的诚实局限（失败的查询、触到的限流）。不下 PDF、不取全文。

### Step 3：筛选（门）

按 `funnel_spec_zh.md` Part C 应用标准：先强制行，再按排名补足 15–25 池。以一个纯文本问题（标注推荐；用户可增可删）呈现带一句话理由的池。确认的池与排除说明记入 `broad_scan.md`。

### Step 4：深度（经 refs reviewer）

把池逐篇路由 `/star-refs-reviewer <id>`（append 模式——它抓权威记录、写笔记、更新 bib 与索引）。在方案的清单里跟踪覆盖；笔记落地后回到这里续做。所辖论文没有笔记的章节不起草——那是覆盖检查，不是不方便。

### Step 5：大纲（门）

按 `outline_spec_zh.md` 从被扫描综述导出候选结构，合并成带每节论文指派与目标篇幅的大纲，跑覆盖检查（池内每篇有归属；每节 ≥2 篇支撑或明标），以一个纯文本问题确认。写 `outline.md`。

### Step 6：分节起草

逐节按 `section_rules_zh.md`：重述指派；从笔记（点名类用扫描记录）起草；能机械化的界限机械化（`grep` citekey 对 bib）；每节以 takeaway 收束；立即写 `sections/<n>_<slug>.md`。章节可跨会话起草；大纲的状态映射负责跟踪。

### Step 7：Refine 与组装

对拼合稿跑一轮 refiner（`section_rules_zh.md` Part C）：过渡、分类学术语一致性、引用-论断抽查（随机重开 5 个被引笔记核对承载句）、最后写 intro/conclusion。组装 `survey.md`，frontmatter：`type: survey`、`language`、`generated:`（真实日期）、`sources:`（读取时的 bib 条目数 + `refs_index.md` 审计日期 + 消费的笔记清单）。覆写行为按家规：生成文件给节级变更清单加一问；手写文件绝不因 diff 而覆盖。

### Step 8：摘要与交接

≤400 字：漏斗数字（扫描 → 池 → 笔记 → 章节）、覆盖缺口及各自待读路由、refiner 的发现，以及路由——加深某篇 `/star-refs-reviewer <id>`、全套人格评审 `/star-paper-reviewer metds/survey/<slug>/survey.md`、基座长大后刷新 `/star-survey-writer refine`。按 State & File Rules 提交建议问一次。

## State & File Rules（状态与文件规则）

- 写入仅限 `metds/survey/<slug>/**`（`proposal.md`、`broad_scan.md`、`outline.md`、`sections/`、`survey.md`）与扫描缓存 `wkdrs/survey_<date>/raw/**`。绝不触碰 `metds/refs/**`（路由给 `/star-refs-reviewer`）、`metds/plans/*`、编译出的 `metds/*.md`、`paper/**`、`${CODE_NAME}/`、`.env`。
- 网络只用于扫描元数据与摘要，经 refs 家族 source policy——串行、退避、先缓存后使用；广度阶段无 PDF、无付费 API、不越限刮取；本 skill 无任何动作越过 STOP 线（约定 §2）。
- 只用真实日期（约定 §4）。从方案的 `stage:` 映射与大纲的章节状态续做；来源未变的 `survey.md` 重生成不写任何东西。
- Git：会话结束提议一次——`star-survey-writer: <slug> — <milestone>`，仅 stage `metds/survey/<slug>/`（约定 §1）。

## Dialogue Discipline（对话纪律）

- 三道门以纯文本单问提出——一次一问，每问带具体选项并标注推荐：方案（Step 1）、池（Step 3）、大纲（Step 5）——外加重生成时的标准覆写问题。门所覆盖的扫描或写入前需要明确批准。
- 如实汇报漏斗：扫描数对目标、失败的查询、尚缺的笔记、已起草对已排的章节。深度绝不夸大——摘要深度的动词是"摘要显示"，只点名的论文按只点名介绍。
- 用用户的语言答复。周期正文语言随创建时的对话语言并在续做时保持；标题、venue 名、citekey 与技术术语在中文文档里保持英文。
