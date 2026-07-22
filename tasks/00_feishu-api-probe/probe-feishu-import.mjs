#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_API_BASE_URL = "https://open.feishu.cn/open-apis";
const REQUIRED_ENV = ["FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_FOLDER_TOKEN"];

class ProbeError extends Error {
  constructor(category, message, details = {}) {
    super(message);
    this.name = "ProbeError";
    this.category = category;
    this.details = details;
  }
}

async function main() {
  const markdownPath = process.argv[2];
  if (!markdownPath || markdownPath === "--help" || markdownPath === "-h") {
    printUsage(markdownPath ? 0 : 2);
    return;
  }

  const env = {
    ...process.env,
    ...(await readDotEnv(path.join(process.cwd(), ".env"))),
  };
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length > 0) {
    console.error(`Missing required Feishu configuration: ${missing.join(", ")}`);
    console.error("Add FEISHU_APP_ID, FEISHU_APP_SECRET, and FEISHU_FOLDER_TOKEN to .env.");
    process.exitCode = 2;
    return;
  }

  const client = new FeishuClient({
    appId: env.FEISHU_APP_ID,
    appSecret: env.FEISHU_APP_SECRET,
    folderToken: env.FEISHU_FOLDER_TOKEN,
    apiBaseUrl: env.FEISHU_API_BASE_URL || DEFAULT_API_BASE_URL,
    importType: env.FEISHU_IMPORT_TYPE || "docx",
    timeoutMs: Number(env.FEISHU_IMPORT_TIMEOUT_MS || 120000),
    pollMs: Number(env.FEISHU_IMPORT_POLL_MS || 2000),
  });

  try {
    const result = await client.probe(markdownPath);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof ProbeError) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            category: error.category,
            message: redact(String(error.message), env),
            details: redactObject(error.details, env),
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

function printUsage(exitCode) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write("Usage: node tasks/00_feishu-api-probe/probe-feishu-import.mjs <file.md>\n");
  process.exitCode = exitCode;
}

async function readDotEnv(filePath) {
  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }

  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

class FeishuClient {
  constructor(options) {
    this.options = options;
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, "");
  }

  async probe(markdownPath) {
    const absolutePath = path.resolve(markdownPath);
    const markdown = await readFile(absolutePath);
    const fileName = path.basename(absolutePath);
    const token = await this.getTenantAccessToken();
    const upload = await this.uploadMarkdown({ token, fileName, markdown });

    try {
      const ticket = await this.createImportTask({ token, fileName, fileToken: upload.fileToken });
      const imported = await this.pollImportTask({ token, ticket });
      return {
        ok: true,
        route: "import-task",
        file: absolutePath,
        ticket,
        imported,
        uploadedFile: upload,
      };
    } catch (error) {
      if (!(error instanceof ProbeError) || !isPlanBEligible(error)) throw error;
      return {
        ok: true,
        route: "plan-b-upload",
        file: absolutePath,
        reason: {
          category: error.category,
          message: error.message,
          details: error.details,
        },
        uploadedFile: upload,
      };
    }
  }

  async getTenantAccessToken() {
    const body = await this.postJson("/auth/v3/tenant_access_token/internal", {
      app_id: this.options.appId,
      app_secret: this.options.appSecret,
    });

    if (body.code !== 0 || !body.tenant_access_token) {
      throw new ProbeError("authentication", "Failed to get tenant_access_token.", {
        code: body.code,
        msg: body.msg,
      });
    }
    return body.tenant_access_token;
  }

  async uploadMarkdown({ token, fileName, markdown }) {
    const form = new FormData();
    form.append("file_name", fileName);
    form.append("parent_type", "explorer");
    form.append("parent_node", this.options.folderToken);
    form.append("size", String(markdown.byteLength));
    form.append("file", new Blob([markdown], { type: "text/markdown" }), fileName);

    const body = await this.postForm("/drive/v1/files/upload_all", form, token);
    const fileToken = body?.data?.file_token;
    if (body.code !== 0 || !fileToken) {
      throw new ProbeError(classifyFeishuCode(body.code), "Failed to upload Markdown file.", {
        code: body.code,
        msg: body.msg,
      });
    }
    return {
      fileToken,
      url: body?.data?.url || makeFeishuDriveUrl(fileToken),
    };
  }

  async createImportTask({ token, fileName, fileToken }) {
    const body = await this.postJson(
      "/drive/v1/import_tasks",
      {
        file_extension: "md",
        file_name: fileName.replace(/\.md$/i, ""),
        file_token: fileToken,
        type: this.options.importType,
        point: {
          mount_type: 1,
          mount_key: this.options.folderToken,
        },
      },
      token,
    );

    const ticket = body?.data?.ticket;
    if (body.code !== 0 || !ticket) {
      throw new ProbeError(classifyFeishuCode(body.code), "Failed to create Markdown import task.", {
        code: body.code,
        msg: body.msg,
      });
    }
    return ticket;
  }

  async pollImportTask({ token, ticket }) {
    const deadline = Date.now() + this.options.timeoutMs;
    let lastBody = null;

    while (Date.now() < deadline) {
      const body = await this.getJson(
        `/drive/v1/import_tasks/${encodeURIComponent(ticket)}`,
        token,
      );
      lastBody = body;
      if (body.code !== 0) {
        throw new ProbeError(classifyFeishuCode(body.code), "Failed to poll import task.", {
          code: body.code,
          msg: body.msg,
        });
      }

      const status = body?.data?.result?.job_status ?? body?.data?.job_status ?? body?.data?.status;
      const tokenResult = body?.data?.result?.token ?? body?.data?.token ?? body?.data?.file_token;
      const url = body?.data?.result?.url ?? body?.data?.url ?? makeFeishuDocumentUrl(tokenResult);
      if (isSuccessStatus(status) && (tokenResult || url)) {
        return { status, token: tokenResult, url };
      }
      if (isFailureStatus(status)) {
        throw new ProbeError("protocol", "Import task failed.", { status, body });
      }

      await delay(this.options.pollMs);
    }

    throw new ProbeError("timeout", "Timed out while polling import task.", {
      ticket,
      lastBody,
    });
  }

  async getJson(pathname, token) {
    return this.fetchJson(pathname, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async postJson(pathname, payload, token) {
    return this.fetchJson(pathname, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  }

  async postForm(pathname, form, token) {
    return this.fetchJson(pathname, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
  }

  async fetchJson(pathname, init) {
    let response;
    try {
      response = await fetch(`${this.apiBaseUrl}${pathname}`, init);
    } catch (error) {
      throw new ProbeError("network", "Network request failed.", { cause: error.message });
    }

    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new ProbeError("protocol", "Feishu returned non-JSON response.", {
        status: response.status,
        preview: text.slice(0, 500),
      });
    }

    if (!response.ok) {
      throw new ProbeError(classifyHttpStatus(response.status), "Feishu HTTP request failed.", {
        status: response.status,
        code: body?.code,
        msg: body?.msg,
      });
    }
    return body;
  }
}

function classifyHttpStatus(status) {
  if (status === 401 || status === 403) return "permission";
  if (status === 408 || status === 429 || status >= 500) return "transient";
  return "protocol";
}

function classifyFeishuCode(code) {
  if (code === 0) return "ok";
  const value = String(code ?? "");
  if (value.includes("999916") || value.includes("999912")) return "authentication";
  if (value.startsWith("106") || value.startsWith("7") || value.includes("permission")) {
    return "permission";
  }
  return "protocol";
}

function isPlanBEligible(error) {
  return ["permission", "protocol", "timeout"].includes(error.category);
}

function isSuccessStatus(status) {
  return status === 0 || status === "0" || status === "success" || status === "done";
}

function isFailureStatus(status) {
  return status === -1 || status === "failed" || status === "fail" || status === "error";
}

function makeFeishuDriveUrl(fileToken) {
  return fileToken ? `https://feishu.cn/file/${encodeURIComponent(fileToken)}` : undefined;
}

function makeFeishuDocumentUrl(token) {
  return token ? `https://feishu.cn/docx/${encodeURIComponent(token)}` : undefined;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactObject(value, env) {
  return JSON.parse(redact(JSON.stringify(value), env));
}

function redact(text, env) {
  let result = text;
  for (const key of REQUIRED_ENV) {
    const value = env[key];
    if (value) result = result.split(value).join("[redacted]");
  }
  return result;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
