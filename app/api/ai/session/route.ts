import { paperOrbitApiAccessError } from "../../../access-control";
import {
  clearOpenAISessionCookie,
  openAICredential,
  openAIModel,
  openAISessionAvailable,
  openAISessionCookie,
  readOpenAISession,
  sealOpenAISession,
  sharedOpenAICredential,
} from "../openai-session";
import {
  DEFAULT_OPENAI_BASE_URL,
  cleanOpenAIApiKey,
  cleanOpenAIModel,
  normalizeOpenAIBaseUrl,
  openAIProviderEndpoint,
} from "../provider-config";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

async function validateOpenAIConnection(apiKey: string, baseUrl: string) {
  let response: Response;
  try {
    response = await fetch(openAIProviderEndpoint(baseUrl, "models"), {
      headers: { Authorization: `Bearer ${apiKey}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("OPENAI_ENDPOINT_UNREACHABLE");
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("OPENAI_KEY_INVALID");
  }
  if (response.status === 429) throw new Error("OPENAI_QUOTA_UNAVAILABLE");
  if (!response.ok) throw new Error("OPENAI_ENDPOINT_INCOMPATIBLE");

  try {
    const payload = (await response.json()) as { data?: unknown };
    if (!Array.isArray(payload.data)) throw new Error("invalid models response");
  } catch {
    throw new Error("OPENAI_ENDPOINT_INCOMPATIBLE");
  }
}

export async function GET(request: Request) {
  const accessError = await paperOrbitApiAccessError();
  if (accessError) return accessError;

  const session = await readOpenAISession(request);
  const credential = await openAICredential(request);
  return json({
    connected: Boolean(credential),
    source: session ? "session" : credential?.source ?? null,
    baseUrl: credential?.baseUrl ?? null,
    model: credential?.model ?? null,
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
    const body = (await request.json()) as {
      apiKey?: unknown;
      baseUrl?: unknown;
      model?: unknown;
    };
    const apiKey = cleanOpenAIApiKey(body.apiKey);
    if (!apiKey) {
      return json({ error: "请输入有效的 API Key。", code: "OPENAI_KEY_INVALID" }, { status: 400 });
    }

    const baseUrl = normalizeOpenAIBaseUrl(
      body.baseUrl === undefined ? DEFAULT_OPENAI_BASE_URL : body.baseUrl,
    );
    if (!baseUrl) {
      return json(
        {
          error: "API Base URL 必须是公网 HTTPS 地址，且不能包含账号、查询参数、片段、本机或内网地址。",
          code: "OPENAI_BASE_URL_INVALID",
        },
        { status: 400 },
      );
    }

    const model = body.model === undefined || body.model === ""
      ? openAIModel()
      : cleanOpenAIModel(body.model);
    if (!model) {
      return json(
        { error: "请输入有效的模型 ID。", code: "OPENAI_MODEL_INVALID" },
        { status: 400 },
      );
    }

    await validateOpenAIConnection(apiKey, baseUrl);
    const sealedSession = await sealOpenAISession(request, { apiKey, baseUrl, model });
    return json(
      {
        connected: true,
        source: "session",
        baseUrl,
        model,
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
      return json({ error: "这个 API Key 无效、已撤销，或无权访问该服务。", code }, { status: 401 });
    }
    if (code === "OPENAI_QUOTA_UNAVAILABLE") {
      return json({ error: "API 服务当前额度不足或请求过快。", code }, { status: 429 });
    }
    if (code === "OPENAI_ENDPOINT_UNREACHABLE") {
      return json(
        { error: "无法连接该 API Base URL；请检查地址、HTTPS 证书和网络可达性。", code },
        { status: 502 },
      );
    }
    if (code === "OPENAI_ENDPOINT_INCOMPATIBLE") {
      return json(
        { error: "该地址未提供兼容的 /models 接口，请填写完整 API 根地址（例如 https://example.com/v1）。", code },
        { status: 502 },
      );
    }
    return json(
      { error: "暂时无法验证 API 连接，请稍后重试。", code: "OPENAI_VALIDATION_FAILED" },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const accessError = await paperOrbitApiAccessError();
  if (accessError) return accessError;
  const sharedCredential = sharedOpenAICredential(request);
  return json(
    {
      connected: Boolean(sharedCredential),
      source: sharedCredential?.source ?? null,
      baseUrl: sharedCredential?.baseUrl ?? null,
      model: sharedCredential?.model ?? null,
      sessionAvailable: openAISessionAvailable(),
    },
    { headers: { "Set-Cookie": clearOpenAISessionCookie(request) } },
  );
}
