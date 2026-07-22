---
code_name: .
language: zh
adopted: 2026-07-22
updated: 2026-07-22
backfilled: —
---

# Project Adoption Record — 项目接入记录

> STAR 被加进这个仓库时，它是什么样子，以及接入过程接通了什么。本文件只作描述：记录存在什么，不记录
> 它们是为了什么。研究策略在 `metds/plans/`，代码架构在 `metds/codearc.md`，结果判断在 `wkdrs/` 下的
> 各份分析里。

## 1. 接入时的仓库

首次提交 2026-07-13（"Build Paper Orbit research reading site"），接入时共 16 个提交，位于 `main`
（`d943522`）。语言与框架：TypeScript / React 19 / vinext（Next 风格的 Vite 工具链）/ Cloudflare
Workers 运行时，Node >= 22.13，npm 管理依赖；无 Python、无 Conda。README 的自述：“Paper Orbit is a
daily paper-reading site for everyone who signs in with ChatGPT. It recommends 10 papers aligned
with your research interests each day, supports arXiv search and full-PDF conversations with Paper
Copilot, generates reading reports, and tracks your paper library and reading progress.” 产品已上线
（OpenAI Sites，`.openai/hosting.json`），本地回环模式可用自有 OpenAI 兼容网关完成全文对话。

## 2. 映射

| 探测线 | 映射为 | 目标 | 置信度 | 备注 |
|---|---|---|---|---|
| 源码 | `CODE_NAME=.` | — | likely，门 1 确认（2026-07-22） | 勘察候选为 `app/`（核心 UI 与 API），用户确认整个仓库根为源码目录：`worker/`、`db/`、`tests/`、`scripts/`、`build/` 与 `app/` 不可分割 |
| 运行时 | `PYTHON_HOME=/usr/bin/python3` | — | likely，门 1 确认（2026-07-22） | 真实运行时是 Node >= 22.13 + npm；该值仅让 `execs/run.sh` 的解释器检查通过（Python 3.9.6）。机器上另有 `~/miniconda3`（base Python 3.13.5）；用户决定维持现值，待研究需要 Python 实验时由 `/star-env-builder` 建专用环境并切换为 `CONDA_HOME`+`ENV_NAME` 派生 |
| 数据 | `datas/` | 无既有目录 | 高 | 应用无本地数据集；骨架新建，留待研究使用 |
| 权重 | `inits/` | 无既有目录 | 高 | 应用无模型权重；骨架新建 |
| 输出 | `wkdrs/` | 无既有目录 | 高 | 无既往实验输出树；骨架新建 |

## 3. 接通了什么

| 动作 | 路径 | 结果 |
|---|---|---|
| 拷入 STAR 技能（17 个 × 3 agent 根） | `.agents/skills/`、`.claude/skills/`、`.cursor/` | 已创建 |
| 拷入工作流规约文档 | `docs/mds/star-workflow/` | 已创建 |
| 拷入框架启动器（未改动，供 `update.sh` 同步） | `execs/run.sh`、`execs/update.sh` | 已创建 |
| 生成包装脚本（原样调用既有 npm 命令） | `execs/scpts/dev_local.sh`、`execs/scpts/test.sh` | 已创建 |
| 骨架目录 | `datas/`、`inits/`、`wkdrs/`、`metds/{ideas,plans,refs}/`、`tasks/`、`paper/README.md` | 已创建 |
| 追加 STAR 变量区块 | `.env.example`（`CODE_NAME`/`ENV_NAME`/`CONDA_HOME`/`PYTHON_HOME`） | 已追加；既有键原样留下 |
| 追加忽略规则（`datas/*`、`inits/*`、`wkdrs/*` 等，`.gitkeep` 例外） | `.gitignore` | 已追加；既有规则原样留下 |
| 追加 STAR 工作区说明 | `AGENTS.md`、`README.md` | 已追加；既有内容原样留下 |
| `CLAUDE.md -> AGENTS.md` 软链（STAR 惯例） | `CLAUDE.md` | 已创建 |
| 框架许可副本（MIT，来自 wanghao9610/STAR） | `LICENCE-STAR` | 已创建 |
| 应用自身文件与启动器 | `package.json`、`scripts/dev-local.mjs`、全部 `app/**` | 原样留下，未搬动未改名 |
| 测试环境清理补一行 `delete process.env.OPENAI_BASE_URL` | `tests/rendered-html.test.mjs` | 冲突已修：`run.sh` 会导出 `.env`，而该测试的环境清理列表缺此键，任何环境携带该变量时 `npm test` 都会失败 |
| `survey` 重跑（2026-07-22）：`.env` 的 `CODE_NAME` 由 `app` 改为 `.` | `.env` | 门 1 确认后的唯一改写；`PYTHON_HOME` 维持原值；`bash execs/run.sh --list` 与 `test` 包装在新值下复验通过 |
| `survey` 重跑（2026-07-22）：`datas/`、`inits/`、`wkdrs/` 软链判定 | — | 无既有数据 / 权重 / 输出树可链（certain），骨架目录原样保留，未建任何软链 |

## 4. 工作清单

| id | what | state | evidence | run_dir | metric（逐字引用） |
|---|---|---|---|---|---|
| W1 | Orbit v3 Local 推荐管线（v2 基线权重 + 本地画像衰减 + 显式反馈 + 确定性多样性重排） | built | `app/api/arxiv/recommendation.ts`；`tests/paper-orbit-core.test.mjs` | — | — |
| W2 | 结构化 arXiv 检索（字段/匹配/分类/年份/分页，安全查询生成） | built | `app/api/arxiv/search-query.ts`、`app/api/arxiv/route.ts` | — | — |
| W3 | PDF 全文 Copilot（Responses `input_file`、JSON/SSE 传输、分层失败诊断、语言与防复制守卫） | built | `app/api/ai/route.ts`、`app/api/ai/copilot-transport.ts` | — | — |
| W4 | 加密个人会话（AES-GCM HttpOnly cookie、身份绑定、过期策略） | built | `app/api/encrypted-session.ts`、`app/api/ai/openai-session.ts` | — | — |
| W5 | 回环本地模式 + `.env` 共享凭据链路（`OPENAI_BASE_URL` 校验失败即禁用，防 key 泄漏回退） | built | `app/local-development.ts`、`vite.config.ts`、`scripts/dev-local.mjs`；commit `ce6282e` | — | — |
| W6 | Copilot 回答与报告的 Markdown 渲染（零依赖解析器，React 元素渲染，http/https 链接白名单） | built | `app/markdown.ts`、`tests/markdown.test.mjs` | — | — |
| W7 | 上游响应有界读取与超限取消（连接验证与全文传输共用） | built | `app/api/ai/bounded-response.ts` | — | — |
| W8 | 英文版产品体验 | built | commit `4054a60`（PR #4） | — | — |
| W9 | 测试面：构建后 `node --test` 全量回归 | run | 本仓库 `npm test` 于 2026-07-22 通过 STAR 启动器（`bash execs/run.sh test`）执行 | — | “tests 61 / pass 61 / fail 0” |

## 5. 已入账的 run

| Run | 软链自 | 日期 | 重建日志 | 备注 |
|---|---|---|---|---|

仅作证据留存：0 个既往 run——本仓库是 Web 应用，接入时没有实验性 run 产物树；测试执行见 §4 W9。

## 6. 未决问题

- 研究方向未定：推荐系统（`orbit-v3-local` 权重与衰减）、检索质量、Copilot 输出质量评测都是候选；由 `/star-plan-coach` 与用户确定，本记录不做预设。
- Python 实验环境：门 1（2026-07-22）已定路径——现值维持 `/usr/bin/python3`，待研究计划需要真实 Python 实验时由 `/star-env-builder` 建专用 Conda 环境（机器已有 `~/miniconda3`）并回填 §2。
- 文档一致性：`.env.example`、`AGENTS.md`、`README.md` 的 STAR 区块仍写着接入初稿的 `CODE_NAME=app`，与门 1 确认的 `CODE_NAME=.` 不一致。修正超出本 skill 的写入边界（其范围仅 `.env`、软链、`execs/`、本记录），由维护者或后续提交更正。
- 生产部署边界：`STAR` 分支面向研究工作区，OpenAI Sites 部署流程仍以 `main` 为准；两者的同步节奏由用户决定。

## 7. 回填记录

（尚无。由 `/star-proj-adopt backfill` 在计划树建立后追加。）
