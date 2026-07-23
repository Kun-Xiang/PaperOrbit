# 章节规则 — 起草界限、refiner、缺口（中文版）

起草契约一句话：**笔记是来源，bib 是引用空间，depth 字段是天花板。** Reviewer–refiner
思想承 IterSurvey（已授权，概念层）。与英文版 `section_rules.md` 冲突时以英文版为准。

## Part A：起草界限（逐节强制）

1. **引用空间**：每个 `[@citekey]` 存在于 `metds/refs/reference.bib`——章节呈现前机械
   核验（`grep` 键）。值得引却无条目的论文路由 `/star-refs-reviewer`；该句等待，或
   不带引用标记地点名并加 `[CITATION NEEDED — <id>]` 占位符。
2. **特征化天花板**：关于某论文做什么、假设什么、达到什么的论断出自该论文的笔记
   （`metds/refs/<ABBREV>.md`）、深度不超其 `depth:`——摘要深度的笔记支撑 "proposes X
   for Y"，不支撑实现细节。池内论文的 §5（relation）是综述比较论述的燃料。
3. **只点名**：无笔记的广度行可用其记录事实（标题、venue、年份、一句话主题）*点名*——
   绝不超出其缓存摘要做特征化，其引用同样需要 bib 条目（要么路由、要么点名不引）。
4. **一切不来自记忆**：不在笔记、缓存记录或 bib 里的论文、数字、论断一概不入。综述的
   可信度恰好等于它的可溯源性。
5. **他文数字**：只以 "reported by [@citekey]" 形式引用、以笔记为来源；除非每格的笔记
   都写明同一协议，绝不横向归一化成比较表——协议混杂的表是综述版的不公平 baseline。
6. **节内结构**：开头范围句 → 论文按该节内在逻辑（而非清单顺序）组织 → 笔记支撑的
   对比与趋势 → 收尾 takeaway（这一片对领域意味着什么）。篇幅在大纲目标 ±30% 内。
7. **立即写盘**：每节完成即落 `sections/<n>_<slug>.md`，大纲状态映射同步更新。

## Part B：缺口是产出

所辖笔记撑不起范围的节，就写成明说的文字：该节本应覆盖什么、哪些论文能覆盖、路由
（逐篇 `/star-refs-reviewer <id>`）。缺口清单汇总进摘要。用泛泛而谈给薄节注水，正是
漏斗要防止的失败。

## Part C：Refiner（拼合稿上，一轮）

全部章节就绪后、组装 `survey.md` 之前运行：

1. **过渡**：每节开头衔接上一节 takeaway；只读各节开头与 takeaway 也能听见轴的主线。
2. **分类学一致**：跨节一概念一名（grep 同义词）；intro 的分类图/表与章节结构严格对应。
3. **引用-论断抽查**：随机重开 5 个被引笔记，核对其承载句——不符即触发整节重查，而非
   就地打补丁。
4. **覆盖重述**：intro 的范围契约仍与各节交付一致；大纲门之后丢掉的东西点名。
5. **Intro 与 conclusion 最后写**：从成型的章节出发——intro 承诺已存在的东西；
   conclusion 综合已在节 takeaway 里落地的趋势与开放问题（开放问题引出暴露它们的笔记）。

更深的评审按需：`/star-paper-reviewer metds/survey/<slug>/survey.md` 对拼合综述跑人格
评审与检查单。

## Part D：组装与过期契约

`survey.md` = intro + 章节（大纲顺序）+ conclusion + 附录缺口清单。frontmatter：
`type: survey`、`language`、`generated:`（真实日期）、`sources:`——**读取时**的
`reference.bib` 条目数与 `refs_index.md` 审计日期，外加消费的笔记清单。
`star-flow-status` 用精确值对比这些记录与当前基座；基座长大即标综述过期
（`/star-survey-writer refine`）。来源未变的重生成不写任何东西；实质性重生成给节级
变更清单加一问；目标处的手写文件绝不因 diff 而覆盖。
