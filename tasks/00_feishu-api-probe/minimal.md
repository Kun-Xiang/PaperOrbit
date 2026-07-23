# PaperOrbit Feishu Probe

这是一份最小 Markdown 探针，用来验证飞书自建应用是否能把 PaperOrbit / STAR 产物同步为飞书文档。

## Checklist

- 获取 `tenant_access_token`
- 上传 Markdown 文件
- 创建 Markdown 导入任务
- 轮询任务并输出 URL

## Tiny Table

| Field | Value |
|---|---|
| Source | PaperOrbit |
| Mode | M0 API probe |

## Formula Text

The score is kept as text: `score = relevance * influence`.

```text
Hello from PaperOrbit.
```
