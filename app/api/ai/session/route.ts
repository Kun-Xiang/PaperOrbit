import { paperOrbitApiAccessError } from "../../../access-control";
import { isLocalDevelopmentRequest } from "../../../local-development";
import {
  clearOpenAISessionCookie,
  openAICredential,
  openAIModel,
  openAISessionAvailable,
  openAISessionCookie,
  readOpenAISession,
  sealValidatedOpenAISession,
  sharedOpenAICredential,
} from "../openai-session";
import {
  DEFAULT_OPENAI_BASE_URL,
  cleanOpenAIApiKey,
  cleanOpenAIModel,
  normalizeOpenAIBaseUrl,
  openAIProviderEndpoint,
} from "../provider-config";
import {
  readBoundedResponseJson,
  ResponseBodyTooLargeError,
} from "../bounded-response";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_MODELS_RESPONSE_BYTES = 1024 * 1024;
const MAX_CONNECTION_RESPONSE_BYTES = 256 * 1024;

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) parts.push(text.trim());
    }
  }
  return parts.join("\n").trim();
}

async function validateOpenAIConnection(apiKey: string, baseUrl: string, model: string) {
  let response: Response;
  try {
    response = await fetch(openAIProviderEndpoint(baseUrl, "models"), {
      headers: { Authorization: `Bearer ${apiKey}` },
      redirect: "manual",
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
    const payload = (await readBoundedResponseJson(
      response,
      MAX_MODELS_RESPONSE_BYTES,
    )) as { data?: unknown };
    if (!Array.isArray(payload.data)) throw new Error("invalid models response");
  } catch (error) {
    if (error instanceof ResponseBodyTooLargeError) {
      throw new Error("OPENAI_MODELS_RESPONSE_TOO_LARGE");
    }
    throw new Error("OPENAI_ENDPOINT_INCOMPATIBLE");
  }

  try {
    response = await fetch(openAIProviderEndpoint(baseUrl, "responses"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Reply with exactly PAPER_ORBIT_OK.",
              },
            ],
          },
        ],
        max_output_tokens: 16,
        stream: false,
        store: false,
      }),
    });
  } catch {
    throw new Error("OPENAI_RESPONSES_UNREACHABLE");
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("OPENAI_KEY_INVALID");
  }
  if (response.status === 429) throw new Error("OPENAI_QUOTA_UNAVAILABLE");
  if ([400, 404, 405, 422].includes(response.status)) {
    throw new Error("OPENAI_MODEL_OR_RESPONSES_INVALID");
  }
  if (!response.ok) throw new Error("OPENAI_LIVE_CHECK_FAILED");

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/event-stream") || (contentType && !contentType.includes("json"))) {
    throw new Error("OPENAI_RESPONSES_INCOMPATIBLE");
  }

  try {
    const payload = await readBoundedResponseJson(
      response,
      MAX_CONNECTION_RESPONSE_BYTES,
    );
    if (!extractResponseText(payload)) throw new Error("empty response");
  } catch (error) {
    if (error instanceof ResponseBodyTooLargeError) {
      throw new Error("OPENAI_RESPONSES_TOO_LARGE");
    }
    throw new Error("OPENAI_RESPONSES_INCOMPATIBLE");
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
        error: "PAPER_ORBIT_SESSION_SECRET is not configured, so a personal AI session cannot be created yet.",
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
      return json({ error: "Enter a valid API key.", code: "OPENAI_KEY_INVALID" }, { status: 400 });
    }

    const localDevelopment = isLocalDevelopmentRequest(request);
    const baseUrl = normalizeOpenAIBaseUrl(
      body.baseUrl === undefined ? DEFAULT_OPENAI_BASE_URL : body.baseUrl,
      { allowLocalLoopback: localDevelopment },
    );
    if (!baseUrl) {
      return json(
        {
          error: localDevelopment
            ? "Local mode additionally allows only the http://127.0.0.1 and http://localhost loopback addresses; every other address must still use public HTTPS."
            : "The API Base URL must use public HTTPS and cannot contain credentials, query parameters, fragments, localhost, or a private-network address.",
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
        { error: "Enter a valid model ID.", code: "OPENAI_MODEL_INVALID" },
        { status: 400 },
      );
    }

    await validateOpenAIConnection(apiKey, baseUrl, model);
    const sealedSession = await sealValidatedOpenAISession(request, { apiKey, baseUrl, model });
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
      return json({ error: "This API key is invalid, has been revoked, or cannot access the service.", code }, { status: 401 });
    }
    if (code === "OPENAI_QUOTA_UNAVAILABLE") {
      return json({ error: "The API service is out of quota or rate-limiting requests.", code }, { status: 429 });
    }
    if (code === "OPENAI_ENDPOINT_UNREACHABLE") {
      return json(
        { error: "Could not connect to this API Base URL. Check the address, HTTPS certificate, and network availability.", code },
        { status: 502 },
      );
    }
    if (code === "OPENAI_ENDPOINT_INCOMPATIBLE") {
      return json(
        { error: "This address does not provide a compatible /models endpoint. Enter the complete API root URL, such as https://example.com/v1.", code },
        { status: 502 },
      );
    }
    if (code === "OPENAI_MODELS_RESPONSE_TOO_LARGE") {
      return json(
        { error: "The service returned an unexpectedly large /models response, so the connection was not saved.", code },
        { status: 502 },
      );
    }
    if (code === "OPENAI_RESPONSES_UNREACHABLE") {
      return json(
        {
          error: "The /models endpoint is reachable, but the live /responses inference endpoint is not. The connection was not saved.",
          code,
        },
        { status: 502 },
      );
    }
    if (code === "OPENAI_MODEL_OR_RESPONSES_INVALID") {
      return json(
        {
          error: "This model could not complete a standard /responses text inference. Check the model ID and compatible endpoint. The connection was not saved.",
          code,
        },
        { status: 502 },
      );
    }
    if (code === "OPENAI_RESPONSES_INCOMPATIBLE") {
      return json(
        {
          error: "The service did not return standard non-streaming Responses JSON text, so the connection was not saved.",
          code,
        },
        { status: 502 },
      );
    }
    if (code === "OPENAI_RESPONSES_TOO_LARGE") {
      return json(
        {
          error: "The minimal Responses validation returned an unexpectedly large body, so the connection was not saved.",
          code,
        },
        { status: 502 },
      );
    }
    if (code === "OPENAI_LIVE_CHECK_FAILED") {
      return json(
        {
          error: "The live /responses inference failed. Check the proxy's upstream routing. The connection was not saved.",
          code,
        },
        { status: 502 },
      );
    }
    return json(
      { error: "The API connection could not be validated. Try again later.", code: "OPENAI_VALIDATION_FAILED" },
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
