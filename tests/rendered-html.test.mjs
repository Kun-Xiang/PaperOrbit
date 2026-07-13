import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Paper Orbit product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Paper Orbit — 每日论文阅读与 AI 研究助手<\/title>/i);
  assert.match(html, /Paper Orbit/);
  assert.match(html, /今天值得读的/);
  assert.match(html, />10<\/em> 篇/);
  assert.match(html, /Paper Copilot/);
  assert.match(html, /搜索 arXiv/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/i);
});

test("ships ten fallback papers and the multi-signal recommendation pipeline", async () => {
  const [page, route, recommendation, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/recommendation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const DAILY_PAPER_COUNT = 10/);
  assert.equal((page.match(/id: "2607\./g) ?? []).length, 10);
  assert.match(page, /paper-orbit:affinity-v2/);
  assert.match(route, /max_results", mode === "feed" \? "60"/);
  assert.match(route, /api\.semanticscholar\.org\/graph\/v1\/paper\/batch/);
  assert.match(route, /dailyLimit: 10/);
  assert.match(recommendation, /relevance \* 0\.42/);
  assert.match(recommendation, /overlap \* 0\.16/);
  assert.match(layout, /Paper Orbit/);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview/);
});
