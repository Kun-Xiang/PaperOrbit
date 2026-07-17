const LOCAL_MODE_ENV = "PAPER_ORBIT_LOCAL_MODE";
export const LOCAL_REQUEST_TOKEN_ENV = "PAPER_ORBIT_LOCAL_REQUEST_TOKEN";
export const LOCAL_REQUEST_HEADER = "x-paper-orbit-local-request";
const DEFAULT_LOCAL_EMAIL = "local@paperorbit.dev";
const DEFAULT_LOCAL_NAME = "Local PaperOrbit User";

type HeaderReader = Pick<Headers, "get">;

export type LocalDevelopmentIdentity = {
  email: string;
  fullName: string;
};

function hostnameFromHostHeader(value: string | null) {
  const host = value?.trim() ?? "";
  if (!host) return "";

  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isLoopbackHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost";
}

function localModeEnabled() {
  return process.env[LOCAL_MODE_ENV]?.trim() === "1";
}

function hasTrustedLocalIngress(requestHeaders: HeaderReader) {
  const expected = process.env[LOCAL_REQUEST_TOKEN_ENV]?.trim() ?? "";
  const provided = requestHeaders.get(LOCAL_REQUEST_HEADER)?.trim() ?? "";
  return /^[a-f0-9]{64}$/i.test(expected) && provided === expected;
}

function localIdentity(): LocalDevelopmentIdentity {
  const configuredEmail = process.env.PAPER_ORBIT_LOCAL_USER_EMAIL
    ?.trim()
    .toLowerCase();
  const email = configuredEmail && /^[^\s@]+@[^\s@]+$/.test(configuredEmail)
    ? configuredEmail
    : DEFAULT_LOCAL_EMAIL;
  const fullName = process.env.PAPER_ORBIT_LOCAL_USER_NAME?.trim()
    || DEFAULT_LOCAL_NAME;

  return { email, fullName };
}

export function localDevelopmentIdentityFromHeaders(
  requestHeaders: HeaderReader,
): LocalDevelopmentIdentity | null {
  if (!localModeEnabled() || !hasTrustedLocalIngress(requestHeaders)) {
    return null;
  }

  const hostname = hostnameFromHostHeader(requestHeaders.get("host"));
  if (!isLoopbackHostname(hostname)) return null;

  return localIdentity();
}

export function isLocalDevelopmentRequest(request: Request) {
  if (!localModeEnabled() || !hasTrustedLocalIngress(request.headers)) {
    return false;
  }

  try {
    const url = new URL(request.url);
    if (url.protocol !== "http:" || !isLoopbackHostname(url.hostname)) {
      return false;
    }

    const requestHost = request.headers.get("host");
    return Boolean(requestHost)
      && isLoopbackHostname(hostnameFromHostHeader(requestHost));
  } catch {
    return false;
  }
}

export function localDevelopmentIdentityFromRequest(
  request: Request,
): LocalDevelopmentIdentity | null {
  return isLocalDevelopmentRequest(request) ? localIdentity() : null;
}
