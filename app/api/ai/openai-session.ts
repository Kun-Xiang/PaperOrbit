import { isPaperOrbitPrivilegedEmail } from "../../access-control";
import { isLocalDevelopmentRequest } from "../../local-development";
import {
  clearEncryptedSessionCookie,
  encryptedSessionCookie,
  encryptedSessionsAvailable,
  readEncryptedSession,
  requestSubject,
  sealEncryptedSession,
} from "../encrypted-session";
import {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  cleanOpenAIApiKey,
  cleanOpenAIModel,
  normalizeOpenAIBaseUrl,
} from "./provider-config";

const SESSION_COOKIE = "paper_orbit_openai_session";
const SESSION_SCOPE = "openai-session";
const SESSION_PATH = "/api/ai";

type StoredOpenAISession = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  validation: "responses";
};

export type OpenAICredential = {
  apiKey: string;
  baseUrl: string;
  model: string;
  source: "session" | "shared";
};

function isStoredOpenAISession(
  value: unknown,
  allowLocalLoopback: boolean,
): value is StoredOpenAISession {
  if (!value || typeof value !== "object") return false;
  const session = value as { apiKey?: unknown; baseUrl?: unknown; model?: unknown };
  if (!cleanOpenAIApiKey(session.apiKey)) return false;
  if ((value as { validation?: unknown }).validation !== "responses") return false;
  if (
    session.baseUrl !== undefined
    && !normalizeOpenAIBaseUrl(session.baseUrl, { allowLocalLoopback })
  ) return false;
  if (session.model !== undefined && !cleanOpenAIModel(session.model)) return false;
  return true;
}

export function openAISessionAvailable() {
  return encryptedSessionsAvailable();
}

export function openAIModel() {
  return cleanOpenAIModel(process.env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
}

export async function sealValidatedOpenAISession(
  request: Request,
  credential: Pick<OpenAICredential, "apiKey" | "baseUrl" | "model">,
) {
  const baseUrl = normalizeOpenAIBaseUrl(credential.baseUrl, {
    allowLocalLoopback: isLocalDevelopmentRequest(request),
  });
  if (!baseUrl) throw new Error("OPENAI_BASE_URL_INVALID");
  return sealEncryptedSession<StoredOpenAISession>(
    request,
    SESSION_SCOPE,
    { ...credential, baseUrl, validation: "responses" },
  );
}

export async function readOpenAISession(request: Request) {
  const allowLocalLoopback = isLocalDevelopmentRequest(request);
  const session = await readEncryptedSession(
    request,
    SESSION_COOKIE,
    SESSION_SCOPE,
    (value): value is StoredOpenAISession => isStoredOpenAISession(
      value,
      allowLocalLoopback,
    ),
  );
  if (!session) return null;
  return {
    apiKey: session.data.apiKey,
    baseUrl: normalizeOpenAIBaseUrl(session.data.baseUrl, {
      allowLocalLoopback,
    }) ?? DEFAULT_OPENAI_BASE_URL,
    model: cleanOpenAIModel(session.data.model) || openAIModel(),
    connectedAt: session.connectedAt,
    subject: session.subject,
  };
}

export function sharedOpenAICredential(
  request: Request,
): OpenAICredential | null {
  const localDevelopment = isLocalDevelopmentRequest(request);
  if (
    !localDevelopment
    && !isPaperOrbitPrivilegedEmail(requestSubject(request))
  ) {
    return null;
  }

  const sharedKey = cleanOpenAIApiKey(process.env.OPENAI_API_KEY);
  if (!sharedKey) return null;

  const configuredBaseUrl = process.env.OPENAI_BASE_URL?.trim() ?? "";
  const baseUrl = configuredBaseUrl
    ? normalizeOpenAIBaseUrl(configuredBaseUrl, {
        allowLocalLoopback: localDevelopment,
      })
    : DEFAULT_OPENAI_BASE_URL;
  // A configured-but-invalid OPENAI_BASE_URL disables the shared credential;
  // silently falling back would send the key to a different host than intended.
  if (!baseUrl) return null;

  return {
    apiKey: sharedKey,
    baseUrl,
    model: openAIModel(),
    source: "shared",
  };
}

export async function openAICredential(
  request: Request,
): Promise<OpenAICredential | null> {
  const session = await readOpenAISession(request);
  if (session) {
    return {
      apiKey: session.apiKey,
      baseUrl: session.baseUrl,
      model: session.model,
      source: "session",
    };
  }
  return sharedOpenAICredential(request);
}

export function openAISessionCookie(
  request: Request,
  sealedSession: string,
) {
  return encryptedSessionCookie(
    request,
    SESSION_COOKIE,
    SESSION_PATH,
    sealedSession,
  );
}

export function clearOpenAISessionCookie(request: Request) {
  return clearEncryptedSessionCookie(
    request,
    SESSION_COOKIE,
    SESSION_PATH,
  );
}
