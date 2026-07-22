# STAR 上手教程：这个仓库怎么用

**语言：** 简体中文（英文版待补）

这份教程教你从零把 STAR 用起来：它是什么、怎么装、日常怎么跑、以及六个典型场景的完整走法。更完整的技能手册见[研究工作流指南](research-workflow-skills.zh-CN.md)，技能共守的规则见[通用规约](research-workflow-conventions.zh-CN.md)——本文只负责让你会用。

## 1. 先建立心智模型（一分钟）

STAR 不是一个框架，而是**一套目录约定 + 一个实验入口 + 十七个 AI 技能**。它的四个支柱：

1. **目录即归宿**：代码在 `${CODE_NAME}/`、数据在 `datas/`、权重在 `inits/`、运行产物在 `wkdrs/`、计划与方法文档在 `metds/`、论文在 `paper/`。每类文件只有一个家。
2. **`.env` 即运行时**：机器相关的路径（conda、python）只写在本地 `.env`（git 忽略），脚本与技能永不硬编码路径。
3. **文件即记忆**：所有决策、进度、验证证据都落在项目文件里——聊天关掉了，工作还在。任何新会话都能从文件恢复现场。
4. **技能即流程**：在 Claude Code / Cursor 里输入 `/star-xxx`（Codex 里是 `$star-xxx`）调用技能。技能之间靠产物交接，各有严格的写入边界，重活（训练、全量评测）永远把命令交还给你来跑（STOP 线）。

十七个技能一句话地图：

| 阶段 | 技能 | 干什么 |
|---|---|---|
| 起点（二选一） | `/star-proj-adopt` | 无损接入已开工的项目 |
| | `/star-idea-storm` | 模糊兴趣 → 站得住的选题 |
| 规划 | `/star-plan-coach` | 选题 → 六节研究计划（问答式） |
| | `/star-refs-reviewer` | 精读近邻论文 + 可核验 `reference.bib` |
| | `/star-plan-decomposer` | 计划 → 可执行叶子（带依赖 DAG） |
| 基建（首轮一次） | `/star-code-architect` | 从参考实现奠基代码库 + 架构规范 |
| | `/star-env-builder` | 建 conda/venv 环境 + 冒烟验证 |
| 执行循环（每叶子） | `/star-plan-executor` | 实现叶子 + 轻验证 + 执行日志 |
| | `/star-code-reviewer` | 对照规范与计划审代码 |
| | `/star-expt-analyst` | 对照预期审结果（watch/aggregate 模式） |
| | `/star-plan-reviser` | 用执行证据修订计划 |
| 全局 | `/star-flow-status` | 只读总览 + 唯一的下一步建议 |
| 论文线 | `/star-metd-summarize` | 计划树 → 五份方法文档 |
| | `/star-paper-writer` | 方法文档+结果台账 → 论文草稿（claim 台账门） |
| | `/star-paper-reviewer` | 三人格审稿 + 论文数字对照仓库对账 |
| | `/star-rebuttal` | 评审分诊 → rebuttal 实验 → 回应信 |
| 侧线 | `/star-survey-writer` | 把一个领域漏斗成独立综述 |

## 2. 三种上手方式

### 方式 A：新项目从模板起步

```bash
git clone https://github.com/wanghao9610/STAR
cd STAR && rm -rf .git && cd ..
mv STAR my-research && cd my-research
mv code my_pkg          # 改成你想要的代码包名
git init && git add . && git commit -m "First commit."
```

### 方式 B：接入已经开工的项目（不动任何已有文件）

在**那个项目**的仓库根目录执行：

```bash
curl -fsSL https://raw.githubusercontent.com/wanghao9610/STAR/main/execs/update.sh -o /tmp/star-update.sh
bash /tmp/star-update.sh --adopt
```

`--adopt` 只增不改：已存在的文件一律保留并列出。然后在项目里运行 `/star-proj-adopt`——它勘察布局、写 `.env`、用软链接触达你已有的数据/权重/输出目录（不搬家）、包装你已有的启动命令，并把"已经建成、已经跑过"的东西记成台账。

### 方式 C：老项目只想同步最新技能

```bash
bash execs/update.sh                      # 全量更新技能与工作流文档
bash execs/update.sh --skill star-rebuttal  # 只更新某个技能（三根目录一起）
```

## 3. 第一次配置（两分钟）

```bash
cp .env.example .env
```

编辑 `.env` 四个值：`CODE_NAME`（代码目录名）、`CONDA_HOME` + `ENV_NAME`（或直接给 `PYTHON_HOME`，它优先）。然后验证：

```bash
bash execs/run.sh --list
```

能列出 `execs/scpts/` 下的实验脚本就通了。之后所有技能跑命令都走这个环境，绝不用系统 python。

## 4. 日常节奏

**每次会话从这句开始：**

```text
/star-flow-status
```

它只读地渲染计划树、进度、欠账（哪个跑完的 run 还没审、哪份文档过期了），并给出**唯一的**下一步建议。照做即可。

**执行循环的形状**（对每个叶子计划）：

```text
/star-plan-executor 00     → 实现 + 轻验证；重命令写进日志交还给你
（你自己跑训练命令；期间可 /star-expt-analyst watch 00 盯日志健康）
/star-plan-executor 00     → 再次调用，从日志续做，验证完成判据
/star-expt-analyst 00      → 结果对照预期打分
```

探索性叶子到此为止（**轻路径**）；要进论文的叶子再加两步（**全路径**）：执行后先 `/star-code-reviewer 00` 审代码，分析后 `/star-plan-reviser 00` 把结果教给计划。判断标准：这个叶子的结果如果错了，代价是"损失一下午"还是"论文里一个错数字"？

**三条你可以信任产物的纪律**（所有技能共守）：

- **零捏造**：每条 bib 字段来自本次抓取的记录、每个日期来自系统时钟、每个论文数字锚定 `results.md` 的行——没有的东西以 `[RESULT NEEDED]` 类占位符可见地存在，绝不编。
- **STOP 线**：训练、全量评测、收费 API 调用，技能只准备命令、绝不代跑。什么时候烧算力永远是你的决定。
- **门控**：删环境、覆盖文件、提交 git、批准安装计划……都会先问你，一次一问。嫌烦时想想它们防的是什么。

## 5. 典型场景

### 场景 1：从零开始一个新研究项目（完整闭环）

```text
/star-idea-storm 开放词汇感知，但还没定具体问题
   → 发散 3–5 个方向 → 摘要级扫描 → 六维打分 → 定稿 metds/ideas/open-vocab-perception_idea.md

/star-plan-coach open-vocab-perception       # 用定稿的 idea 播种计划
   → 写 §1 问题后，先跳出去读文献：
/star-refs-reviewer open-vocab-det-seg
   → 产出逐篇笔记 + 可核验 reference.bib
/star-plan-coach open-vocab-det-seg related_work   # 回来用读过的东西写定位
   → 六节写完，计划 finalized

/star-code-architect        # 从 GitHub 参考实现奠基代码库（你在门上选库）
/star-env-builder           # 建环境（你在门上批安装计划）
/star-plan-decomposer 0     # 拆成 00/01/02/… 叶子

然后进入第 4 节的执行循环，每轮由 /star-flow-status 报下一个叶子。
```

关键点：**先架代码库和环境、再拆解**——叶子就能写真实的模块路径而不是猜。

### 场景 2：接入一个做了半年的项目

```bash
cd ~/work/my-old-project
bash /tmp/star-update.sh --adopt      # 装骨架，零覆盖
```

```text
/star-proj-adopt              # survey 阶段：勘察 → 你确认映射 → 落 .env/软链/包装脚本
                              #   → 建"已完成工作台账"（每行带证据：路径/commit/日志行）
/star-plan-coach              # 读台账作种子，把"为什么做"补写成计划（工具不猜战略）
/star-plan-decomposer 0
/star-proj-adopt backfill     # 逐叶子确认：把早已完成的工作标回 exec_status: done
/star-flow-status             # 第一次看到诚实的全景：既不是 0% 也不虚报
```

关键点：一切**不搬家、不改名、不覆盖**；历史 run 的重建日志会明确标注"reconstructed"，绝不冒充真执行记录。

### 场景 3：投稿季——从写稿到 rebuttal

```text
（前提：叶子们跑完，计划已吸收执行结果）
/star-metd-summarize              # 计划树 → overview/framework/dataset/training/evaluation 五份方法文档
/star-expt-analyst aggregate      # 所有 run 的数字复核后进 metds/results.md 台账
/star-refs-reviewer synthesize    # 笔记 → related_work.md 叙述

/star-paper-writer                # context → outline → 按强制顺序起草（intro 写两遍）
                                  #   每个数字锚定 results.md、每条引用查 bib、风格门实跑
/star-paper-reviewer              # 投稿前：三人格评审 + 论文数字对照仓库逐条对账
/star-paper-writer precheck       # 页数/断引/字体/匿名化机械检查
→ 投稿。

（评审回来了）
/star-rebuttal                    # 粘贴评审 → 可行性判定 → 意见原子化诊断
                                  #   → P0–P3 实验计划，确认后路由：
/star-plan-decomposer 0           # rebuttal 实验立为普通叶子
/star-plan-executor 1x            # 执行；训练命令照旧交还你跑
/star-expt-analyst 1x             # 打分出报告
/star-rebuttal integrate          # 结果对回意见
/star-rebuttal draft              # Direct Answer → Evidence → Revision，每句证据带锚定
→ 修订清单以后经 /star-paper-writer revise 逐条施加回稿件。
```

关键点：rebuttal 实验**不走捷径**——和平时一样立叶子、走执行循环，所以证据自动落盘、可审计。

### 场景 4：写一篇领域综述（独立侧线，随时可走）

```text
/star-survey-writer open-vocabulary segmentation
   → 方案（关键词/筛选标准/规模，你确认）
   → 广度扫描 100+ 篇元数据（只抓标题摘要并缓存，不下 PDF）
   → 筛精读池 15–25 篇（近年综述、开山作、顶会前沿是强制项，你确认）
   → 逐篇路由 /star-refs-reviewer 写笔记
   → 大纲（从领域里已有综述的结构学来，你确认）
   → 分节起草（只许引 bib 里的、只从笔记取材、深度不超笔记）
   → refine 一轮 → metds/survey/<slug>/survey.md
之后文献库长大了：/star-survey-writer refine 刷新。
```

### 场景 5：中断后回来 / 换了台机器 / 新开会话

什么都不用记，一切从文件恢复：

```text
/star-flow-status        # 现场在哪、欠什么、下一步是什么
```

- 执行到一半的叶子：`/star-plan-executor <叶子>` 从 `EXEC_LOG.md` 跳过已完成步骤续做；
- 写到一半的计划/想法/综述/论文：对应技能读 frontmatter 的 status/stage 映射续做；
- 换机器：`cp .env.example .env` 填本机路径，`/star-env-builder` 用 *verify & repair* 修环境。

### 场景 6：长训练跑着的时候

```text
（你按 EXEC_LOG 里 "Awaiting user" 的命令启动了训练）
/star-expt-analyst watch 00      # 只读健康检查：活着吗、最新 step、有无 NaN/OOM
                                 # 可以反复跑/挂定时；不打分、不写文件
（训练完）
/star-plan-executor 00           # 验证完成判据、收尾
/star-expt-analyst 00            # 正式打分出报告
```

可以无人值守挂定时的还有：`/star-flow-status`、`/star-paper-reviewer`（只读）、`/star-metd-summarize` 重编译（来源没动就什么都不写）。带门的技能（coach/decomposer/executor 等）不要脚本化替它们答"是"——门就是设计。

## 6. 常见问题速查

- **executor 不肯执行我的计划？** 目标不是叶子（有 children）、`depends_on` 未完成、§3/§5 还有大量 `[TBD]`、或 `.env` 环境坏了。先跑 `/star-flow-status` 看具体原因。
- **为什么训练命令只写日志不执行？** STOP 线。技能把命令做成可复现的，什么时候花算力由你定。跑完再次调用同一技能即可续上。
- **想手改计划文件行不行？** 行，但保持 frontmatter 与正文一致（`parent`/`children`/`depends_on`/`exec_status`），改完跑 `/star-flow-status` 查 drift。
- **产物都登记在哪？** 通用规约 §8 的制品注册表——`flow-status` 靠它做覆盖检查；哪个技能敢改自己的输出路径而不更新注册表，状态页就会用"未识别报告文件"的自审计行揪出来。
- **语言怎么处理？** 对话用中文即可；技能会读 `SKILL_zh.md`。文档正文语言跟随其 frontmatter `language`（中文对话讨论英文计划，写进去的仍是英文）；稿件语言随 venue。

## 7. 下一步读什么

- 每个技能的完整说明与示例：[研究工作流指南](research-workflow-skills.zh-CN.md)
- 技能会/不会对你仓库做什么的完整契约：[通用规约](research-workflow-conventions.zh-CN.md)
- 单个技能的权威定义：`.claude/skills/<技能名>/SKILL.md`（中文 `SKILL_zh.md`）
