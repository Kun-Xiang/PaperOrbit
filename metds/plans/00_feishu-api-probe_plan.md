---
title: 飞书 API 探针执行计划
slug: feishu-api-probe
language: zh
prefix: "00"
parent: 0_research-workbench_plan.md
level: 2
traces_to: "§5 最大风险 / Kill criteria；§6 M0 飞书 API 探针"
depends_on: []
created: 2026-07-22
updated: 2026-07-22
exec_status: done
exec_runs:
  - 00_feishu-api-probe
status:
  objective: done
  deps: done
  steps: done
  deliverables: done
  verification: done
  risks: done
---

# 飞书 API 探针执行计划

## 1. 目标与范围

本子计划交付一个最小、可复现的飞书同步探针，用来确认本机 `lark-cli` 用户身份能把一份最小 Markdown 导入到 `PaperOrbit 我的知识库` 文件夹；同时记录 raw OpenAPI 应用身份路线的权限边界。它直接服务根计划的 M0 和 §5 风险缓解：在实现完整 CLI 前，先裁决主路线是否成立。

Non-goals：不实现完整 `feishu-sync` CLI，不处理批量同步、错误汇总或报告格式优化；不修改 PaperOrbit Web 端。

## 2. 输入与依赖

- 凭据：本机 `lark-cli` 已登录的 Kun Xiang 用户身份，以及项目根 `.env` 中的 `FEISHU_FOLDER_TOKEN`。raw OpenAPI 应用身份路线暂不配置；未来确实需要无本机登录态自动化时，再重新配置 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`。
- 样例输入：`tasks/00_feishu-api-probe/minimal.md`，内容覆盖标题、段落、列表、表格和代码块。
- 探针脚本：`tasks/00_feishu-api-probe/probe-feishu-import.mjs`；实际 M0 验收命令采用 `lark-cli drive +import --as user`。
- 上游子计划：无，本计划是整棵执行链的入口。

## 3. 任务分解

1. 创建 `tasks/00_feishu-api-probe/`，写入一份最小 Markdown 样例，包含标题、中文段落、列表、两列表格与 fenced code block。
2. 编写 `probe-feishu-import.mjs`：读取 `.env`，校验三个必填变量存在；缺失时打印配置指引并以非零状态退出，不发起网络请求。
3. 用 `lark-cli drive +import --as user --file tasks/00_feishu-api-probe/minimal.md --type docx --folder-token <FEISHU_FOLDER_TOKEN>` 执行最小 Markdown → 飞书云文档导入。
4. 记录 raw OpenAPI 应用身份路线的探针结果：scope 已开通后仍因应用身份缺少用户文件夹协作权限返回 `403 forbidden`，因此不作为本机 STAR 工作流的主路径。
5. 把探针运行方式和预期输出写进 `tasks/00_feishu-api-probe/README.md`，明确本机主路径为 `lark-cli --as user`，raw OpenAPI 路线仅作为未来无需本机登录态的生产自动化备选。

## 4. 产出物与输出

- `tasks/00_feishu-api-probe/probe-feishu-import.mjs`：最小 raw OpenAPI 备选探针脚本。
- `tasks/00_feishu-api-probe/minimal.md`：探针 Markdown 输入。
- `tasks/00_feishu-api-probe/README.md`：凭据、权限与运行说明。
- `wkdrs/00_feishu-api-probe/EXEC_LOG.md`：由 `$star-plan-executor 00` 执行时记录探针结果、飞书返回类别、产出 URL 与是否进入 Plan B。

## 5. 验证 / 完成判据

完成判据是一条可核验结论：`lark-cli drive +import --as user --file tasks/00_feishu-api-probe/minimal.md --type docx --folder-token <FEISHU_FOLDER_TOKEN> --name "PaperOrbit M0 Probe"` 成功输出一个可打开的飞书文档 URL；同时 `probe-feishu-import.mjs` 的无凭据场景必须非零退出且不发起网络请求。

## 6. 局部风险与备选

主要风险是飞书自建应用缺少云文档导入或云空间上传权限。早期信号是 token 可获取但导入接口返回权限类错误；局部备选是立即执行 Plan B 上传 Markdown 文件，保留可读交付而不阻塞 M1 的 CLI 框架。若 token 获取失败，本叶子暂停，交回用户修正飞书开放平台应用配置。

## Revision History

### 2026-07-22 — star-plan-executor (run: 00_feishu-api-probe, 收尾)
- MODIFIED §1/§2/§3/§5：M0 主验证路径由 raw OpenAPI 应用身份探针改为 `lark-cli drive +import --as user` —— 原因：用户指出本机 STAR 工作流可以直接通过已登录的飞书 CLI 写入自己的知识库；实测该路径成功导入文档，而 raw OpenAPI 应用身份路线仍受文件夹协作权限约束。
