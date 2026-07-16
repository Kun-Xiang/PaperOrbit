import { paperOrbitApiAccessError } from "../../../access-control";
import {
  clearOpenAISessionCookie,
  openAICredential,
  openAIModel,
  openAISessionAvailable,
  openAISessionCookie,
  readOpenAISession,
  sealOpenAISession,
} from "../openai-session";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

function cleanApiKey(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 512) : "";
}

async function validateOpenAIKey(apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (response.ok) return;
  if (response.status === 401) throw new Error("OPENAI_KEY_INVALID");
  if (response.status === 429) throw new Error("OPENAI_QUOTA_UNAVAILABLE");
  throw new Error("OPENAI_VALIDATION_FAILED");
}

export async function GET(request: Request) {
  const accessError = await paperOrbitApiAccessError();
  if (accessError) return accessError;

  const session = await readOpenAISession(request);
  const credential = await openAICredential(request);
  return json({
    connected: Boolean(credential),
    source: session ? "session" : credential?.source ?? null,
    model: credential ? openAIModel() : null,
    sessionAvailable: openAISessionAvailable(),
  });
}

export async function POST(request: Request) {
  const accessError = await paperOrbitApiAccessError();
  if (accessError) return accessError;
  if (!openAISessionAvailable()) {
    return json(
      {
        error: "服务器尚未配置 PAPER_ORBIT_SESSION_SECRET，暂时不能建立个人 AI 会话。",
        code: "SESSION_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { apiKey?: unknown };
    const apiKey = cleanApiKey(body.apiKey);
    if (apiKey.length < 20) {
      return json({ error: "请输入有效的 OpenAI API Key。", code: "OPENAI_KEY_INVALID" }, { status: 400 });
    }

    await validateOpenAIKey(apiKey);
    const sealedSession = await sealOpenAISession(request, apiKey);
    return json(
      {
        connected: true,
        source: "session",
        model: openAIModel(),
        sessionAvailable: true,
      },
      {
        headers: {
          ...NO_STORE_HEADERS,
          "Set-Cookie": openAISessionCookie(request, sealedSession),
        },
      },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "OPENAI_VALIDATION_FAILED";
    if (code === "OPENAI_KEY_INVALID") {
      return json({ error: "这个 OpenAI API Key 无效或已撤销。", code }, { status: 401 });
    }
    if (code === "OPENAI_QUOTA_UNAVAILABLE") {
      return json({ error: "OpenAI API 当前额度不足或请求过快。", code }, { status: 429 });
    }
    return json(
      { error: "暂时无法验证 OpenAI API Key，请稍后重试。", code: "OPENAI_VALIDATION_FAILED" },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const accessError = await paperOrbitApiAccessError();
  if (accessError) return accessError;
  return json(
    {
      connected: Boolean(process.env.OPENAI_API_KEY?.trim()),
      source: process.env.OPENAI_API_KEY?.trim() ? "shared" : null,
      model: process.env.OPENAI_API_KEY?.trim() ? openAIModel() : null,
      sessionAvailable: openAISessionAvailable(),
    },
    { headers: { "Set-Cookie": clearOpenAISessionCookie(request) } },
  );
}
