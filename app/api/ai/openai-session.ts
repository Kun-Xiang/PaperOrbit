import { isPaperOrbitPrivilegedEmail } from "../../access-control";
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
};

export type OpenAICredential = {
  apiKey: string;
  baseUrl: string;
  model: string;
  source: "session" | "shared";
};

function isStoredOpenAISession(value: unknown): value is StoredOpenAISession {
  if (!value || typeof value !== "object") return false;
  const session = value as { apiKey?: unknown; baseUrl?: unknown; model?: unknown };
  if (!cleanOpenAIApiKey(session.apiKey)) return false;
  if (session.baseUrl !== undefined && !normalizeOpenAIBaseUrl(session.baseUrl)) return false;
  if (session.model !== undefined && !cleanOpenAIModel(session.model)) return false;
  return true;
}

export function openAISessionAvailable() {
  return encryptedSessionsAvailable();
}

export function openAIModel() {
  return cleanOpenAIModel(process.env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
}

export async function sealOpenAISession(
  request: Request,
  credential: Pick<OpenAICredential, "apiKey" | "baseUrl" | "model">,
) {
  return sealEncryptedSession<StoredOpenAISession>(
    request,
    SESSION_SCOPE,
    credential,
  );
}

export async function readOpenAISession(request: Request) {
  const session = await readEncryptedSession(
    request,
    SESSION_COOKIE,
    SESSION_SCOPE,
    isStoredOpenAISession,
  );
  if (!session) return null;
  return {
    apiKey: session.data.apiKey,
    baseUrl: normalizeOpenAIBaseUrl(session.data.baseUrl) ?? DEFAULT_OPENAI_BASE_URL,
    model: cleanOpenAIModel(session.data.model) || openAIModel(),
    connectedAt: session.connectedAt,
    subject: session.subject,
  };
}

export function sharedOpenAICredential(
  request: Request,
): OpenAICredential | null {
  if (!isPaperOrbitPrivilegedEmail(requestSubject(request))) return null;
  const sharedKey = process.env.OPENAI_API_KEY?.trim();
  return sharedKey
    ? {
        apiKey: sharedKey,
        baseUrl: DEFAULT_OPENAI_BASE_URL,
        model: openAIModel(),
        source: "shared",
      }
    : null;
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
