# Feishu API Probe

This directory belongs to STAR leaf `00_feishu-api-probe`.

## Required local configuration

Add these values to the project-root `.env` file. Keep them private and do not commit `.env`.

```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_FOLDER_TOKEN=xxx
```

Optional overrides:

```bash
FEISHU_API_BASE_URL=https://open.feishu.cn/open-apis
FEISHU_IMPORT_TYPE=docx
FEISHU_IMPORT_TIMEOUT_MS=120000
FEISHU_IMPORT_POLL_MS=2000
```

## Run

```bash
node tasks/00_feishu-api-probe/probe-feishu-import.mjs tasks/00_feishu-api-probe/minimal.md
```

The probe first validates the three required environment variables without making any network request when they are missing. With credentials present, it fetches a tenant token, uploads the Markdown file into the configured folder, then tries to create and poll a Markdown import task. If import is unavailable because of permission or API support, the uploaded Markdown file URL is reported as Plan B.

The script redacts secrets in diagnostic output.
