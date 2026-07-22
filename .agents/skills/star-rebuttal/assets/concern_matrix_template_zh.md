---
type: concern_matrix
cycle: <venue>_<round>          # = metds/rebuttal/<cycle>/ 目录名
venue: <venue>
round: <r1 / r2 / …>
score_scale: "<区间 + 各档语义，未知则 unknown>"
borderline: "<大致录取线，未知则 unknown（评估记 provisional）>"
deadline: <YYYY-MM-DD 或 unknown>
viability: <PROMISING / BORDERLINE_UNCERTAIN / LOW_EXPECTED_RETURN>
language: zh
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
stage:
  triage: in_progress      # pending / in_progress / done
  evidence: pending
  experiments: pending
  integrate: pending
  draft: pending
---

# Concern Matrix — <venue> <round>

评审逐字原文：`reviews_raw.md`（只增不改）。实验：`experiment_ledger.md`。

## 1. 分数

<!-- 每位评审一行：编号、总分、置信度、一句话立场。表下写分数分布解读与最强正/负信号
     （triage_spec_zh.md Part A）。 -->

| Reviewer | Score | Confidence | 一句话立场 |
|---|---|---|---|

## 2. Claim map

<!-- 取自摘要 / paper/ / overview.md：问题；主贡献；声称的 novelty；声称的实证结果；
     声称的范围；最可能决定录取的论断。标出比评审可见证据更宽的论断。 -->

## 3. 意见

<!-- 每条原子意见一行（triage_spec_zh.md Part B–C）。Status 从 OPEN 起，integrate 阶段
     按 evidence_spec_zh.md Part B 词表更新。 -->

| ID | Reviewer | 表面评论 | 底层疑虑 | Class | 回应模式 | 严重度 | 共享度 | 影响 | 解决置信 | Status |
|---|---|---|---|---|---|---|---|---|---|---|

## 4. 意见-证据映射

<!-- 逐条意见：磁盘上已有的锚定（evidence_spec_zh.md Part A）、缺失的证据、所选的桶：
     existing-evidence / clarification / run-now（→ ledger 行）/ defer。 -->

| 意见 | 已有证据（锚定） | 缺失证据 | 桶 |
|---|---|---|---|

## 5. 意图诊断卡

<!-- 仅限真正含混的评论（triage_spec_zh.md B.3）：评审原文（引用）、最可能疑虑、替代
     解释、置信度与不确定原因、能同时回答两种解释的证据、问过作者时的答复、安全回应
     策略。 -->

## 6. 决定

<!-- 带日期的一行记录：可行性门的答复、确认的 run-now 集合、被否决的建议与用户理由。
     用户在聊天里确认的内容必须落到这里——对话会结束，文件不会。 -->
