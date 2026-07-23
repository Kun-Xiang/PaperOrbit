---
title: feishu-sync CLI 执行计划
slug: feishu-sync-cli
language: zh
prefix: "01"
parent: 0_research-workbench_plan.md
level: 2
traces_to: "§3 核心方法；§4 A1-A3/A5；§6 M1 CLI 实现"
depends_on: ["00"]
created: 2026-07-22
updated: 2026-07-22
exec_status: done
exec_runs:
  - 01_feishu-sync-cli
  - 01_feishu-sync-cli-hardening
status:
  objective: done
  deps: done
  steps: done
  deliverables: done
  verification: done
  risks: done
---

# feishu-sync CLI 执行计划

## 1. 目标与范围

本子计划在 `scripts/` 中实现完整的 `feishu-sync` Node CLI，把一个或多个 Markdown 文件同步到飞书，并覆盖根计划 A1-A3 与 A5：单文件同步、批量同步、凭据缺失行为、零回归。它消费 M0 的路线裁决：本机 STAR 工作流优先封装已登录的 `lark-cli drive +import --as user`，将 Markdown 导入为飞书 `docx` 文档。

Non-goals：不实现 Web 端导出按钮，不把 STAR 产物回流 PaperOrbit 页面，不处理书库画像向 survey 供料。

## 2. 输入与依赖

- 上游子计划 `00`：交付飞书同步探针结果；主路线为本机 `lark-cli drive +import --as user`，目标文件夹为 `.env` 中的 `FEISHU_FOLDER_TOKEN`。
- 输入文件：任意本地 `.md` 文件，包括 PaperOrbit 下载的 reading report 与 `metds/survey/<slug>/survey.md`。
- 代码入口：`scripts/feishu-sync.mjs`，保持与现有 `scripts/dev-local.mjs` 同级。
- 测试入口：`tests/feishu-sync.test.mjs`，使用 `node --test` 与 fake `lark-cli` 子进程，不调用真实飞书 API。

## 3. 任务分解

1. 编写 CLI 参数解析：支持 `node scripts/feishu-sync.mjs <file.md ...>`、`--help`、`--folder-token <token>`、`--dry-run` 和清晰的退出码。
2. 实现 `.env` 加载与凭据校验：缺失 `FEISHU_FOLDER_TOKEN` 时输出配置指引，禁止调用 `lark-cli`。
3. 实现 `lark-cli` 子进程封装：逐文件调用 `lark-cli drive +import --as user --type docx --folder-token <token>`，捕获 JSON 输出、进度文本和错误分类。
4. 按 M0 结果实现同步客户端：主路径为 Markdown → 飞书 docx 导入；raw OpenAPI 应用身份路线仅保留为未来生产自动化备选，不进入本机 CLI 默认路径。
5. 实现批量同步：逐个文件处理，单个失败不中断其余文件；末尾输出成功 / 失败汇总与每个文件的 URL 或错误类别。
6. 增加测试：mock 无 folder token、dry-run 参数、单文件成功、批量部分失败、`lark-cli` JSON 解析和“无配置不调用子进程”。
7. 将 `npm test` 纳入本叶子验证，确保新增 CLI 不破坏现有 PaperOrbit 61 项测试。

## 4. 产出物与输出

- `scripts/feishu-sync.mjs`：正式 CLI。
- `tests/feishu-sync.test.mjs`：mock 单元测试。
- `tasks/01_feishu-sync-cli/fixtures/`：测试用 Markdown fixtures，若需要保留。
- `wkdrs/01_feishu-sync-cli/EXEC_LOG.md`：由 `$star-plan-executor 01` 记录实现步骤、mock 测试输出与 `npm test` 结果。

## 5. 验证 / 完成判据

完成判据是本地自动化全绿：`node --test tests/feishu-sync.test.mjs` 覆盖 A1-A3 的 fake `lark-cli` 场景并通过，随后 `npm test` 通过。无凭据测试必须证明 CLI 在配置缺失时不调用 `lark-cli`；批量测试必须证明一个文件失败不会阻断其他文件同步。

## 6. 局部风险与备选

主要风险是 `lark-cli drive +import` 的进度文本与最终 JSON 混合输出导致解析不稳。早期信号是 fake `lark-cli` 测试通过但真实命令输出无法解析；局部备选是把“从混合 stdout/stderr 提取最后一个 JSON envelope”的解析器收紧并增加回归样例。若 `npm test` 因 STAR 分支环境变量污染失败，应先按现有测试清理模式修正测试环境，而不是扩大本叶子范围。

## Revision History

### 2026-07-22 — star-plan-executor (run: 01_feishu-sync-cli, 审批门)
- MODIFIED §1/§2/§3/§5：M1 主实现从自写 OpenAPI/App Secret 客户端改为封装 `lark-cli drive +import --as user` —— 原因：M0 已实测用户身份 CLI 可直接写入 `PaperOrbit 我的知识库`，且不需要 App Secret 或 bot 文件夹授权。

### 2026-07-22 — star-plan-executor (run: 01_feishu-sync-cli-hardening)
- MODIFIED §3/§5：按 code review 收窄 `lark-cli` 子进程环境，避免把 `.env` 中的无关值整体传入子进程；为导出的 CLI helper 增加 JSDoc，并补充 dotenv-only 环境泄漏回归测试。`node --check scripts/feishu-sync.mjs`、`node --test tests/feishu-sync.test.mjs` 与 `npm test` 均通过。
