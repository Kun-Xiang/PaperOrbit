import { paperOrbitApiAccessError } from "../../../access-control";
import {
  clearResearchSessionCookie,
  researchSessionAvailable,
  researchSessionCookie,
  sealResearchSession,
  semanticScholarCredential,
  sharedSemanticScholarCredential,
} from "../research-session";

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return Response.json(body, { ...init, headers });
}

function cleanApiKey(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 512) : "";
}

function connectionPayload(
  credential: Awaited<ReturnType<typeof semanticScholarCredential>>,
) {
  return {
    arxiv: {
      keyRequired: false,
      source: "public" as const,
    },
    semanticScholar: {
      keyConnected: Boolean(credential),
      sessionAvailable: researchSessionAvailable(),
      source: credential?.source ?? ("public" as const),
    },
  };
}

async function validateSemanticScholarKey(apiKey: string) {
  const endpoint = new URL(
    "https://api.semanticscholar.org/graph/v1/paper/ARXIV:1706.03762",
  );
  endpoint.searchParams.set("fields", "paperId");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "PaperOrbit/3.0 (personal research reading app)",
        "x-api-key": apiKey,
      },
      signal: controller.signal,
    });
    if (response.ok) return;
    if (response.status === 401 || response.status === 403) {
      throw new Error("SEMANTIC_SCHOLAR_KEY_INVALID");
    }
    if (response.status === 429) {
      throw new Error("SEMANTIC_SCHOLAR_QUOTA_UNAVAILABLE");
    }
    throw new Error("SEMANTIC_SCHOLAR_VALIDATION_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const accessError = await paperOrbitApiAccessError();
  if (accessError) return accessError;
  return json(connectionPayload(await semanticScholarCredential(request)));
}

export async function POST(request: Request) {
  const accessError = await paperOrbitApiAccessError();
  if (accessError) return accessError;
  if (!researchSessionAvailable()) {
    return json(
      {
        error: "PAPER_ORBIT_SESSION_SECRET is not configured, so a personal research-data session cannot be created yet.",
        code: "SESSION_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { apiKey?: unknown };
    const apiKey = cleanApiKey(body.apiKey);
    if (apiKey.length < 16) {
      return json(
        {
          error: "Enter a valid Semantic Scholar API key.",
          code: "SEMANTIC_SCHOLAR_KEY_INVALID",
        },
        { status: 400 },
      );
    }

    await validateSemanticScholarKey(apiKey);
    const sealedSession = await sealResearchSession(request, apiKey);
    return json(
      connectionPayload({ apiKey, source: "session" }),
      {
        headers: {
          "Set-Cookie": researchSessionCookie(request, sealedSession),
        },
      },
    );
  } catch (error) {
    const code = error instanceof Error
      ? error.message
      : "SEMANTIC_SCHOLAR_VALIDATION_FAILED";
    if (code === "SEMANTIC_SCHOLAR_KEY_INVALID") {
      return json(
        { error: "This Semantic Scholar API key is invalid or has been revoked.", code },
        { status: 401 },
      );
    }
    if (code === "SEMANTIC_SCHOLAR_QUOTA_UNAVAILABLE") {
      return json(
        { error: "The Semantic Scholar API is out of quota or rate-limiting requests.", code },
        { status: 429 },
      );
    }
    return json(
      {
        error: "The Semantic Scholar API key could not be validated. Try again later.",
        code: "SEMANTIC_SCHOLAR_VALIDATION_FAILED",
      },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const accessError = await paperOrbitApiAccessError();
  if (accessError) return accessError;
  return json(
    connectionPayload(sharedSemanticScholarCredential(request)),
    {
      headers: {
        "Set-Cookie": clearResearchSessionCookie(request),
      },
    },
  );
}
