# 声明对账规格 — 论文对照它自己的仓库（中文版）

分类法改编自 open-paper-machine 的 `/audit-paper`（已授权），重新落在 STAR 制品注册表
上。对账对每条声明只回答一个问题：**项目自己的证据说的和论文说的一样吗？** 与英文版
`claim_audit_spec.md` 冲突时以英文版为准。

## Part A：什么算可对账声明

- 任何作为结果呈现的数字（指标、增益、成本、加速比、计数）；
- 任何关于自身工作的比较级（"outperforms"、"reduces"、"matches"）；
- 任何焊在结果上的范围副词（"consistently"、"across all"、"state of the art"）；
- 任何关于证据的过程性声明（"averaged over N seeds"、"same backbone"）。

框架叙事、对他人数字的引用、设计意图不在此对账——引用走键存在性与笔记深度检查
（writer 的台账）；设计意图只有被说成"已达成"时才对照方法文档。

## Part B：证据顺序与匹配

按权威顺序追溯：`metds/results.md`（聚合且复核过的台账）→ 该 run 的
`wkdrs/<run>/EXPT_ANALYSIS_<date>.md` → 到此为止。原始产物是 analyst 的领地；线索到不了
报告，这条声明就不在此处对账。匹配是**数值 + 单位/尺度 + split + run** 四合一：
34.8 mIoU（ADE20K val，run 10_edgeseg-ade20k）只匹配一模一样的行。

## Part C：五个类别

| 类别 | 含义 | 规则 |
|---|---|---|
| `CONFIRMED` | 有制品陈述该声明 | 数值、split、范围全匹配；指针引出 |
| `PARTIAL` | 匹配但有已声明的良性缺口 | 末位以内的取整；句子暗示的范围比行宽（说明哪里）；数值匹配但句子夸大了 seeds |
| `MISSING` | 没有制品承载 | 含关于从未进台账的 run 的声明 |
| `MISMATCH` | 有制品与之矛盾 | 数值错、split 错、或该行被 §5 排除（invalid/inconclusive）——**两边原文都引** |
| `NOT_AUDITABLE` | 裁定需要一次 run 或外部来源 | 点名能裁定它的 run 或来源 |

硬规则：超出末位的取整是 `MISMATCH` 不是 `PARTIAL`（41.23 → "41.2" 可以；→ "41.5"
mismatch）。唯一的行被排除的数字是 `MISMATCH`，引出排除原因。表定稿前，**对每个
`CONFIRMED` 与 `MISMATCH` 行重开被引制品**——引错台账的对账比没有更糟。CONFIRMED 行
超过 10 条时另随机抽 3 条复核并写明。

## Part D：输出与路由

对账表列：声明（引文）· 草稿位置 · 证据指针 · 类别 · 备注。清点行：各类计数。按类路由：
`MISSING` → `$star-plan-decomposer`（产出它的叶子）或 `$star-expt-analyst aggregate`
（报告在、台账旧）；`MISMATCH` → 论文错则 `$star-paper-writer revise`，制品链可疑则
`$star-expt-analyst` 重分析再 `$star-plan-reviser`；`NOT_AUDITABLE` → 点名的 run 走
executor 回路；`PARTIAL` → `revise` 里的措辞修正。
