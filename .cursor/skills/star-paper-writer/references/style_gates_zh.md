# 风格门 — 机械、语义、红队、压缩（中文版）

改编自 SNL-UCSB/paper-writing-skill（MIT）。Part A 跑在**每次 tex 编辑**上并贴出 grep
计数；Part B–C 关闭章节；Part D 驱动压缩。这些是**默认值**——`project_context.md` 可按
论文覆盖个别规则（记录覆盖；门随即跳过该规则并声明）。与英文版 `style_gates.md` 冲突时
以英文版为准。稿件语言通常为英文，规则针对英文行文；grep 命令原样使用。

## Part A：机械门（grep 背书——实跑并贴计数）

对改动过的文件运行（路径按需调整）：

```bash
T=paper/sections/*.tex
grep -nE -- "---|—" $T                                   # M1 em-dash（行文中禁用）
grep -nE "\b(very|extremely|significantly|substantially|highly|remarkably)\b" $T   # M2 强化词
grep -nE "\b(novel|state-of-the-art|comprehensive|robust|promising|impressive)\b" $T  # M3 填充形容词
grep -niE "\b(in order to|it should be noted|note that|to address this|we address this problem by)\b" $T  # M4 清嗓
grep -niE "\b(moreover|notably|furthermore|additionally),"$T                        # M5 清嗓开头词
grep -niE "\b(can potentially|may help|it is possible that|can be expected to)\b" $T  # M6 含糊其辞
grep -nE "\b(is|are|was|were|been|being) [a-z]+ed\b" $T                             # M7 被动语态（人工复核命中）
grep -niE "\bIn this (paper|section|work), we (describe|present|discuss)\b" $T      # M8 无信息开头
awk 'length > 320' $T                                                               # M9 疑似超 40 词长句（启发式）
grep -nE "!\B" $T                                                                   # M10 感叹号
grep -cE "\\\\cite" $T; grep -nE "[a-zA-Z]\\\\cite" $T                              # M11 \cite 前缺 ~
grep -nE "et al\.[^~]" $T                                                           # M12 et al. 后缺 ~
```

交战规则：每个命中要么修掉、要么一行说明正当性（确有主语不明的合法被动、引文标题里的
em-dash）；按规则号报计数——`M1: 0, M2: 3 fixed, M7: 2 hits (1 fixed, 1 justified)`。
**没跑 grep 绝不报告"门已通过"。** M9 是启发式——命中行要读过确认。

grep 背后的声音默认值：句均约 21 词、上限约 40（仅贡献列表）；topic sentence 断言主张、
绝不铺背景；零 hedging（"We show" 而非 "We believe"）；全文主动语态；标题是主张不是话题
（"Edge conditioning reduces error 13×" 而非 "Experimental Results"）；段落 4–6 句，每段
只做 claim / evidence / takeaway 之一；named over vague——每个机制、baseline、指标都有
专名。

## Part B：语义门（读者判断——逐行过检查单）

- **S1 先定义后使用**：每个符号、缩写、命名概念在首现处定义；关键抽象先引入后依赖。
- **S2 可跟随性**：懂 venue 不懂本项目的读者能从上一段跟到下一段；没有强迫回读的前向
  引用。
- **S3 主旨绑定**：每段可追溯地服务身份句；不服务任何 claim 的段落删除或移走。
- **S4 词汇一致**：全文一概念一名（grep 同义词）；记号稳定（无 f 与 F 漂移）。
- **S5 不重复**：没有因为两个章节都想要而讲两遍的事实；讲一次，之后引用。
- **S6 图表解读**：每个图/表有行文解读（"Figure 3 shows X, confirming Y"），绝不只
  cite；caption 是一个加粗 takeaway 至多加一个从句。
- **S7 诚实定位**：related-work 特征化不超笔记深度；不立稻草人；评审终归会发现的局限
  自己先写。
- **S8 论断-范围匹配**：措辞尺寸对齐证据——`results.md` 说 single-seed 或单 benchmark
  的地方写 "in the evaluated settings"。
- **S9 收束**：章节开头说结论；每个 evaluation 簇以 Takeaway 收尾；conclusion 不承诺
  新东西。

## Part C：红队（章节关闭前的新眼睛）

作者 pass 修完 Part A–B 后，以**没写过这段文字**的评审身份重审：从零重跑 Part A 的
grep、以新读者视角走 Part B，返回 findings 清单（CRITICAL / MAJOR / MINOR），不是
yes/no。在本家族中，规模需要时红队以只读收集 pass 运行（约定 §6）——每章节一个
collector、主循环裁决——小稿件则刻意重读。迭代到最终 pass 零 CRITICAL/MAJOR；绝不带着
"已知悉"的 critical 关闭章节。

## Part D：压缩（七操作，按序）

1. **缩句** —— 删从句、限定词、清嗓。
2. **并段** —— 同一论点的多个例子 → 最好的那一个。
3. **删泛化形容词** —— 每个变成具体数字或消失。
4. **删教程** —— 砍掉 venue 读者已知的。
5. **Claim 前置改写** —— 把埋起来的段落改成主张先行。
6. **补 Takeaway** —— 每个实验簇后加合成段（以清晰换篇幅：省去回读）。
7. **图表升格** —— 密集数字行文变表格；行文只留解读。

逐章节报压缩前后字符数；目标从初稿降 30–50%；超过 50% 说明是框架问题而非啰嗦问题——
明说并路由回 context。绝不为页限凑字：短而完整胜过注水到线。
