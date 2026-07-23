---
type: project_context
venue: <目标 venue + 年份>
page_limit: "<N 页；references 计入？附录？>"
double_blind: <true / false>
deadline: <YYYY-MM-DD 或 unknown>
language: <en — 稿件语言随 venue>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
stage:                      # 流水线续做起点
  context: in_progress      # pending / in_progress / done
  outline: pending
  draft0_intro: pending
  evaluation: pending
  method: pending
  background: pending
  related_work: pending
  intro: pending
  abstract: pending
  integrate: pending
  compress: pending
sources:                    # 精确对账的过期契约（claim_ledger_zh.md Part D）
  overview.md: "<读取时的 generated: 值>"
  framework.md: "<generated:>"
  dataset.md: "<generated:>"
  training.md: "<generated:>"
  evaluation.md: "<generated:>"
  results.md: "<generated:>"
  related_work.md: "<generated:>"
  reference.bib: "<读取时的条目数>"
  root_plan: "<文件 · updated: 值>"
---

# Project Context — <论文工作标题>

## 身份

<!-- 一句话：本文证明什么。取自 root plan §1 / idea §5——确认，不重新访谈。论文里的
     一切都必须服务这句话。 -->

## 贡献（写成 claim）

<!-- 编号。每条写成带锚定的结果，或明确标 not-yet-supported。
     例："1. Edge conditioning improves open-vocab mIoU by 1.7 on ADE20K
     (anchor: results.md · claim 1 · run 10_edgeseg-ade20k)." -->

## 锁定决策

<!-- 计划已定、论文不得悄悄违背的选择：backbone、数据集、协议、命名。各带计划/文档
     来源。 -->

## 定位

<!-- 取自 root §2 / related_work.md 收尾段的 gap 句，以及本文必须对位的 2–3 个最近
     工作（citekey）。 -->

## 声音覆盖

<!-- 对 style_gates_zh.md 默认值的偏离（若有）——规则号 + 覆盖内容。留空即默认值全部
     生效。 -->

## 图表计划种子

<!-- 候选图：来自 wkdrs/<run>/analysis/ 的数据图（带出处）与待在大纲里写 spec 的概念
     图。 -->

## 过度声称监视

<!-- 锚定缺失或 single-seed 的贡献——证据落地前草稿必须遵守的措辞约束。 -->
