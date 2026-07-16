# Paper Orbit

Paper Orbit 是一个面向所有 ChatGPT 登录用户的每日论文阅读站：每天推荐 10 篇与你研究兴趣相关的论文，支持 arXiv 搜索、基于 PDF 全文的 Paper Copilot 对话、自动阅读报告、论文书库与阅读进度。

## 身份、角色与费用隔离

- 任何完成 Sign in with ChatGPT 的用户都可以进入 Paper Orbit；匿名页面和 API 请求仍会被拒绝。
- 现有两个账号继续显示为 `OWNER` 与 `MANAGER`，其他登录账号显示为 `READER`。
- 每位 `READER` 必须连接自己的 OpenAI Platform API Key 才能使用真实 PDF 全文 Copilot；没有个人 Key 时只提供零模型 token 的安全摘要预览。
- 即使服务器配置了共享 `OPENAI_API_KEY`，它也只会提供给 OWNER/MANAGER，普通用户无法消耗站点管理员的模型额度。
- arXiv 元数据查询使用公开 API，不需要、也没有供此检索流程使用的个人“arXiv API Key”。用户可选连接自己的 Semantic Scholar API Key，以获得更稳定的引用和 influential citation 信号。
- 个人 OpenAI 与 Semantic Scholar Key 分别保存在绑定当前 ChatGPT 邮箱的 AES-GCM 加密 `HttpOnly` 会话 Cookie 中；不进入浏览器 `localStorage`、数据库或 Git，12 小时后失效。
- 书库、阅读状态、兴趣画像、反馈、候选缓存和报告仍只保存在设备浏览器中，但存储键会按当前 ChatGPT 登录邮箱分区；同一浏览器切换账号时不会共用个人数据。升级前的无账号命名空间数据只允许第一个登录的既有 OWNER/MANAGER 账号认领一次，旧键保留用于回退。

## 推荐系统（Orbit v3 Local）

推荐现在明确分为公开候选生成和浏览器本地个性化两层：

1. `/api/arxiv?mode=feed` 使用覆盖全部受支持研究方向的固定 OR 查询，一次从 arXiv 取得最多 60 篇公开候选；请求不读取兴趣、画像、书库、阅读状态、报告或反馈。
2. 服务端继续批量读取 Semantic Scholar 的引用与 influential citation 数据；普通用户可以使用公开无 Key 额度，也可以连接自己的 Semantic Scholar API Key。服务不可用时自动退回 arXiv 原生信号。接口返回候选池和公开信号，而不是某个用户最终的 10 篇。
3. 浏览器在完整候选池上综合兴趣相关度、带时间衰减的本地偏好、显式反馈、时效、影响力与实验/开源证据，再做确定性的主题多样性重排。
4. 最终列表会按 arXiv ID 去重，并用内置种子论文补足，始终以 10 篇为目标；算法不使用 `Math.random()`，相同输入和时间会得到相同输出。
5. 每张 Today 卡片的“为什么推荐”展示 0–100 的相关度、本地偏好、新鲜度、影响力和证据强度，以及引用数、高影响引用数与是否为探索项。这些数值由规则计算，不调用 LLM。

`app/api/arxiv/recommendation.ts` 保留 Orbit v2 的命名基线权重：相关度 42%、阅读偏好 12%、时效 16%、影响力 17%、证据信号 13%；Orbit v3 Local 在此基础上加入本地衰减画像、显式反馈和确定性多样性选择。

## 高级 arXiv 检索

搜索接口支持以下结构化参数，不接受客户端直接拼接的原始 arXiv 查询语法：

- `q`：搜索模式必填；也可直接填写 arXiv ID。
- `field`：`all`、`title`、`author`、`abstract`，默认 `all`。
- `match`：`all`、`any`、`phrase`，默认 `all`。
- `exclude`、`category`、`fromYear`、`toYear`：可选的排除词、分类和提交年份范围。
- `sort`：`relevance`、`submittedDate`、`lastUpdatedDate`，默认 `relevance`。
- `order`：`ascending` 或 `descending`，默认 `descending`。
- `start`：从 0 开始的结果偏移；`limit`：每页 1–50 篇，默认 20。

响应中的 `meta` 包含 `totalResults`、`start`、`limit`、`hasPrevious`、`hasNext` 和实际搜索配置。Atom 的 `opensearch:totalResults`、`startIndex`、`itemsPerPage` 会被解析为稳定 JSON。搜索和 feed 响应都使用 `Cache-Control: private, no-store`，避免在共享缓存中留下用户查询。

## 本地画像与反馈

- v3 画像保存在 `paper-orbit:affinity-v3`，每个信号同时记录 `value` 和 `updatedAt`。若 v3 不存在，会从 `paper-orbit:affinity-v2` 迁移并写入 v3；旧键不会被删除。
- 偏好按 90 天半衰期衰减：`有效值 = 原值 × 2^(-经过天数 / 90)`。保存论文为正反馈，首次开始阅读权重更高，生成报告最强；从书库移除只部分撤回保存信号。
- 显式论文反馈保存在 `paper-orbit:paper-feedback-v1`：`相关` 强提升，`不相关` 强降权，`过于宽泛` 较弱降权，`已读过 / 已知` 只压低当前论文而不惩罚主题。再次点击当前选项可清除，操作后也提供即时撤销。
- 反馈历史在兴趣设置中持续可见，因此论文即使不再出现在今日候选池，也不会失去清除入口。损坏的本地 JSON 会安全回退为空状态。

兴趣、画像、显式反馈、书库、阅读记录、候选池缓存和报告只保存在当前浏览器内按登录邮箱隔离的命名空间，不会作为 feed 参数上传。搜索词会按用户主动执行的检索发送到需要 ChatGPT 登录的 `/api/arxiv`；Paper Copilot 请求仍遵循下方独立的 PDF 全文与 API Key 边界。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
cp .env.example .env
# 编辑 .env，并至少为 PAPER_ORBIT_SESSION_SECRET 填入 openssl rand -hex 32 的结果
npm run dev
```

然后打开 `http://localhost:3000`。

注意：`/signin-with-chatgpt`、`/signout-with-chatgpt` 与 `/callback` 由 Sites 调度层提供，不属于本地 vinext 路由。纯 `localhost` 开发服务器在没有平台转发身份头时会跳转到本地不存在的登录入口；登录后的真实交互应在 Sites 预览或部署环境验证，自动化测试则通过受控身份头覆盖所有角色与 API 授权路径。不要为方便本地预览而添加生产可用的认证旁路。

## PDF 全文 Copilot

网页不能把个人 ChatGPT/Codex 订阅当作第三方网站的模型 API。Paper Orbit 使用独立计费的 [OpenAI Platform API](https://platform.openai.com/)：

1. 用户在“研究服务”面板中连接自己的 OpenAI API Key。Key 经 OpenAI 验证后，被 AES-GCM 加密进绑定当前登录账号的 `HttpOnly`、`SameSite=Strict` 浏览器会话 Cookie；不会写入 `localStorage`、数据库或仓库，关闭浏览器或连接满 12 小时后会话失效。
2. 每次提问时，服务端只接受合法的 arXiv ID，并自行构造 `https://arxiv.org/pdf/...` 地址，避免客户端要求模型读取任意 URL。
3. 服务端通过 OpenAI Responses API 的 `input_file` 把论文 PDF 全文交给模型。普通问题和报告使用低图像细节以节省 token；涉及图、表、公式或视觉内容的问题自动使用高细节。
4. Copilot 保留最近八轮对话上下文，并在回答旁显示本次输入/输出 token。模型回答仍经过语言漂移与来源长段复制检查；必要时自动重写一次，失败则明确降级为安全摘要预览。

PDF 输入会同时提取文本和页面图像，因此长论文可能产生较多输入 token；OpenAI 当前要求单个文件及单次请求中的文件总量小于 50 MB。API Key 必然会由 Paper Orbit 后端在请求期间处理，因此只应在你信任的部署上使用。

## 论文数据 API

- arXiv：通过 `https://export.arxiv.org/api/query` 公开接口执行结构化检索，无需个人 Key。用户在 Paper Orbit 中定制的是检索字段、匹配方式、分类、年份、排序、数量和浏览器本地兴趣画像。
- Semantic Scholar：公开无 Key 调用仍可提供引用信号，但会共享未认证限流。用户可以在“研究服务”面板连接自己的 Semantic Scholar API Key；服务端验证后将它加密到独立的 `HttpOnly` 会话 Cookie，之后只在请求 Semantic Scholar 时放入 `x-api-key` 请求头。
- 普通 `READER` 永远不会使用服务器的 `SEMANTIC_SCHOLAR_API_KEY`；该环境变量与共享 OpenAI Key 一样，只保留给 OWNER/MANAGER。

## 环境变量

- `PAPER_ORBIT_SESSION_SECRET`：启用每位用户自己的 OpenAI 与 Semantic Scholar 临时加密会话，至少 32 个字符；可用 `openssl rand -hex 32` 生成。生产环境必须作为部署 Secret 配置，绝不能提交到 Git。
- `OPENAI_MODEL`：覆盖默认模型 `gpt-5.6`。
- `OPENAI_API_KEY`：可选的站点共享后端 Key，只允许 OWNER/MANAGER 使用；普通用户无法回退到它。面向公众并要求各自付费时建议留空。
- `SEMANTIC_SCHOLAR_API_KEY`：可选的站点共享论文元数据 Key，同样只允许 OWNER/MANAGER 使用；普通用户可在网页连接自己的 Key。

没有个人会话或共享 `OPENAI_API_KEY` 时，接口只返回不消耗模型 token 的安全摘要预览，并在界面中明确标注“AI 未连接”。

## 常用命令

```bash
npm run dev      # 本地开发
npm run build    # 生成部署构建
npm run lint     # 静态检查
npm test         # 构建并验证产品、API、检索与本地推荐行为
```

## 主要目录

- `app/page.tsx`：ChatGPT 登录保护的产品入口。
- `app/paper-orbit-client.tsx`：站点交互、兴趣画像与本地阅读数据。
- `app/local-user-storage.ts`：按登录邮箱隔离的浏览器存储键，以及旧版无命名空间数据的一次性认领迁移。
- `app/access-control.ts`：所有已登录用户的 reader 授权，以及 OWNER/MANAGER 角色判定。
- `app/api/encrypted-session.ts`：个人外部服务 Key 共用的加密信封、邮箱绑定、过期和 Cookie 边界。
- `app/api/arxiv/route.ts`：通用 arXiv 候选生成、Semantic Scholar 批量影响力数据、Atom 元数据与高级搜索接口。
- `app/api/arxiv/session/route.ts`：个人 Semantic Scholar API Key 验证、状态与断开连接。
- `app/api/arxiv/research-session.ts`：Semantic Scholar 加密会话与管理账号共享 Key 隔离。
- `app/api/arxiv/search-query.ts`：环境无关的参数归一化与安全 arXiv 查询生成。
- `app/api/arxiv/recommendation.ts`：Orbit v2 基线、本地画像迁移/衰减、反馈语义、可解释评分与确定性多样性重排。
- `app/api/ai/route.ts`：OpenAI Responses API、arXiv PDF 全文输入、连续对话、阅读报告与输出质量保护。
- `app/api/ai/session/route.ts`：个人 API Key 验证、加密会话状态与断开连接。
- `app/api/ai/openai-session.ts`：AES-GCM 会话加密、Cookie 与模型配置。
- `.openai/hosting.json`：Sites 项目标识。

书库、阅读状态、兴趣、行为画像、显式反馈、候选池与报告默认保存在按登录邮箱隔离的浏览器 `localStorage`；清理站点数据会同时清除这些内容。
