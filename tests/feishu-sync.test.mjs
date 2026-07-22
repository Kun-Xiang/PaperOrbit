import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const scriptPath = new URL("../scripts/feishu-sync.mjs", import.meta.url);

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "paperorbit-feishu-sync-"));
  await writeFile(join(root, "good.md"), "# Good\n\nBody.\n");
  await writeFile(join(root, "bad.md"), "# Bad\n\nBody.\n");
  return root;
}

async function makeFakeLarkCli(root) {
  const logPath = join(root, "fake-lark.log");
  const fakePath = join(root, "fake-lark-cli.mjs");
  await writeFile(
    fakePath,
    `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
if (process.env.SHOULD_NOT_REACH_LARK_CLI) {
  console.error(JSON.stringify({ ok: false, error: { type: "leak", message: "dotenv-only value leaked to lark-cli" } }));
  process.exit(42);
}
appendFileSync(process.env.FAKE_LARK_LOG, JSON.stringify(args) + "\\n");
const file = args[args.indexOf("--file") + 1];
if (file.includes("bad")) {
  console.error(JSON.stringify({ ok: false, error: { type: "api", message: "synthetic failure" } }));
  process.exit(1);
}
console.log("Uploading media for import: " + file);
console.log(JSON.stringify({
  ok: true,
  identity: "user",
  dry_run: args.includes("--dry-run"),
  data: {
    ready: true,
    ticket: "ticket-" + file,
    token: "doc-token-" + file,
    type: "docx",
    url: "https://example.feishu.cn/docx/" + encodeURIComponent(file),
    job_status_label: "success"
  }
}));
console.error("post-import notifier after JSON");
`,
  );
  await chmod(fakePath, 0o755);
  return { fakePath, logPath };
}

function runCli(root, args, env = {}) {
  return new Promise((resolve) => {
    const childEnv = {
      ...process.env,
      ...env,
    };
    if (!Object.hasOwn(env, "FEISHU_FOLDER_TOKEN")) {
      delete childEnv.FEISHU_FOLDER_TOKEN;
    }
    if (!Object.hasOwn(env, "SHOULD_NOT_REACH_LARK_CLI")) {
      delete childEnv.SHOULD_NOT_REACH_LARK_CLI;
    }
    const child = spawn(process.execPath, [scriptPath.pathname, ...args], {
      cwd: root,
      env: childEnv,
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
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function parseStdoutJson(result) {
  return JSON.parse(result.stdout);
}

test("prints help without requiring configuration", async () => {
  const root = await makeWorkspace();
  const result = await runCli(root, ["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage: node scripts\/feishu-sync\.mjs/);
});

test("missing folder token exits before invoking lark-cli", async () => {
  const root = await makeWorkspace();
  const { fakePath, logPath } = await makeFakeLarkCli(root);
  const result = await runCli(root, ["good.md"], {
    FEISHU_SYNC_LARK_CLI: fakePath,
    FAKE_LARK_LOG: logPath,
  });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Missing FEISHU_FOLDER_TOKEN/);
  await assert.rejects(() => readFile(logPath, "utf8"), /ENOENT/);
});

test("dry-run imports one Markdown file through lark-cli user identity", async () => {
  const root = await makeWorkspace();
  const { fakePath, logPath } = await makeFakeLarkCli(root);
  await writeFile(join(root, ".env"), "FEISHU_FOLDER_TOKEN=folder-token\n");
  const result = await runCli(root, ["--dry-run", "good.md"], {
    FEISHU_SYNC_LARK_CLI: fakePath,
    FAKE_LARK_LOG: logPath,
  });
  assert.equal(result.code, 0, result.stderr);
  const body = parseStdoutJson(result);
  assert.equal(body.ok, true);
  assert.equal(body.dryRun, true);
  assert.equal(body.results[0].url, "https://example.feishu.cn/docx/good.md");

  const [args] = (await readFile(logPath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(args.slice(0, 4), ["drive", "+import", "--as", "user"]);
  assert.ok(args.includes("--dry-run"));
  assert.ok(args.includes("--folder-token"));
  assert.ok(args.includes("folder-token"));
  assert.ok(args.includes("--type"));
  assert.ok(args.includes("docx"));
});

test("does not pass dotenv-only values into the lark-cli child environment", async () => {
  const root = await makeWorkspace();
  const { fakePath, logPath } = await makeFakeLarkCli(root);
  await writeFile(
    join(root, ".env"),
    [
      "FEISHU_FOLDER_TOKEN=folder-token",
      "SHOULD_NOT_REACH_LARK_CLI=dotenv-only-secret",
      "",
    ].join("\n"),
  );
  const result = await runCli(root, ["good.md"], {
    FEISHU_SYNC_LARK_CLI: fakePath,
    FAKE_LARK_LOG: logPath,
  });
  assert.equal(result.code, 0, result.stderr);
  const body = parseStdoutJson(result);
  assert.equal(body.ok, true);

  const invocations = (await readFile(logPath, "utf8")).trim().split("\n");
  assert.equal(invocations.length, 1);
});

test("batch sync continues after a per-file lark-cli failure", async () => {
  const root = await makeWorkspace();
  const { fakePath, logPath } = await makeFakeLarkCli(root);
  await writeFile(join(root, ".env"), "FEISHU_FOLDER_TOKEN=folder-token\n");
  const result = await runCli(root, ["good.md", "bad.md"], {
    FEISHU_SYNC_LARK_CLI: fakePath,
    FAKE_LARK_LOG: logPath,
  });
  assert.equal(result.code, 1);
  const body = parseStdoutJson(result);
  assert.equal(body.ok, false);
  assert.equal(body.summary.total, 2);
  assert.equal(body.summary.succeeded, 1);
  assert.equal(body.summary.failed, 1);
  assert.equal(body.results[0].ok, true);
  assert.equal(body.results[1].ok, false);
  assert.equal(body.results[1].message, "synthetic failure");

  const invocations = (await readFile(logPath, "utf8")).trim().split("\n");
  assert.equal(invocations.length, 2);
});

test("rejects non-Markdown files without invoking lark-cli for that file", async () => {
  const root = await makeWorkspace();
  const { fakePath, logPath } = await makeFakeLarkCli(root);
  await writeFile(join(root, ".env"), "FEISHU_FOLDER_TOKEN=folder-token\n");
  await writeFile(join(root, "notes.txt"), "plain text");
  const result = await runCli(root, ["notes.txt"], {
    FEISHU_SYNC_LARK_CLI: fakePath,
    FAKE_LARK_LOG: logPath,
  });
  assert.equal(result.code, 1);
  const body = parseStdoutJson(result);
  assert.equal(body.results[0].category, "input");
  assert.match(body.results[0].message, /Only Markdown files/);
  await assert.rejects(() => readFile(logPath, "utf8"), /ENOENT/);
});
