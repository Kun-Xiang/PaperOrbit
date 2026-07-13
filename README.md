# Paper Orbit

Paper Orbit 是一个个人每日论文阅读站：每天推荐 10 篇与你研究兴趣相关的论文，支持 arXiv 搜索、Paper Copilot 对话、自动阅读报告、论文书库与阅读进度。

## 推荐系统（Orbit v2）

每日推荐不再是简单关键词截断，而是：

1. 根据兴趣画像动态生成 arXiv 查询，从最新结果中取得最多 60 篇候选。
2. 综合兴趣相关度、个人阅读反馈、时效、影响力、实验/开源证据五类信号评分。
3. 使用 Semantic Scholar 的引用与 influential citation 数据校准影响力；服务不可用时自动退回 arXiv 原生信号。
4. 使用多样性重排减少标题、标签和主分类高度相似的论文，并保留少量相邻主题探索。
5. 从“保存、开始阅读、生成报告”行为中学习标签与分类偏好；画像保存在本机浏览器中。

权重位于 `app/api/arxiv/recommendation.ts`：相关度 42%、阅读偏好 12%、时效 16%、影响力 17%、证据信号 13%。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
cp .env.example .env
npm run dev
```

然后打开 `http://localhost:3000`。

## 可选环境变量

- `OPENAI_API_KEY`：启用真实的 Paper Copilot 对话与深度报告。未配置时使用摘要辅助模式。
- `OPENAI_MODEL`：覆盖默认 OpenAI 模型。
- `SEMANTIC_SCHOLAR_API_KEY`：提高 Semantic Scholar 影响力数据接口的可用额度；个人轻量使用可不配置。

## 常用命令

```bash
npm run dev      # 本地开发
npm run build    # 生成部署构建
npm test         # 构建并验证产品页面与推荐管线
```

## 主要目录

- `app/page.tsx`：站点交互、兴趣画像与本地阅读数据。
- `app/api/arxiv/route.ts`：arXiv 候选生成、Semantic Scholar 批量影响力数据与搜索接口。
- `app/api/arxiv/recommendation.ts`：可解释多信号评分与多样性重排。
- `app/api/ai/route.ts`：Paper Copilot 与阅读报告。
- `.openai/hosting.json`：Sites 项目标识。

书库、阅读状态、兴趣、行为画像与报告默认保存在浏览器 `localStorage`；清理站点数据会同时清除这些内容。
