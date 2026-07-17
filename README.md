# Paper Orbit

Paper Orbit 是一个面向所有 ChatGPT 登录用户的每日论文阅读站：每天推荐 10 篇与你研究兴趣相关的论文，支持 arXiv 搜索、基于 PDF 全文的 Paper Copilot 对话、自动阅读报告、论文书库与阅读进度。

## 身份、角色与费用隔离

- 任何完成 Sign in with ChatGPT 的用户都可以进入 Paper Orbit；匿名页面和 API 请求仍会被拒绝。
- 现有两个账号继续显示为 `OWNER` 与 `MANAGER`，其他登录账号显示为 `READER`。
- 每位 `READER` 必须连接自己的 OpenAI 或 OpenAI Responses 兼容服务（API Base URL、模型 ID、API Key）才能使用真实 PDF 全文 Copilot；没有个人连接时只提供零模型 token 的安全摘要预览。
- 即使服务器配置了共享 `OPENAI_API_KEY`，它也只会提供给 OWNER/MANAGER，普通用户无法消耗站点管理员的模型额度。
- arXiv 元数据查询使用公开 API，不需要、也没有供此检索流程使用的个人“arXiv API Key”。用户可选连接自己的 Semantic Scholar API Key，以获得更稳定的引用和 influential citation 信号。
- 个人 AI Base URL、模型 ID、API Key 与 Semantic Scholar Key 分别保存在绑定当前身份的 AES-GCM 加密 `HttpOnly` Cookie 中；不进入浏览器 `localStorage`、数据库或 Git。生产站点仍使用最长 12 小时的临时会话，显式的本地模式则只在本机保留加密会话，最长 90 天。
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

要在本机完整使用 Paper Orbit（包括本地开发身份、加密个人 API 会话和回环模型服务），运行：

```bash
npm install
npm run dev:local
```

然后打开 `http://localhost:3000`。这个命令只监听本机回环地址，并使用 `local@paperorbit.dev` 作为本地开发身份。首次运行会在 Git 忽略的 `.paperorbit/local-session-secret` 中生成一个权限为 `0600` 的随机加密密钥；后续启动复用它，所以关闭浏览器或重启本地服务后仍可识别已经连接的本机会话，最长 90 天。

每次本地开发进程还会在内存中生成一个独立的入口标记。开发服务器会先删除浏览器自行提供的同名请求头，只在非 TLS 的本机回环连接、直接 Host 与监听端口一致时重新加上该标记；因此伪造 `X-Forwarded-Host`、`X-Forwarded-Proto` 或内部标记都不能把公网请求变成本地身份。这个标记无需配置，不会写入 `.env`、Cookie、仓库或部署产物。

真实 API Base URL、模型 ID 与 API Key 不会写进这个文件：它们只以 AES-GCM 密文存在浏览器的 host-only、`HttpOnly`、`SameSite=Strict` Cookie 中。`.paperorbit` 目录不会进入 Git 或 Sites 部署产物；清除网页中的个人服务会话即可立即删除对应 Cookie。删除 `.paperorbit/local-session-secret` 会使旧密文无法再解密，之后需要重新连接一次。

本地模式可以在“连接你的研究服务”中填写：

```text
API Base URL: http://127.0.0.1:8080/v1
模型 ID:      你的本地服务实际模型 ID
API Key:      你的本地服务 Key
```

也可以不经网页连接，直接把本机服务写进 Git 忽略的 `.env`：

```text
OPENAI_API_KEY=你的本地服务 Key
OPENAI_MODEL=你的本地服务实际模型 ID
OPENAI_BASE_URL=http://127.0.0.1:8080/v1
```

`npm run dev:local` 启动后，本机回环身份会直接使用这份共享凭据，页面加载时即显示“已连接”；在网页中另行连接的个人会话仍优先于 `.env`。这个例外只在显式本地模式生效：公网部署的共享 Key 仍然只允许 OWNER/MANAGER 使用，且 `OPENAI_BASE_URL` 必须是公网 HTTPS 地址；无效地址会直接禁用共享凭据，而不会把 Key 回退发送到官方地址。

本地服务仍需提供兼容的 `/models`、`/responses` 和 PDF `input_file` 能力。点击“验证并连接”时，Paper Orbit 会先读取 `/models`，再向所填模型发送一次极小的非流式 `/responses` 文本请求；只有模型实际返回标准 JSON 文本后才会保存加密会话。这次验证只证明 Key、模型和文本 Responses 链路可用，会产生少量模型 token，但不会发送论文 PDF，也不能替代后续的 PDF 能力验证。只有通过 `npm run dev:local` 启动、且 Paper Orbit 页面自身位于 `http://127.0.0.1` 或 `http://localhost` 时，才会额外放行这两个 HTTP 回环主机；公网生产站点仍严格拒绝 HTTP、本机和内网 Base URL。

如需覆盖本地显示身份，可在启动命令前设置 `PAPER_ORBIT_LOCAL_USER_EMAIL` 与 `PAPER_ORBIT_LOCAL_USER_NAME`。这些值只用于本地数据命名空间与界面显示，不会创建 ChatGPT 登录。

普通开发启动方式仍然是：

```bash
npm install
cp .env.example .env
# 编辑 .env，并至少为 PAPER_ORBIT_SESSION_SECRET 填入 openssl rand -hex 32 的结果
npm run dev
```

然后打开 `http://localhost:3000`。

注意：`/signin-with-chatgpt`、`/signout-with-chatgpt` 与 `/callback` 由 Sites 调度层提供，不属于本地 vinext 路由。普通 `npm run dev` 在没有平台转发身份头时仍会跳转到本地不存在的登录入口；`npm run dev:local` 提供的是显式启用、回环来源限定且无法在生产域名触发的开发身份，不会替代或绕过生产环境的 ChatGPT 登录。

## PDF 全文 Copilot

网页不能把个人 ChatGPT/Codex 订阅当作第三方网站的模型 API。Paper Orbit 使用与订阅分开的 API 额度：可以连接 [OpenAI Platform API](https://platform.openai.com/)，也可以连接满足下述协议要求的第三方服务。

1. 用户在“研究服务”面板中填写 API Base URL、模型 ID 和 API Key。默认地址为 `https://api.openai.com/v1`；也可连接第三方 OpenAI 兼容服务。Paper Orbit 会先检查该地址的 `/models`，再对所填模型执行一次最多 16 个输出 token 的真实非流式 `/responses` 文本推理；任一步失败都不会创建或替换会话。通过后才把三项配置一起 AES-GCM 加密进绑定当前身份的 `HttpOnly`、`SameSite=Strict` 浏览器 Cookie；不会写入 `localStorage`、数据库或仓库。生产站点关闭浏览器或连接满 12 小时后失效；`npm run dev:local` 启动的本机模式使用最长 90 天的本机持久 Cookie。非官方 Key 不要求 `sk-` 前缀。
2. 每次提问时，服务端只接受合法的 arXiv ID，并自行构造 `https://arxiv.org/pdf/...` 地址，避免客户端要求模型读取任意 URL。调用模型前会先独立检查 arXiv：HEAD 用于状态和初步大小判断，随后固定执行一次八字节 Range 请求，验证最终主机、`%PDF-` 文件签名、内容类型和完整文件大小；无法证明完整大小、签名不符或超过 50 MB 时都不会调用模型。
3. 服务端通过所连接服务的 `/responses` 接口，以 `input_file.file_url` 把已核验的论文 PDF 全文交给模型。普通问题和报告使用低图像细节以节省 token；涉及图、表、公式或视觉内容的问题自动使用高细节。自定义兼容服务优先使用 SSE 流式响应，明确拒绝流式参数时才回退到连接阶段已经验证过的 JSON 响应。成功响应正文最多读取 4 MiB，错误正文最多读取 32 KiB；异常大或无限输出会被主动取消，不会自动重试。
4. 只有快速发生的 502/503/504、连接中断或短超时会自动重试一次；已经运行较久的 PDF 请求不会自动重复，以免同一篇 PDF 被计费两次。可重试的模型失败还会执行一个最多 16 个输出 token 的文本探针，用于区分“AI 文本服务也不可用”和“文本服务正常、只有 PDF 全文处理失败”。
5. Copilot 保留最近八轮对话上下文，并把本次输入/输出 token、arXiv 核验结果、文件大小、传输模式和尝试次数绑定在本次回答上，不再把上一次成功调用的 token 误显示到后续报错下面。模型回答仍经过语言漂移与来源长段复制检查；必要时自动重写一次，失败则明确降级为安全摘要预览。

自定义服务必须兼容 OpenAI 的 `/models`、Responses `/responses` 请求，以及 [PDF `input_file` 外部 URL 输入](https://developers.openai.com/api/docs/guides/file-inputs)；只兼容 Chat Completions 的服务无法完成这条全文链路。连接验证会确认 `/models` 和真实文本 `/responses`，实际 PDF 外部 URL 能力会在每次论文提问时确认。管理面板显示“文本已验证”不表示模型已经读取过 PDF；只有至少一次全文请求成功后，Copilot 状态才显示“全文已验证”。生产环境的 Base URL 只允许公网 HTTPS 域名和标准 443 端口，不能包含账号、查询参数或片段，也不能指向 localhost、内网、链路本地、云元数据等受限地址；上游重定向不会被跟随，避免把 Key 泄露给另一个地址。显式的 `npm run dev:local` 模式只额外允许当前电脑上的 `http://127.0.0.1` 与 `http://localhost` 回环服务。

失败时，聊天消息下方会显示分层诊断，而不是统一归咎于 arXiv：包括 arXiv 是否可达、文件大小、模型文本探针、兼容服务 HTTP 状态、传输模式、尝试次数，以及一个可用于服务端日志关联的 Paper Orbit 诊断 ID。常见分类覆盖 arXiv 不可达/限流/无效 PDF/大小不可证明/文件过大、Key 或权限错误、额度或限流、模型不存在、Responses 或 PDF 输入不兼容、异常大响应、长请求超时、空响应/SSE 格式错误和上游服务不可用。上游 request ID 只有通过严格字符、长度和当前凭据重叠检查后才会出现在诊断中；诊断不会返回 API Key 或上游原始错误正文。

PDF 输入会同时提取文本和页面图像，因此长论文可能产生较多输入 token；不同兼容服务的文件限制与计费规则可能不同。API Key 必然会由 Paper Orbit 后端在请求期间处理；所连接的服务也会收到 arXiv PDF 地址、论文元数据、用户问题和最近对话，因此只应使用你信任的 Paper Orbit 部署和模型服务商。

## 论文数据 API

- arXiv：通过 `https://export.arxiv.org/api/query` 公开接口执行结构化检索，无需个人 Key。用户在 Paper Orbit 中定制的是检索字段、匹配方式、分类、年份、排序、数量和浏览器本地兴趣画像。
- Semantic Scholar：公开无 Key 调用仍可提供引用信号，但会共享未认证限流。用户可以在“研究服务”面板连接自己的 Semantic Scholar API Key；服务端验证后将它加密到独立的 `HttpOnly` 会话 Cookie，之后只在请求 Semantic Scholar 时放入 `x-api-key` 请求头。
- 普通 `READER` 永远不会使用服务器的 `SEMANTIC_SCHOLAR_API_KEY`；该环境变量与共享 OpenAI Key 一样，只保留给 OWNER/MANAGER。

## 环境变量

- `PAPER_ORBIT_SESSION_SECRET`：启用每位用户自己的 OpenAI 与 Semantic Scholar 加密会话，至少 32 个字符；可用 `openssl rand -hex 32` 生成。生产环境必须作为部署 Secret 配置，绝不能提交到 Git。`npm run dev:local` 未显式设置该变量时，会自动生成并复用 Git 忽略的本机密钥。
- `OPENAI_MODEL`：覆盖默认模型 `gpt-5.6`，只影响管理员共享连接和未显式选择模型的旧个人会话；新个人连接使用网页中填写的模型 ID。
- `OPENAI_API_KEY`：可选的站点共享后端 Key，只允许 OWNER/MANAGER 使用；普通用户无法回退到它。面向公众并要求各自付费时建议留空。`npm run dev:local` 的回环开发身份视为本机部署的所有者，因此本地模式可以直接使用这份 `.env` 凭据聊天。
- `OPENAI_BASE_URL`：可选，把共享凭据指向 OpenAI 兼容服务。生产环境必须是公网 HTTPS 根地址；`npm run dev:local` 额外允许 `http://127.0.0.1` 或 `http://localhost` 回环服务。填写无效地址会直接禁用共享凭据，不会回退到官方地址。
- `SEMANTIC_SCHOLAR_API_KEY`：可选的站点共享论文元数据 Key，同样只允许 OWNER/MANAGER 使用；普通用户可在网页连接自己的 Key。

没有个人会话或共享 `OPENAI_API_KEY` 时，接口只返回不消耗模型 token 的安全摘要预览，并在界面中明确标注“AI 未连接”。

## 常用命令

```bash
npm run dev      # 本地开发
npm run dev:local # 本地完整使用：回环开发身份 + localhost/127.0.0.1 模型 API
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
- `app/api/ai/copilot-transport.ts`：arXiv PDF 可用性/大小预检，以及 JSON/SSE Responses 传输、超时、请求 ID、错误清洗和 token 用量提取。
- `app/api/ai/bounded-response.ts`：对连接验证和 Copilot 上游响应执行按字节限长、超限取消与安全 JSON 解析。
- `app/api/ai/session/route.ts`：个人 Base URL、模型与 API Key 验证、加密会话状态与断开连接。
- `app/api/ai/openai-session.ts`：AES-GCM 会话加密、Cookie、旧会话兼容与模型配置。
- `app/api/ai/provider-config.ts`：OpenAI 兼容地址、模型和 Key 归一化，以及公网 HTTPS/SSRF 安全边界。
- `.openai/hosting.json`：Sites 项目标识。

书库、阅读状态、兴趣、行为画像、显式反馈、候选池与报告默认保存在按登录邮箱隔离的浏览器 `localStorage`；清理站点数据会同时清除这些内容。
