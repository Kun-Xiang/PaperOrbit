# Venue 适配与投稿前检查（中文版）

Venue 改变语域与家具，绝不改变台账。以下画像是默认值；`project_context.md` 记录所选
画像与任何偏离。与英文版 `venue_adaptation.md` 冲突时以英文版为准。

## Part A：Venue 画像

**ML 系（NeurIPS / ICLR / ICML / ACL / AAAI / COLM）**：related work 整合前置；冒号式
副标题；按要求附 reproducibility checklist 与 impact statement；贡献表述为带数字的方法
学主张；附录放逐 seed 表与补充消融；引用按模板 natbib/作者-年份。

**系统系（NSDI / SIGCOMM / CoNEXT / IMC）**：`\smartparagraph{}` 式加粗段首；evaluation
讲 latency / throughput / memory；贡献表述为运维影响；related work 放 evaluation 之后；
design 章节尽早给架构图。

**Workshop / 短文（HotNets 类）**：整体压缩约 50%；以智识挑衅开场；一张图扛起论证；
future work 是特性，不是坦白。

中文 venue 或学位论文变体沿用同样画像、切换语言；技术术语、指标名、citekey 保持英文。

## Part B：投稿前机械检查单（`precheck` —— 实跑，不背诵）

工具链存在则自动化；每项检查报告其命令输出。缺 LaTeX → 跑纯源检查，PDF 检查标
`skipped (no toolchain)` 并建议用户自己的构建流程；绝不安装任何东西（约定 §3.5）。

```bash
pdfinfo paper/main.pdf | grep Pages                    # 1 页数 vs venue 限额
grep -n "LaTeX Warning.*undefined" paper/main.log      # 2 未解析引用
pdffonts paper/main.pdf | awk '$5=="no"'               # 3 未内嵌字体
grep -rn '\\includegraphics' paper/sections/ paper/main.tex   # 4 图清单…
file paper/figures/*                                    #   …位图 vs 矢量检查
grep -rniE 'acknowledg|\\thanks|grant no' paper/        # 5 匿名化（双盲）
grep -rn 'balance' paper/main.tex                       # 6 栏平衡宏包
grep -rn '[a-zA-Z]\\cite' paper/sections/*.tex          # 7 悬空 \cite（缺 ~）
grep -rn '\\label{' paper/sections/*.tex | sort | uniq -d   # 8 重复 label
```

以表格报告——检查 / 状态 / 细节——机械可修的修掉（补 `~`、加 `\usepackage{balance}`），
编辑性的路由出去（值得重渲的位图 → 该 run `analysis/` 的绘图脚本）。双盲时另 grep
`project_context.md` 里记录的作者与机构字符串。

## Part C：图

数据图来自各 run（`wkdrs/<run>/analysis/`，旁有绘图脚本）——拷入 `paper/figures/` 并注
出处；重新生成归 `$star-expt-analyst`，改样式归图旁的绘图脚本。概念/架构图在大纲里写
spec（图须展示什么、属何原型），交给用户选择的绘图工具——本 skill 写 spec 与 caption，
`[FIGURE NEEDED — <spec>]` 占位直到资产存在。
