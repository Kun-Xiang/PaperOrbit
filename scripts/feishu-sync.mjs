#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SUPPORTED_MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mark"]);
const LARK_CHILD_SECRET_KEYS = new Set([
  "FEISHU_FOLDER_TOKEN",
  "FEISHU_APP_ID",
  "FEISHU_APP_SECRET",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "PAPER_ORBIT_SESSION_SECRET",
  "SEMANTIC_SCHOLAR_API_KEY",
]);

/**
 * Run the feishu-sync CLI and return a process-style exit code.
 *
 * The CLI reads `.env` only for its own configuration lookup. Values loaded from
 * `.env` are intentionally not forwarded wholesale to the lark-cli child process.
 *
 * @param {string[]} argv command-line arguments without the node/script prefix
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream }} options test/runtime overrides
 * @returns {Promise<number>} exit code: 0 success, 1 sync failure, 2 usage/configuration error
 */
export async function main(argv = process.argv.slice(2), options = {}) {
  const io = {
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
  };

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    io.stderr.write(`${error.message}\n\n${usage()}`);
    return 2;
  }

  if (parsed.help) {
    io.stdout.write(usage());
    return 0;
  }

  if (parsed.files.length === 0) {
    io.stderr.write(`No Markdown files provided.\n\n${usage()}`);
    return 2;
  }

  const cwd = options.cwd ?? process.cwd();
  const dotEnv = await readDotEnv(path.join(cwd, ".env"));
  const configEnv = {
    ...process.env,
    ...dotEnv,
    ...(options.env ?? {}),
  };
  const childEnv = createLarkChildEnv(process.env, options.env ?? {});
  const folderToken = parsed.folderToken ?? configEnv.FEISHU_FOLDER_TOKEN?.trim();
  if (!folderToken) {
    io.stderr.write(
      "Missing FEISHU_FOLDER_TOKEN. Add it to .env or pass --folder-token <token>.\n",
    );
    return 2;
  }

  const results = [];
  for (const file of parsed.files) {
    results.push(
      await syncOneMarkdown({
        file,
        cwd,
        dryRun: parsed.dryRun,
        folderToken,
        larkCli: configEnv.FEISHU_SYNC_LARK_CLI || "lark-cli",
        env: childEnv,
      }),
    );
  }

  const successes = results.filter((result) => result.ok);
  const failures = results.filter((result) => !result.ok);
  io.stdout.write(
    `${JSON.stringify(
      {
        ok: failures.length === 0,
        dryRun: parsed.dryRun,
        summary: {
          total: results.length,
          succeeded: successes.length,
          failed: failures.length,
        },
        results,
      },
      null,
      2,
    )}\n`,
  );
  return failures.length === 0 ? 0 : 1;
}

/**
 * Parse feishu-sync command-line arguments.
 *
 * @param {string[]} argv command-line arguments without the node/script prefix
 * @returns {{ dryRun: boolean, folderToken: string | null, files: string[], help: boolean }} parsed options
 * @throws {Error} when an option is unknown or missing its required value
 */
export function parseArgs(argv) {
  const parsed = {
    dryRun: false,
    folderToken: null,
    files: [],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--folder-token") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--folder-token requires a value.");
      }
      parsed.folderToken = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    parsed.files.push(arg);
  }

  return parsed;
}

/**
 * Sync one Markdown file into a Feishu docx document using `lark-cli drive +import`.
 *
 * @param {{ file: string, cwd: string, dryRun: boolean, folderToken: string, larkCli: string, env?: NodeJS.ProcessEnv }} params import request
 * @returns {Promise<object>} normalized success or failure result for JSON CLI output
 */
export async function syncOneMarkdown({
  file,
  cwd,
  dryRun,
  folderToken,
  larkCli,
  env,
}) {
  let resolved;
  try {
    resolved = await resolveMarkdownFile(file, cwd);
  } catch (error) {
    return {
      ok: false,
      file,
      category: "input",
      message: error.message,
    };
  }

  const args = [
    "drive",
    "+import",
    "--as",
    "user",
    "--file",
    resolved.relativePath,
    "--type",
    "docx",
    "--folder-token",
    folderToken,
    "--name",
    titleFromMarkdownPath(resolved.relativePath),
    "--json",
  ];
  if (dryRun) args.push("--dry-run");

  const command = await runCommand(larkCli, args, {
    cwd,
    env: createLarkChildEnv(env),
  });
  const envelope = extractLastJsonObject(`${command.stdout}\n${command.stderr}`);

  if (command.code === 0 && envelope?.ok === true) {
    return {
      ok: true,
      file: resolved.relativePath,
      title: titleFromMarkdownPath(resolved.relativePath),
      dryRun,
      url: envelope.data?.url ?? null,
      token: envelope.data?.token ?? null,
      ticket: envelope.data?.ticket ?? envelope.data?.ticket_id ?? null,
      ready: envelope.data?.ready ?? null,
      rawStatus: envelope.data?.job_status_label ?? null,
    };
  }

  return {
    ok: false,
    file: resolved.relativePath,
    title: titleFromMarkdownPath(resolved.relativePath),
    category: classifyLarkFailure(command, envelope),
    message:
      envelope?.error?.message
      ?? envelope?.data?.job_error_msg
      ?? command.stderr.trim()
      ?? command.stdout.trim()
      ?? `lark-cli exited with code ${command.code}`,
    exitCode: command.code,
  };
}

function createLarkChildEnv(baseEnv = process.env, extraEnv = {}) {
  const childEnv = {
    ...baseEnv,
    ...extraEnv,
  };
  for (const key of LARK_CHILD_SECRET_KEYS) {
    delete childEnv[key];
  }
  childEnv.LARKSUITE_CLI_NO_UPDATE_NOTIFIER = "1";
  childEnv.LARKSUITE_CLI_NO_SKILLS_NOTIFIER = "1";
  return childEnv;
}

async function resolveMarkdownFile(file, cwd) {
  const absolutePath = path.resolve(cwd, file);
  const relativePath = path.relative(cwd, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`File must be inside the project directory: ${file}`);
  }

  const extension = path.extname(absolutePath).toLowerCase();
  if (!SUPPORTED_MARKDOWN_EXTENSIONS.has(extension)) {
    throw new Error(`Only Markdown files are supported: ${file}`);
  }

  let stats;
  try {
    stats = await stat(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`File not found: ${file}`);
    }
    throw error;
  }
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${file}`);
  }
  await access(absolutePath);

  return {
    absolutePath,
    relativePath: normalizeForCli(relativePath),
  };
}

function titleFromMarkdownPath(filePath) {
  const parsed = path.parse(filePath);
  return parsed.name.trim() || "PaperOrbit Export";
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
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function runCommand(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({
        code: 127,
        stdout,
        stderr: `${stderr}${error.message}`,
      });
    });
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Extract the last parseable JSON object from mixed stdout/stderr text.
 *
 * Progress output from lark-cli can appear before or after the final JSON
 * envelope, so this parser scans from the end and prefers objects shaped like a
 * lark-cli response.
 *
 * @param {string} text mixed process output
 * @returns {object | null} parsed JSON object, or null when no object is present
 */
export function extractLastJsonObject(text) {
  const starts = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{") starts.push(index);
  }
  let fallback = null;
  for (let index = starts.length - 1; index >= 0; index -= 1) {
    const end = findJsonObjectEnd(text, starts[index]);
    if (end === -1) continue;
    try {
      const value = JSON.parse(text.slice(starts[index], end));
      fallback ??= value;
      if (looksLikeLarkEnvelope(value)) return value;
    } catch {
      // Keep scanning for the outermost JSON envelope in mixed progress output.
    }
  }
  return fallback;
}

function findJsonObjectEnd(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
      if (depth < 0) return -1;
    }
  }

  return -1;
}

function looksLikeLarkEnvelope(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && (
      Object.hasOwn(value, "ok")
      || Object.hasOwn(value, "error")
    )
  );
}

function classifyLarkFailure(command, envelope) {
  const type = envelope?.error?.type;
  const subtype = envelope?.error?.subtype;
  if (type === "authorization" || subtype === "missing_scope") return "authorization";
  if (type === "confirmation") return "confirmation";
  if (command.code === 127) return "lark-cli";
  return "sync";
}

function normalizeForCli(filePath) {
  return filePath.split(path.sep).join("/");
}

function usage() {
  return `Usage: node scripts/feishu-sync.mjs [options] <file.md ...>

Options:
  --folder-token <token>  Override FEISHU_FOLDER_TOKEN from .env
  --dry-run               Ask lark-cli to print the import request without writing
  -h, --help              Show this help

Examples:
  node scripts/feishu-sync.mjs report.md
  node scripts/feishu-sync.mjs --dry-run report.md metds/survey/topic/survey.md
`;
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  process.exitCode = await main();
}
