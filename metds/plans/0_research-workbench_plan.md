---
title: PaperOrbit 统一科研工作台 工程计划
slug: research-workbench
language: zh
created: 2026-07-22
updated: 2026-07-22
finalized: 2026-07-22
status:
  problem: done
  related_work: done
  method: done
  experiments: done
  risks: done
  milestones: done
---

# PaperOrbit 统一科研工作台 工程计划

> 性质说明：这是一份工程计划而非学术研究计划。各节按工程语义使用：
> §2 = 现有能力盘点与差距（而非文献综述）；§4 = 验收标准与测试设计（而非实验设计）；
> §6 = 交付里程碑（而非投稿 venue）。

## 1. 问题定义与动机

**一句话目标**：把 PaperOrbit（Web 端的论文推荐、检索、阅读）与本仓库 STAR 分支已装载的科研工作流技能（agent 端的 review、survey、rebuttal、写作）用**单向数据桥**连成一个统一的、个人私有的科研工作台。

**为什么现在做**：两半各自已经存在——PaperOrbit 产品可用（推荐管线 `orbit-v3-local`、arXiv 结构化检索、全文 PDF Copilot 与阅读报告），STAR 的 17 个 `star-*` 技能已随接入落进 `.claude/skills/`。缺的只是数据互通：科研流程目前被两个孤岛割裂，网页里积累的阅读判断无法进入 survey / review / rebuttal / 写作流程。

**Gap**：书库、阅读报告、兴趣画像、显式反馈全部锁在浏览器 `localStorage`（按登录邮箱命名空间隔离），STAR 工作区（`metds/refs/`、`reference.bib` 等）读不到它们；四个重流程技能因此只能从零起步，浪费了阅读端已经沉淀的信号。

**范围内**：PaperOrbit → STAR 的单向导出——书库 / 报告 / 画像以 STAR 可读格式落盘（`metds/refs/` 分析笔记、`reference.bib` 条目等），并提供网页端导出入口；review / survey / rebuttal / 写作本身**不在网页实现**，由既有 `star-*` 技能承担。

**范围外**：STAR 产物回流网页展示（不做）；多用户协作；改变 `main` 分支的生产部署形态。

## 2. 相关工作与定位

**现有能力盘点**（证据：两侧仓库代码与技能文档）：

| 能力 | Web 端（PaperOrbit） | Agent 端（STAR 技能） | 差距 |
|---|---|---|---|
| 推荐 / 检索 / 阅读 | ✅ `orbit-v3-local`、arXiv 结构化检索、全文 Copilot + 阅读报告（可下载 `.md`） | — | 无 |
| review / rebuttal | 不做（范围外） | ✅ `star-paper-reviewer`、`star-rebuttal` | 无——零存储需求，对话中直接使用并返回结果 |
| survey | ❌ | ✅ `star-survey-writer`（产物落 `metds/survey/<slug>/`） | 产物只在 git 仓库，到不了飞书 |
| 阅读报告沉淀 | ⚠️ 仅浏览器 `localStorage` + 手动下载 | — | 到不了飞书 |
| 知识归宿（飞书文档） | ❌ | ❌ | **两侧都缺——核心差距** |

**定位**：现有两侧各自完整，但产物都止步于"本地"——网页报告止于浏览器下载，survey 止于 git 仓库的 Markdown；没有任何一环能把成果送进用户真正的知识库（飞书文档）。本计划的桥 = **阅读报告与 survey 产物 → 飞书文档的 API 全自动同步**（飞书开放平台自建应用，`app_id`/`app_secret` 入 `.env`，docx API 创建/更新云文档）。书库/画像向 survey 流程供料作为**可选增强**，在 §3 方法中再定取舍。

## 3. 核心方法

**总体路线**：一个纯增量的 Node CLI 同步器（拟位于 `scripts/`，与 `dev-local.mjs` 并列），**零 Web 端改动**、零现有代码触碰。

**工作流**：`node scripts/feishu-sync.mjs <file.md ...>` → 读 `.env` 凭据（`FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_FOLDER_TOKEN`）→ 获取 `tenant_access_token` → 调用飞书开放平台**导入任务 API**（Markdown → 云文档转换）→ 轮询任务完成 → 输出飞书文档 URL。阅读报告走"网页下载 md（`downloadReport` 已存在）→ CLI 同步"两步；survey 产物（`metds/survey/<slug>/survey.md`）直接以文件路径同步。

**关键设计决策**：

1. 只做 CLI（Web 零改动，用户裁定）。
2. review / rebuttal 零工程——`star-paper-reviewer` / `star-rebuttal` 对话直接返回结果。
3. 书库供料 survey 本期不做，记入 §6 后续项。
4. 飞书接入优先 import task API（官方 md 转换，保真度由飞书负责），逐块构造 docx blocks 仅作备选。
5. 凭据边界——CLI 为 Node 进程直读 `.env`（不经 workerd，无需改 vite 注入白名单），凭据永不入库。

**为什么该有效**：飞书官方支持 Markdown 导入转换；两类产物都天然是 md 文件；CLI 是独立新增文件，对现有 61 项测试面零影响，失败可整体回退。

## 4. 实验与验证设计

**验收标准（能力 → 验收对应表）**：

| # | 交付面 | 验收标准 |
|---|---|---|
| A1 | 单文件同步 | `node scripts/feishu-sync.mjs report.md` 输出飞书文档 URL；打开后标题层级、列表、表格、代码块正确呈现 |
| A2 | 批量同步 | 多文件一次同步、逐个输出 URL；单个失败不中断其余，末尾汇总成败 |
| A3 | 凭据缺失行为 | 无凭据时明确报错 + 配置指引，且不发起任何网络请求 |
| A4 | 中文与公式保真 | 含中文 + 公式 + 表格的真实阅读报告同步后内容完整（公式以文本/代码形态保留——飞书不渲染 LaTeX，如实接受） |
| A5 | 零回归 | `npm test` 61 项全绿 + lint 干净（CLI 为纯新增文件） |
| A6 | 端到端 | 真实链路各跑一次：网页报告 → 下载 → 同步 → 飞书可读；survey 产物 → 同步 → 飞书可读 |

**测试策略**：CLI 的参数解析与凭据校验用 `node --test` 加 mock fetch 覆盖（不打真实 API）；真实飞书冒烟（A1 / A4 / A6）需要用户先在飞书开放平台创建自建应用并把凭据填入 `.env`——这是唯一的外部前置。

**预算**：无算力需求；飞书 API 调用在免费额度内；无数据集。

## 5. 风险与备选方案

**最大风险**：飞书导入任务 API 的权限门槛与转换保真度。自建应用需开通云文档权限；导入任务 API 对个人应用可能有企业认证要求，md 转换对表格 / 代码块的支持也可能不及预期。**缓解**：实现前先做一次 5 分钟的最小 API 探针（拿到凭据后先调一次最小导入验证权限与效果，再全量实现）。

**Kill criteria**：若飞书对个人自建应用不开放文档创建 / 导入权限（需企业认证且无法完成）→ "API 全自动"路线被否定，启用 Plan B。

**Plan B**（按降级顺序）：

1. 改调"上传 md 为云空间文件"（不转富文本文档，飞书内仍可预览）。
2. 再降级回"半自动"——CLI 只产出规范化 md，人工拖入飞书导入。

**次要风险**：`app_secret` 泄漏——`.env` gitignore 边界已有，CLI 报错信息不得回显凭据；飞书限流对个人量级可忽略。

## 6. 里程碑与产出

**最小验证切片 M0**：飞书 API 探针。用户在飞书开放平台创建自建应用（开通云文档权限）、把 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_FOLDER_TOKEN` 填入 `.env` 后，用约 20 行的探针脚本验证 token 获取 + 最小 md 导入能通——既是 §5 缓解措施的落地，也是全计划第一个可验证交付，直接裁决走主路线还是 Plan B。

**交付顺序**：

- **M0** 飞书自建应用创建（用户操作）+ API 探针通过——唯一外部依赖。
- **M1** `feishu-sync` CLI 完整实现，A1–A3、A5 达标。
- **M2** 真实端到端：一份真实阅读报告 + 一份 survey 产物同步进飞书，A4、A6 达标。

**后续可选**（明确记录、本期不做）：书库供料 survey；STAR 产物回流网页展示。

**资源需求**：仅飞书自建应用一项外部操作；无算力、无数据集；无投稿 venue（工程计划，时间线以里程碑序列代替日历）。
