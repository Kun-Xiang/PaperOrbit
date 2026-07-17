import { randomBytes } from "node:crypto";
import vinext from "vinext";
import { defineConfig, loadEnv, type Plugin } from "vite";
import hostingConfig from "./.openai/hosting.json";
import {
  LOCAL_REQUEST_HEADER,
  LOCAL_REQUEST_TOKEN_ENV,
} from "./app/local-development";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const LOCAL_RUNTIME_ENV_KEYS = [
  "PAPER_ORBIT_LOCAL_MODE",
  "PAPER_ORBIT_LOCAL_USER_EMAIL",
  "PAPER_ORBIT_LOCAL_USER_NAME",
  "PAPER_ORBIT_SESSION_SECRET",
  "OPENAI_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "SEMANTIC_SCHOLAR_API_KEY",
] as const;
const FORWARDED_INGRESS_HEADERS = [
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
] as const;

function isLoopbackRemoteAddress(value: string | undefined) {
  const address = value?.trim().toLowerCase() ?? "";
  return address === "127.0.0.1"
    || address === "::1"
    || address === "::ffff:127.0.0.1";
}

function isMatchingLoopbackHost(
  hostHeader: string | undefined,
  localPort: number | undefined,
) {
  if (!hostHeader || hostHeader.includes(",") || !localPort) return false;
  try {
    const url = new URL(`http://${hostHeader}`);
    const hostname = url.hostname.toLowerCase();
    const port = url.port ? Number(url.port) : 80;
    return (hostname === "127.0.0.1" || hostname === "localhost")
      && port === localPort
      && !url.username
      && !url.password
      && url.pathname === "/"
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

function localDevelopmentIngressPlugin(token: string): Plugin {
  return {
    name: "paper-orbit-local-ingress",
    apply: "serve",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        delete request.headers[LOCAL_REQUEST_HEADER];
        for (let index = request.rawHeaders.length - 2; index >= 0; index -= 2) {
          if (request.rawHeaders[index]?.toLowerCase() === LOCAL_REQUEST_HEADER) {
            request.rawHeaders.splice(index, 2);
          }
        }
        const socket = request.socket as typeof request.socket & {
          encrypted?: boolean;
        };
        if (
          isLoopbackRemoteAddress(socket.remoteAddress)
          && socket.encrypted !== true
          && isMatchingLoopbackHost(request.headers.host, socket.localPort)
          && !FORWARDED_INGRESS_HEADERS.some(
            (header) => request.headers[header] !== undefined,
          )
        ) {
          request.headers[LOCAL_REQUEST_HEADER] = token;
          request.rawHeaders.push(LOCAL_REQUEST_HEADER, token);
        }
        next();
      });
    },
  };
}

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async ({ command, mode }) => {
  const fileEnvironment = loadEnv(mode, process.cwd(), "");
  const developmentEnvironment = {
    ...fileEnvironment,
    ...process.env,
  };
  const localMode = developmentEnvironment.PAPER_ORBIT_LOCAL_MODE === "1";
  const localRequestToken = localMode && command === "serve"
    ? randomBytes(32).toString("hex")
    : null;
  const runtimeVariables: Record<string, string> = Object.fromEntries(
    LOCAL_RUNTIME_ENV_KEYS.flatMap((key) => {
      const value = developmentEnvironment[key]?.trim();
      return value ? [[key, value]] : [];
    }),
  );
  if (localRequestToken) {
    runtimeVariables[LOCAL_REQUEST_TOKEN_ENV] = localRequestToken;
  }

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
      ...(localMode
        ? { host: "127.0.0.1", port: 3000, strictPort: true }
        : {}),
    },
    plugins: [
      ...(localRequestToken
        ? [localDevelopmentIngressPlugin(localRequestToken)]
        : []),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: command === "serve"
          ? { ...localBindingConfig, vars: runtimeVariables }
          : localBindingConfig,
      }),
    ],
  };
});
