import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.PAPER_ORBIT_SESSION_SECRET =
  "paper-orbit-test-session-secret-with-more-than-32-characters";
process.env.OPENAI_MODEL = "gpt-5.6";
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_BASE_URL;
delete process.env.SEMANTIC_SCHOLAR_API_KEY;
delete process.env.PAPER_ORBIT_LOCAL_MODE;
delete process.env.PAPER_ORBIT_LOCAL_REQUEST_TOKEN;
delete process.env.PAPER_ORBIT_LOCAL_USER_EMAIL;
delete process.env.PAPER_ORBIT_LOCAL_USER_NAME;

async function request(
  path = "/",
  email = "xiangk123@gmail.com",
  init = {},
  origin = "https://paper-orbit.test",
) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(
    "test",
    `${process.pid}-${Date.now()}-${path}-${email ?? "anonymous"}`,
  );
  const { default: worker } = await import(workerUrl.href);

  const requestHeaders = new Headers(init.headers);
  if (!requestHeaders.has("accept")) requestHeaders.set("accept", "text/html");
  if (email) requestHeaders.set("oai-authenticated-user-email", email);
  const originUrl = new URL(origin);
  if (!requestHeaders.has("host")) requestHeaders.set("host", originUrl.host);
  if (!requestHeaders.has("x-forwarded-proto")) {
    requestHeaders.set("x-forwarded-proto", originUrl.protocol.slice(0, -1));
  }

  return worker.fetch(
    new Request(`${origin}${path}`, {
      ...init,
      headers: requestHeaders,
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

async function withMockedFetch(mock, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function requestPayload(init = {}) {
  return typeof init.body === "string" ? JSON.parse(init.body) : null;
}

function isConnectionProbe(init = {}) {
  const payload = requestPayload(init);
  return JSON.stringify(payload?.input ?? "").includes("PAPER_ORBIT_OK");
}

function isRuntimeDiagnosticProbe(init = {}) {
  const payload = requestPayload(init);
  return JSON.stringify(payload?.input ?? "").includes("PAPER_ORBIT_DIAGNOSTIC_OK");
}

function arxivPdfHeadResponse(bytes = 11_000_071) {
  return new Response(null, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-length": String(bytes),
    },
  });
}

function arxivPdfRangeResponse(
  bytes = 11_000_071,
  signature = "%PDF-1.7",
  headers = {},
) {
  return new Response(signature, {
    status: 206,
    headers: {
      "content-type": "application/pdf",
      "content-length": "8",
      "content-range": `bytes 0-7/${bytes}`,
      ...headers,
    },
  });
}

function declaredOversizedJsonResponse(bytes, onCancel) {
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode('{"data":['));
    },
    cancel() {
      onCancel();
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "application/json",
      "content-length": String(bytes),
    },
  });
}

function atomFeed(entries, { total = entries.length, start = 0, limit = entries.length } = {}) {
  const body = entries.map((entry, index) => {
    const id = entry.id ?? `2607.${String(index + 1).padStart(5, "0")}`;
    return `
      <entry>
        <id>https://arxiv.org/abs/${id}</id>
        <updated>${entry.updated ?? "2026-07-15T00:00:00Z"}</updated>
        <published>${entry.published ?? "2026-07-14T00:00:00Z"}</published>
        <title>${entry.title ?? `Paper ${index + 1}`}</title>
        <summary>${entry.summary ?? "Robot learning with multimodal reasoning and extensive experiments."}</summary>
        <author><name>${entry.author ?? "Researcher"}</name></author>
        <category term="${entry.category ?? "cs.RO"}" />
      </entry>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
      <opensearch:totalResults>${total}</opensearch:totalResults>
      <opensearch:startIndex>${start}</opensearch:startIndex>
      <opensearch:itemsPerPage>${limit}</opensearch:itemsPerPage>
      ${body}
    </feed>`;
}

test("server-renders the Paper Orbit product shell", async () => {
  const response = await request();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="en"/i);
  assert.match(html, /<title>Paper Orbit — Daily Paper Reading and AI Research Copilot<\/title>/i);
  assert.match(html, /Paper Orbit/);
  assert.match(html, /<em>10<\/em> papers worth reading today/i);
  assert.match(html, /Paper Copilot/);
  assert.match(html, /Search arXiv/);
  assert.doesNotMatch(html, /[\u3400-\u9fff]/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/i);
});

test("allows every signed-in ChatGPT account while preserving privileged roles", async () => {
  const managerResponse = await request("/", "xumiaojun49@gmail.com");
  assert.equal(managerResponse.status, 200);
  const managerHtml = await managerResponse.text();
  assert.match(managerHtml, /Miaojun Xu/);
  assert.match(managerHtml, /MANAGER/);
  assert.match(managerHtml, /Paper Copilot/);

  const outsiderResponse = await request("/", "outsider@example.com");
  assert.equal(outsiderResponse.status, 200);
  const outsiderHtml = await outsiderResponse.text();
  assert.match(outsiderHtml, /outsider@example\.com/);
  assert.match(outsiderHtml, /READER/);
  assert.match(outsiderHtml, /Paper Copilot/);
  assert.doesNotMatch(outsiderHtml, /not authorized for Paper Orbit/i);

  const anonymousApi = await request("/api/arxiv?mode=feed", null);
  assert.equal(anonymousApi.status, 401);

  const missingQuery = await request("/api/arxiv", "outsider@example.com");
  assert.equal(missingQuery.status, 400);
  assert.equal(missingQuery.headers.get("cache-control"), "private, no-store");
});

test("rejects forged local-development identity headers", async () => {
  const previousEnv = {
    PAPER_ORBIT_LOCAL_MODE: process.env.PAPER_ORBIT_LOCAL_MODE,
    PAPER_ORBIT_LOCAL_REQUEST_TOKEN:
      process.env.PAPER_ORBIT_LOCAL_REQUEST_TOKEN,
    PAPER_ORBIT_LOCAL_USER_EMAIL: process.env.PAPER_ORBIT_LOCAL_USER_EMAIL,
    PAPER_ORBIT_LOCAL_USER_NAME: process.env.PAPER_ORBIT_LOCAL_USER_NAME,
  };
  const trustedToken = "c".repeat(64);
  process.env.PAPER_ORBIT_LOCAL_MODE = "1";
  process.env.PAPER_ORBIT_LOCAL_REQUEST_TOKEN = trustedToken;
  process.env.PAPER_ORBIT_LOCAL_USER_EMAIL = "local-test@paperorbit.dev";
  process.env.PAPER_ORBIT_LOCAL_USER_NAME = "Local Test";

  try {
    const missingMarker = await request(
      "/api/ai/session",
      null,
      {},
      "http://127.0.0.1:3000",
    );
    assert.equal(missingMarker.status, 401);

    const forgedMarker = await request(
      "/api/ai/session",
      null,
      {
        headers: {
          "x-paper-orbit-local-request": "d".repeat(64),
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http",
        },
      },
      "http://127.0.0.1:3000",
    );
    assert.equal(forgedMarker.status, 401);

    const publicHostWithForwardedLoopback = await request(
      "/api/ai/session",
      null,
      {
        headers: {
          "x-paper-orbit-local-request": trustedToken,
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http",
        },
      },
      "https://paper-orbit.test",
    );
    assert.equal(publicHostWithForwardedLoopback.status, 401);

    const loopbackUrlWithPublicHost = await request(
      "/api/ai/session",
      null,
      {
        headers: {
          host: "paper-orbit.test",
          "x-paper-orbit-local-request": trustedToken,
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http",
        },
      },
      "http://127.0.0.1:3000",
    );
    assert.equal(loopbackUrlWithPublicHost.status, 401);

    const trustedLoopback = await request(
      "/api/ai/session",
      null,
      { headers: { "x-paper-orbit-local-request": trustedToken } },
      "http://127.0.0.1:3000",
    );
    assert.equal(trustedLoopback.status, 200);
    assert.equal((await trustedLoopback.json()).connected, false);
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("keeps shared provider credentials exclusive to owner and manager accounts", async () => {
  process.env.OPENAI_API_KEY = "sk-test-shared-owner-key-not-for-readers";
  process.env.SEMANTIC_SCHOLAR_API_KEY =
    "semantic-scholar-test-shared-owner-key";

  try {
    const readerAiResponse = await request(
      "/api/ai/session",
      "reader@example.com",
    );
    assert.equal(readerAiResponse.status, 200);
    const readerAi = await readerAiResponse.json();
    assert.equal(readerAi.connected, false);
    assert.equal(readerAi.source, null);

    const ownerAiResponse = await request(
      "/api/ai/session",
      "xiangk123@gmail.com",
    );
    assert.equal(ownerAiResponse.status, 200);
    const ownerAi = await ownerAiResponse.json();
    assert.equal(ownerAi.connected, true);
    assert.equal(ownerAi.source, "shared");

    const readerResearchResponse = await request(
      "/api/arxiv/session",
      "reader@example.com",
    );
    assert.equal(readerResearchResponse.status, 200);
    const readerResearch = await readerResearchResponse.json();
    assert.deepEqual(readerResearch.arxiv, {
      keyRequired: false,
      source: "public",
    });
    assert.equal(readerResearch.semanticScholar.keyConnected, false);
    assert.equal(readerResearch.semanticScholar.source, "public");

    const managerResearchResponse = await request(
      "/api/arxiv/session",
      "xumiaojun49@gmail.com",
    );
    assert.equal(managerResearchResponse.status, 200);
    const managerResearch = await managerResearchResponse.json();
    assert.equal(managerResearch.semanticScholar.keyConnected, true);
    assert.equal(managerResearch.semanticScholar.source, "shared");
  } finally {
    delete process.env.OPENAI_API_KEY;
    delete process.env.SEMANTIC_SCHOLAR_API_KEY;
  }
});

test("advanced arXiv search forwards safe structure and returns Atom pagination metadata", async () => {
  let upstreamUrl = null;
  await withMockedFetch(async (input) => {
    upstreamUrl = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    return new Response(atomFeed([
      { id: "2607.00002", title: "Second upstream result" },
      { id: "2607.00001", title: "First upstream result" },
    ], { total: 43, start: 20, limit: 2 }), {
      headers: { "content-type": "application/atom+xml" },
    });
  }, async () => {
    const response = await request(
      "/api/arxiv?q=world+model&field=title&match=phrase&exclude=survey&category=cs.RO&fromYear=2025&toYear=2026&start=20&limit=2",
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const data = await response.json();
    assert.deepEqual(data.papers.map((paper) => paper.id), [
      "2607.00002",
      "2607.00001",
    ]);
    assert.deepEqual(data.meta, {
      mode: "search",
      totalResults: 43,
      start: 20,
      limit: 2,
      itemsPerPage: 2,
      hasPrevious: true,
      hasNext: true,
      sort: "relevance",
      order: "descending",
      field: "title",
      match: "phrase",
    });
  });
  assert.equal(upstreamUrl.origin, "https://export.arxiv.org");
  assert.equal(upstreamUrl.searchParams.get("sortBy"), "relevance");
  assert.equal(upstreamUrl.searchParams.get("start"), "20");
  assert.equal(upstreamUrl.searchParams.get("max_results"), "2");
  assert.match(upstreamUrl.searchParams.get("search_query"), /ti:"world model"/);
  assert.match(upstreamUrl.searchParams.get("search_query"), /ANDNOT/);
  assert.match(upstreamUrl.searchParams.get("search_query"), /cat:cs\.RO/);
});

test("feed returns a generic public candidate pool without consuming personal query data", async () => {
  const calls = [];
  const entries = Array.from({ length: 12 }, (_, index) => ({
    id: `2607.${String(index + 1).padStart(5, "0")}`,
    title: `Generic robot candidate ${index + 1}`,
    category: index % 2 ? "cs.CV" : "cs.RO",
  }));
  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    calls.push({ url, init });
    if (url.hostname === "export.arxiv.org") {
      return new Response(atomFeed(entries, { total: 12, limit: 60 }));
    }
    if (url.hostname === "api.semanticscholar.org") {
      const ids = JSON.parse(init.body).ids;
      return Response.json(ids.map((id, index) => ({
        externalIds: { ArXiv: id.replace(/^ARXIV:/, "") },
        citationCount: index + 1,
        influentialCitationCount: index % 3,
      })));
    }
    throw new Error(`Unexpected upstream: ${url}`);
  }, async () => {
    const response = await request(
      "/api/arxiv?mode=feed&interests=PRIVATE_TOPIC&profile=PRIVATE_SIGNAL&feedback=PRIVATE_FEEDBACK",
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const data = await response.json();
    assert.equal(data.papers.length, 12);
    assert.equal(new Set(data.papers.map((paper) => paper.id)).size, 12);
    assert.equal(data.source, "arxiv+semantic-scholar");
    assert.deepEqual(data.meta, {
      mode: "feed",
      rankingVersion: "orbit-v3-local",
      candidateCount: 12,
      dailyLimit: 10,
      metadataCredential: "public",
      personalization: "client",
      signals: [
        "interest",
        "local-affinity",
        "explicit-feedback",
        "freshness",
        "influence",
        "evidence",
        "diversity",
      ],
    });
  });
  assert.equal(calls.filter((call) => call.url.hostname === "export.arxiv.org").length, 1);
  assert.equal(calls.filter((call) => call.url.hostname === "api.semanticscholar.org").length, 1);
  const semanticCall = calls.find(
    (call) => call.url.hostname === "api.semanticscholar.org",
  );
  assert.equal(new Headers(semanticCall.init.headers).get("x-api-key"), null);
  const arxivUrl = calls.find((call) => call.url.hostname === "export.arxiv.org").url;
  assert.equal(arxivUrl.searchParams.get("max_results"), "60");
  assert.equal(arxivUrl.searchParams.get("sortBy"), "submittedDate");
  assert.doesNotMatch(arxivUrl.href, /PRIVATE_TOPIC|PRIVATE_SIGNAL|PRIVATE_FEEDBACK/);
});

test("defaults Copilot reports and chats to English without copying the abstract", async () => {
  const abstract =
    "We introduce a deliberately distinctive sequence of source words that should never be copied into the generated reading report. Our framework combines visual observations with actions and predicts future latent states under several training objectives. Extensive experiments compare the method with strong baselines across multiple settings.";
  const paper = {
    id: "2607.00001",
    title: "A Test Paper for Language Quality",
    authors: ["Researcher One"],
    summary: abstract,
    category: "cs.RO",
    tags: ["Physical AI", "VLA", "World Models"],
  };

  const reportResponse = await request("/api/ai", "xumiaojun49@gmail.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      paper,
      action: "report",
      prompt: "Write a structured reading report without reproducing the abstract.",
    }),
  });
  assert.equal(reportResponse.status, 200);
  const report = await reportResponse.json();
  assert.equal(report.mode, "preview");
  assert.equal(report.source, "abstract-preview");
  assert.match(report.answer, /summary-assisted mode/i);
  assert.doesNotMatch(report.answer, /[\u3400-\u9fff]/);
  assert.doesNotMatch(report.answer, /deliberately distinctive sequence/i);

  const chatResponse = await request("/api/ai", "xiangk123@gmail.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      paper,
      action: "chat",
      prompt: "What is the core mechanism?",
    }),
  });
  assert.equal(chatResponse.status, 200);
  const chat = await chatResponse.json();
  assert.equal(chat.mode, "preview");
  assert.doesNotMatch(chat.answer, /[\u3400-\u9fff]/);
  assert.doesNotMatch(chat.answer, /deliberately distinctive sequence/i);
});

test("matches a Simplified Chinese request with a Simplified Chinese preview", async () => {
  const response = await request("/api/ai", "reader@example.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      paper: {
        id: "2607.00001",
        title: "Language Matching Test Paper",
        summary: "A short abstract about a representation-learning mechanism.",
        category: "cs.RO",
        tags: ["Physical AI"],
      },
      action: "chat",
      prompt: "请用简体中文解释核心机制，不要复述摘要。",
    }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.mode, "preview");
  assert.match(result.answer, /可以把机制拆成/);
  assert.match(result.answer, /[\u3400-\u9fff]{10}/);
});

test("connects a private OpenAI session and sends only the validated arXiv PDF", async () => {
  const apiKey = "sk-test-paper-orbit-private-session-key";
  const readerEmail = "reader@example.com";
  const upstreamCalls = [];

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    upstreamCalls.push({ url, init });
    if (url === "https://arxiv.org/pdf/2607.00001") {
      if (init.method === "HEAD") return arxivPdfHeadResponse();
      assert.equal(init.method, "GET");
      return arxivPdfRangeResponse();
    }
    if (url === "https://api.openai.com/v1/models") {
      assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${apiKey}`);
      return Response.json({ data: [{ id: "gpt-5.6" }] });
    }
    if (url === "https://api.openai.com/v1/responses") {
      assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${apiKey}`);
      if (isConnectionProbe(init)) {
        const payload = requestPayload(init);
        assert.equal(payload.model, "gpt-5.6");
        assert.equal(payload.stream, false);
        assert.equal(payload.store, false);
        assert.equal(payload.max_output_tokens, 16);
        return Response.json({
          output_text: "PAPER_ORBIT_OK",
          usage: { input_tokens: 9, output_tokens: 5, total_tokens: 14 },
        });
      }
      return Response.json({
        output_text:
          "The paper's core mechanism has three stages: it encodes observations, learns a dynamic representation with a joint objective, and produces actions at inference time. The method and experiment sections provide the evidence needed to verify this full-PDF response path.",
        usage: {
          input_tokens: 1234,
          output_tokens: 87,
          total_tokens: 1321,
        },
      });
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    assert.equal(connectResponse.status, 200);
    const connect = await connectResponse.json();
    assert.equal(connect.connected, true);
    assert.equal(connect.source, "session");
    assert.equal(connect.model, "gpt-5.6");
    assert.doesNotMatch(JSON.stringify(connect), /sk-test/);

    const setCookie = connectResponse.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /^paper_orbit_openai_session=v1\./);
    assert.match(setCookie, /Path=\/api\/ai/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Secure/);
    assert.doesNotMatch(setCookie, /Max-Age=/);
    assert.doesNotMatch(setCookie, /sk-test/);
    const cookie = setCookie.split(";")[0];

    const statusResponse = await request("/api/ai/session", readerEmail, {
      headers: { cookie },
    });
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.deepEqual(status, {
      connected: true,
      source: "session",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.6",
      sessionAvailable: true,
    });
    assert.doesNotMatch(JSON.stringify(status), /sk-test/);

    const otherAccountResponse = await request(
      "/api/ai/session",
      "xumiaojun49@gmail.com",
      { headers: { cookie } },
    );
    assert.equal(otherAccountResponse.status, 200);
    const otherAccountStatus = await otherAccountResponse.json();
    assert.equal(otherAccountStatus.connected, false);
    assert.equal(otherAccountStatus.source, null);

    const paper = {
      id: "2607.00001",
      title: "A Full Text Test Paper",
      authors: ["Researcher One"],
      summary: "A short abstract used only as supplemental metadata.",
      zhSummary: "LEGACY_SUMMARY_MUST_NOT_REACH_PROVIDER",
      category: "cs.RO",
      tags: ["Physical AI"],
    };
    const aiResponse = await request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper,
        action: "chat",
        prompt: "Explain the core mechanism shown in the figures.",
        history: [{ role: "user", text: "First summarize the research question." }],
      }),
    });
    assert.equal(aiResponse.status, 200);
    const answer = await aiResponse.json();
    assert.equal(answer.mode, "openai");
    assert.equal(answer.source, "fulltext-pdf");
    assert.equal(answer.credentialSource, "session");
    assert.equal(answer.pdfDetail, "high");
    assert.deepEqual(answer.usage, {
      inputTokens: 1234,
      outputTokens: 87,
      totalTokens: 1321,
    });

    const responsesCall = upstreamCalls.find((call) => {
      if (call.url !== "https://api.openai.com/v1/responses") return false;
      const payload = requestPayload(call.init);
      return payload?.input?.[0]?.content?.[0]?.type === "input_file";
    });
    assert.ok(responsesCall);
    const payload = JSON.parse(responsesCall.init.body);
    assert.equal(payload.model, "gpt-5.6");
    assert.equal(payload.stream, false);
    assert.equal(payload.store, false);
    assert.equal(payload.input[0].content[0].type, "input_file");
    assert.equal(
      payload.input[0].content[0].file_url,
      "https://arxiv.org/pdf/2607.00001",
    );
    assert.equal(payload.input[0].content[0].detail, "high");
    assert.equal(payload.input[0].content[1].type, "input_text");
    assert.match(payload.input[0].content[1].text, /First summarize the research question/);
    assert.match(payload.instructions, /Write the entire response in natural English/);
    assert.doesNotMatch(payload.instructions, /[\u3400-\u9fff]/);
    assert.doesNotMatch(
      JSON.stringify(payload),
      /zhSummary|chineseSummary|LEGACY_SUMMARY_MUST_NOT_REACH_PROVIDER/,
    );

    const invalidResponse = await request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper: { ...paper, id: "https://evil.example/private.pdf" },
        action: "chat",
        prompt: "Read this file",
      }),
    });
    assert.equal(invalidResponse.status, 400);
    const invalid = await invalidResponse.json();
    assert.equal(invalid.code, "ARXIV_ID_REQUIRED");

    const disconnectResponse = await request("/api/ai/session", readerEmail, {
      method: "DELETE",
      headers: { cookie },
    });
    assert.equal(disconnectResponse.status, 200);
    assert.match(disconnectResponse.headers.get("set-cookie") ?? "", /Max-Age=0/);
  });
});

test("uses a reader-owned OpenAI-compatible Base URL, short key, and custom model", async () => {
  const apiKey = "alt-key";
  const readerEmail = "compatible-reader@example.com";
  const submittedBaseUrl = "https://gateway.paperorbit.ai/openai/v1/";
  const baseUrl = "https://gateway.paperorbit.ai/openai/v1";
  const model = "vendor/research-model@2026";
  const upstreamCalls = [];

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    upstreamCalls.push({ url, init });
    if (url === "https://arxiv.org/pdf/2607.00002") {
      if (init.method === "HEAD") return arxivPdfHeadResponse(2_500_000);
      assert.equal(init.method, "GET");
      return arxivPdfRangeResponse(2_500_000);
    }
    assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${apiKey}`);
    assert.equal(init.redirect, "manual");

    if (url === `${baseUrl}/models`) {
      return Response.json({ data: [{ id: model, object: "model" }] });
    }
    if (url === `${baseUrl}/responses`) {
      if (isConnectionProbe(init)) {
        const payload = requestPayload(init);
        assert.equal(payload.model, model);
        assert.equal(payload.stream, false);
        assert.equal(payload.store, false);
        assert.equal(payload.max_output_tokens, 16);
        return Response.json({ output_text: "PAPER_ORBIT_OK" });
      }
      const payload = requestPayload(init);
      assert.equal(payload.stream, true);
      const outputText =
        "The paper first defines its research question, then extracts state with a core representation module, constrains the dynamics through its training objective, and validates the main components experimentally. This compatible-provider response verifies that the endpoint, model, and full-text input remain isolated to the personal session.";
      return new Response(
        `event: response.completed\ndata: ${JSON.stringify({
          type: "response.completed",
          response: {
            output_text: outputText,
            usage: {
              input_tokens: 321,
              output_tokens: 54,
              total_tokens: 375,
            },
          },
        })}\n\n`,
        {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "x-request-id": "custom-fulltext-request",
          },
        },
      );
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl: submittedBaseUrl, model }),
    });
    assert.equal(connectResponse.status, 200);
    const connect = await connectResponse.json();
    assert.deepEqual(connect, {
      connected: true,
      source: "session",
      baseUrl,
      model,
      sessionAvailable: true,
    });
    assert.doesNotMatch(JSON.stringify(connect), /alt-key/);

    const setCookie = connectResponse.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /^paper_orbit_openai_session=v1\./);
    assert.ok(setCookie.length < 4096);
    assert.doesNotMatch(setCookie, /alt-key|gateway\.paperorbit|research-model/);
    const cookie = setCookie.split(";")[0];

    const statusResponse = await request("/api/ai/session", readerEmail, {
      headers: { cookie },
    });
    assert.equal(statusResponse.status, 200);
    assert.deepEqual(await statusResponse.json(), {
      connected: true,
      source: "session",
      baseUrl,
      model,
      sessionAvailable: true,
    });

    const aiResponse = await request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper: {
          id: "2607.00002",
          title: "Compatible Provider Test Paper",
          authors: ["Researcher Two"],
          summary: "A short metadata summary.",
          category: "cs.AI",
          tags: ["Reasoning"],
        },
        action: "chat",
        prompt: "Explain this paper's core mechanism.",
      }),
    });
    assert.equal(aiResponse.status, 200);
    const answer = await aiResponse.json();
    assert.equal(answer.mode, "openai");
    assert.equal(answer.provider, "compatible");
    assert.equal(answer.model, model);
    assert.equal(answer.credentialSource, "session");

    const responsesCall = upstreamCalls.find((call) => {
      if (call.url !== `${baseUrl}/responses`) return false;
      const payload = requestPayload(call.init);
      return payload?.input?.[0]?.content?.[0]?.type === "input_file";
    });
    assert.ok(responsesCall);
    const payload = JSON.parse(responsesCall.init.body);
    assert.equal(payload.model, model);
    assert.equal(payload.stream, true);
    assert.equal(payload.input[0].content[0].type, "input_file");
    assert.equal(
      payload.input[0].content[0].file_url,
      "https://arxiv.org/pdf/2607.00002",
    );
  });
});

test("attributes an arXiv PDF failure before sending any full-text model request", async () => {
  const apiKey = "arxiv-diagnostic-key";
  const readerEmail = "arxiv-diagnostic@example.com";
  let fulltextCalls = 0;

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === "https://api.openai.com/v1/models") {
      return Response.json({ data: [{ id: "gpt-5.6" }] });
    }
    if (url === "https://api.openai.com/v1/responses") {
      if (isConnectionProbe(init)) {
        return Response.json({ output_text: "PAPER_ORBIT_OK" });
      }
      fulltextCalls += 1;
      return Response.json({ output_text: "This must not be called." });
    }
    if (url === "https://arxiv.org/pdf/2607.01001") {
      return Response.json({ error: "maintenance" }, { status: 503 });
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    assert.equal(connectResponse.status, 200);
    const cookie = (connectResponse.headers.get("set-cookie") ?? "").split(";")[0];

    const aiResponse = await request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper: {
          id: "2607.01001",
          title: "Unavailable arXiv PDF",
          summary: "Metadata remains available.",
        },
        prompt: "Read the full paper.",
      }),
    });
    assert.equal(aiResponse.status, 502);
    assert.equal(aiResponse.headers.get("cache-control"), "no-store");
    const result = await aiResponse.json();
    assert.equal(result.code, "ARXIV_PDF_UNAVAILABLE");
    assert.equal(result.diagnostic.category, "arxiv");
    assert.equal(result.diagnostic.stage, "arxiv-pdf");
    assert.equal(result.diagnostic.arxiv.available, false);
    assert.equal(result.diagnostic.arxiv.status, 503);
    assert.match(
      aiResponse.headers.get("x-paper-orbit-diagnostic-id") ?? "",
      /^po-[a-f0-9]{16}$/,
    );
  });

  assert.equal(fulltextCalls, 0);
});

test("rejects arXiv content whose signature or complete size cannot be verified", async () => {
  const apiKey = "arxiv-verification-key";
  const readerEmail = "arxiv-verification@example.com";
  let fulltextCalls = 0;

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === "https://api.openai.com/v1/models") {
      return Response.json({ data: [{ id: "gpt-5.6" }] });
    }
    if (url === "https://api.openai.com/v1/responses") {
      if (isConnectionProbe(init)) {
        return Response.json({ output_text: "PAPER_ORBIT_OK" });
      }
      fulltextCalls += 1;
      return Response.json({ output_text: "This must not be called." });
    }
    if (url === "https://arxiv.org/pdf/2607.02001") {
      return init.method === "HEAD"
        ? arxivPdfHeadResponse(900_000)
        : arxivPdfRangeResponse(900_000, "NOTPDF!!");
    }
    if (url === "https://arxiv.org/pdf/2607.02002") {
      if (init.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: { "content-type": "application/pdf" },
        });
      }
      return new Response("%PDF-1.7", {
        status: 206,
        headers: {
          "content-type": "application/pdf",
          "content-length": "8",
        },
      });
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    assert.equal(connectResponse.status, 200);
    const cookie = (connectResponse.headers.get("set-cookie") ?? "").split(";")[0];

    const ask = (id) => request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper: {
          id,
          title: "Unverified arXiv PDF",
          summary: "Metadata remains available.",
        },
        prompt: "Read the full paper.",
      }),
    });

    const invalidSignature = await ask("2607.02001");
    assert.equal(invalidSignature.status, 422);
    assert.equal((await invalidSignature.json()).code, "ARXIV_PDF_INVALID");

    const unknownSize = await ask("2607.02002");
    assert.equal(unknownSize.status, 502);
    assert.equal(
      (await unknownSize.json()).code,
      "ARXIV_PDF_UNVERIFIABLE",
    );
  });

  assert.equal(fulltextCalls, 0);
});

test("attributes a provider full-text timeout while proving arXiv and text Responses are healthy", async () => {
  const apiKey = "provider-timeout-key";
  const readerEmail = "provider-timeout@example.com";
  const baseUrl = "https://timeout.paperorbit.ai/v1";
  const model = "slow-fulltext-model";
  let fulltextCalls = 0;
  let runtimeDiagnosticCalls = 0;

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === "https://arxiv.org/pdf/2607.01002") {
      return init.method === "HEAD"
        ? arxivPdfHeadResponse(11_000_071)
        : arxivPdfRangeResponse(11_000_071);
    }
    if (url === `${baseUrl}/models`) {
      return Response.json({ data: [{ id: model }] });
    }
    if (url === `${baseUrl}/responses`) {
      if (isConnectionProbe(init)) {
        return Response.json({ output_text: "PAPER_ORBIT_OK" });
      }
      if (isRuntimeDiagnosticProbe(init)) {
        runtimeDiagnosticCalls += 1;
        return Response.json({ output_text: "PAPER_ORBIT_DIAGNOSTIC_OK" });
      }
      fulltextCalls += 1;
      return Response.json(
        { error: { code: "gateway_timeout", message: "upstream timed out" } },
        { status: 504, headers: { "x-request-id": `timeout-${fulltextCalls}` } },
      );
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl, model }),
    });
    assert.equal(connectResponse.status, 200);
    const cookie = (connectResponse.headers.get("set-cookie") ?? "").split(";")[0];

    const aiResponse = await request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper: {
          id: "2607.01002",
          title: "Slow full-text paper",
          summary: "A short summary.",
        },
        prompt: "Analyze the full paper.",
      }),
    });
    assert.equal(aiResponse.status, 504);
    const result = await aiResponse.json();
    assert.equal(result.code, "PROVIDER_FULLTEXT_TIMEOUT");
    assert.equal(result.diagnostic.category, "provider");
    assert.equal(result.diagnostic.arxiv.available, true);
    assert.equal(result.diagnostic.arxiv.bytes, 11_000_071);
    assert.equal(result.diagnostic.provider.status, 504);
    assert.equal(result.diagnostic.provider.textProbe, "passed");
    assert.equal(result.diagnostic.provider.reachable, true);
    assert.equal(result.diagnostic.provider.attempts, 2);
    assert.match(result.error, /arXiv PDF is currently accessible/);
    assert.match(result.error, /minimal text probe also passed/);
  });

  assert.equal(fulltextCalls, 2, "fast 504 failures receive one bounded retry");
  assert.equal(runtimeDiagnosticCalls, 1);
});

test("recovers automatically from one fast compatible-provider gateway failure", async () => {
  const apiKey = "provider-retry-key";
  const readerEmail = "provider-retry@example.com";
  const baseUrl = "https://retry.paperorbit.ai/v1";
  const model = "retry-fulltext-model";
  let fulltextCalls = 0;

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === "https://arxiv.org/pdf/2607.01003") {
      return init.method === "HEAD"
        ? arxivPdfHeadResponse(1_200_000)
        : arxivPdfRangeResponse(1_200_000);
    }
    if (url === `${baseUrl}/models`) {
      return Response.json({ data: [{ id: model }] });
    }
    if (url === `${baseUrl}/responses`) {
      if (isConnectionProbe(init)) {
        return Response.json({ output_text: "PAPER_ORBIT_OK" });
      }
      fulltextCalls += 1;
      if (fulltextCalls === 1) {
        return Response.json(
          { error: { code: "bad_gateway", message: "temporary upstream connection failure" } },
          { status: 502 },
        );
      }
      return new Response(
        `event: response.output_text.delta\ndata: ${JSON.stringify({
          type: "response.output_text.delta",
          delta: "After one bounded retry, the model read the full paper and returned a verifiable analysis.",
        })}\n\nevent: response.completed\ndata: ${JSON.stringify({
          type: "response.completed",
          response: {
            usage: { input_tokens: 800, output_tokens: 28, total_tokens: 828 },
          },
        })}\n\n`,
        { headers: { "content-type": "text/event-stream" } },
      );
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl, model }),
    });
    assert.equal(connectResponse.status, 200);
    const cookie = (connectResponse.headers.get("set-cookie") ?? "").split(";")[0];

    const aiResponse = await request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper: {
          id: "2607.01003",
          title: "Retry recovery paper",
          summary: "A short summary.",
        },
        prompt: "Explain the core mechanism.",
      }),
    });
    assert.equal(aiResponse.status, 200);
    const result = await aiResponse.json();
    assert.equal(result.mode, "openai");
    assert.equal(result.diagnostic.category, "success");
    assert.equal(result.diagnostic.provider.transport, "sse");
    assert.equal(result.diagnostic.provider.attempts, 2);
    assert.equal(result.usage.totalTokens, 828);
  });

  assert.equal(fulltextCalls, 2);
});

test("cancels an abnormally large full-text provider response", async () => {
  const apiKey = "fulltext-response-limit-key";
  const readerEmail = "fulltext-limit@example.com";
  const baseUrl = "https://fulltext-limit.paperorbit.ai/v1";
  const model = "bounded-fulltext-model";
  let fulltextCalls = 0;
  let responseBodyCancelled = false;

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === "https://arxiv.org/pdf/2607.01004") {
      return init.method === "HEAD"
        ? arxivPdfHeadResponse(1_500_000)
        : arxivPdfRangeResponse(1_500_000);
    }
    if (url === `${baseUrl}/models`) {
      return Response.json({ data: [{ id: model }] });
    }
    if (url === `${baseUrl}/responses`) {
      if (isConnectionProbe(init)) {
        return Response.json({ output_text: "PAPER_ORBIT_OK" });
      }
      fulltextCalls += 1;
      return declaredOversizedJsonResponse(
        4 * 1024 * 1024 + 1,
        () => { responseBodyCancelled = true; },
      );
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl, model }),
    });
    assert.equal(connectResponse.status, 200);
    const cookie = (connectResponse.headers.get("set-cookie") ?? "").split(";")[0];

    const aiResponse = await request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper: {
          id: "2607.01004",
          title: "Oversized provider response paper",
          summary: "A short summary.",
        },
        prompt: "Analyze the full paper.",
      }),
    });
    assert.equal(aiResponse.status, 502);
    const result = await aiResponse.json();
    assert.equal(result.code, "PROVIDER_RESPONSE_TOO_LARGE");
    assert.equal(result.diagnostic.retryable, false);
    assert.equal(result.diagnostic.provider.textProbe, "not-run");
  });

  assert.equal(fulltextCalls, 1);
  assert.equal(responseBodyCancelled, true);
});

test("never exposes a provider request ID containing the personal API key", async () => {
  const apiKey = "e".repeat(64);
  const readerEmail = "request-id-redaction@example.com";
  const baseUrl = "https://request-id.paperorbit.ai/v1";
  const model = "request-id-model";
  const warningRecords = [];

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === "https://arxiv.org/pdf/2607.01005") {
      return init.method === "HEAD"
        ? arxivPdfHeadResponse(800_000)
        : arxivPdfRangeResponse(800_000);
    }
    if (url === `${baseUrl}/models`) {
      return Response.json({ data: [{ id: model }] });
    }
    if (url === `${baseUrl}/responses`) {
      if (isConnectionProbe(init)) {
        return Response.json({ output_text: "PAPER_ORBIT_OK" });
      }
      return Response.json(
        { error: { code: "request_rejected", message: "invalid PDF request" } },
        { status: 400, headers: { "x-request-id": apiKey } },
      );
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl, model }),
    });
    assert.equal(connectResponse.status, 200);
    const cookie = (connectResponse.headers.get("set-cookie") ?? "").split(";")[0];

    const originalWarn = console.warn;
    console.warn = (...args) => warningRecords.push(args);
    try {
      const aiResponse = await request("/api/ai", readerEmail, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          paper: {
            id: "2607.01005",
            title: "Request ID redaction paper",
            summary: "A short summary.",
          },
          prompt: "Analyze the full paper.",
        }),
      });
      assert.equal(aiResponse.status, 502);
      const raw = await aiResponse.text();
      assert.doesNotMatch(raw, new RegExp(apiKey));
      const result = JSON.parse(raw);
      assert.equal(result.diagnostic.provider.requestId, null);
    } finally {
      console.warn = originalWarn;
    }
  });

  assert.doesNotMatch(JSON.stringify(warningRecords), new RegExp(apiKey));
});

test("rejects a connection when a compatible provider ignores non-stream Responses mode", async () => {
  const apiKey = "streaming-proxy-key";
  const readerEmail = "streaming-proxy-reader@example.com";
  const baseUrl = "https://streaming.paperorbit.ai/v1";
  const model = "streaming-model";

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === `${baseUrl}/models`) {
      return Response.json({ data: [{ id: model }] });
    }
    if (url === `${baseUrl}/responses`) {
      const payload = JSON.parse(init.body);
      assert.equal(payload.stream, false);
      return new Response(
        'event: response.completed\ndata: {"response":{"output_text":"ignored stream mode"}}\n\n',
        { headers: { "content-type": "text/event-stream; charset=utf-8" } },
      );
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl, model }),
    });
    assert.equal(connectResponse.status, 502);
    assert.equal(connectResponse.headers.get("set-cookie"), null);
    const error = await connectResponse.json();
    assert.equal(error.code, "OPENAI_RESPONSES_INCOMPATIBLE");
    assert.match(error.error, /connection was not saved/);
  });
});

test("does not save a session when the live Responses inference fails", async () => {
  const baseUrl = "https://recursive-proxy.paperorbit.ai/v1";
  const model = "recursive-model";

  await withMockedFetch(async (input) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === `${baseUrl}/models`) {
      return Response.json({ data: [{ id: model }] });
    }
    if (url === `${baseUrl}/responses`) {
      return Response.json(
        { error: { code: "codex_api_error", message: "fetch failed" } },
        { status: 502 },
      );
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const response = await request("/api/ai/session", "recursive-reader@example.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "recursive-key", baseUrl, model }),
    });
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("set-cookie"), null);
    const error = await response.json();
    assert.equal(error.code, "OPENAI_LIVE_CHECK_FAILED");
    assert.match(error.error, /upstream routing/);
  });
});

test("bounds provider responses while validating a personal connection", async () => {
  const modelsBaseUrl = "https://oversized-models.paperorbit.ai/v1";
  const responsesBaseUrl = "https://oversized-responses.paperorbit.ai/v1";
  let modelsBodyCancelled = false;
  let responsesBodyCancelled = false;

  await withMockedFetch(async (input) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === `${modelsBaseUrl}/models`) {
      return declaredOversizedJsonResponse(
        1024 * 1024 + 1,
        () => { modelsBodyCancelled = true; },
      );
    }
    if (url === `${responsesBaseUrl}/models`) {
      return Response.json({ data: [{ id: "bounded-model" }] });
    }
    if (url === `${responsesBaseUrl}/responses`) {
      return declaredOversizedJsonResponse(
        256 * 1024 + 1,
        () => { responsesBodyCancelled = true; },
      );
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const oversizedModels = await request(
      "/api/ai/session",
      "oversized-models@example.com",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: "models-limit-key",
          baseUrl: modelsBaseUrl,
          model: "bounded-model",
        }),
      },
    );
    assert.equal(oversizedModels.status, 502);
    assert.equal(oversizedModels.headers.get("set-cookie"), null);
    assert.equal(
      (await oversizedModels.json()).code,
      "OPENAI_MODELS_RESPONSE_TOO_LARGE",
    );

    const oversizedResponses = await request(
      "/api/ai/session",
      "oversized-responses@example.com",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: "responses-limit-key",
          baseUrl: responsesBaseUrl,
          model: "bounded-model",
        }),
      },
    );
    assert.equal(oversizedResponses.status, 502);
    assert.equal(oversizedResponses.headers.get("set-cookie"), null);
    assert.equal(
      (await oversizedResponses.json()).code,
      "OPENAI_RESPONSES_TOO_LARGE",
    );
  });

  assert.equal(modelsBodyCancelled, true);
  assert.equal(responsesBodyCancelled, true);
});

test("rejects unsafe custom AI endpoints before sending a credential", async () => {
  const unsafeBaseUrls = [
    "http://gateway.paperorbit.ai/v1",
    "http://127.0.0.1:8080/v1",
    "https://localhost/v1",
    "https://service.local/v1",
    "https://127.0.0.1/v1",
    "https://2130706433/v1",
    "https://169.254.169.254/v1",
    "https://[::1]/v1",
    "https://metadata.google.internal/v1",
    "https://user:password@gateway.paperorbit.ai/v1",
    "https://gateway.paperorbit.ai:8443/v1",
    "https://gateway.paperorbit.ai/v1?tenant=private",
    "https://gateway.paperorbit.ai/v1#responses",
  ];
  let fetchCalls = 0;

  await withMockedFetch(async () => {
    fetchCalls += 1;
    throw new Error("Unsafe endpoint must not be fetched");
  }, async () => {
    for (const baseUrl of unsafeBaseUrls) {
      const response = await request(
        "/api/ai/session",
        "unsafe-endpoint-reader@example.com",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            apiKey: "x",
            baseUrl,
            model: "research-model",
          }),
        },
      );
      assert.equal(response.status, 400, baseUrl);
      const payload = await response.json();
      assert.equal(payload.code, "OPENAI_BASE_URL_INVALID", baseUrl);
    }
  });

  assert.equal(fetchCalls, 0);
});

test("allows a loopback AI endpoint only in explicit local development mode", async () => {
  const previousLocalMode = process.env.PAPER_ORBIT_LOCAL_MODE;
  const previousLocalToken = process.env.PAPER_ORBIT_LOCAL_REQUEST_TOKEN;
  const previousLocalEmail = process.env.PAPER_ORBIT_LOCAL_USER_EMAIL;
  const previousLocalName = process.env.PAPER_ORBIT_LOCAL_USER_NAME;
  const localRequestToken = "a".repeat(64);
  process.env.PAPER_ORBIT_LOCAL_MODE = "1";
  process.env.PAPER_ORBIT_LOCAL_REQUEST_TOKEN = localRequestToken;
  process.env.PAPER_ORBIT_LOCAL_USER_EMAIL = "local-reader@paperorbit.dev";
  process.env.PAPER_ORBIT_LOCAL_USER_NAME = "Local Reader";

  const origin = "http://127.0.0.1:3000";
  const baseUrl = "http://127.0.0.1:8080/v1";
  const apiKey = "local-proxy-key";
  const model = "local-paper-model";
  const upstreamCalls = [];

  try {
    await withMockedFetch(async (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      upstreamCalls.push({ url, init });
      if (url === "https://arxiv.org/pdf/2607.00003") {
        if (init.method === "HEAD") return arxivPdfHeadResponse(900_000);
        assert.equal(init.method, "GET");
        return arxivPdfRangeResponse(900_000);
      }
      assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${apiKey}`);
      assert.equal(init.redirect, "manual");

      if (url === `${baseUrl}/models`) {
        return Response.json({ data: [{ id: model }] });
      }
      if (url === `${baseUrl}/responses`) {
        if (isConnectionProbe(init)) {
          const payload = requestPayload(init);
          assert.equal(payload.model, model);
          assert.equal(payload.stream, false);
          assert.equal(payload.store, false);
          assert.equal(payload.max_output_tokens, 16);
          return Response.json({ output_text: "PAPER_ORBIT_OK" });
        }
        return Response.json({
          output_text:
            "After reading the full paper, the local model identifies the problem setting, analyzes data flow between method components, and uses experiments and ablations to define the conclusions' evidence boundaries. This response verifies the complete Paper Copilot request path through a loopback service.",
          usage: {
            input_tokens: 210,
            output_tokens: 46,
            total_tokens: 256,
          },
        });
      }
      throw new Error(`Unexpected upstream request: ${url}`);
    }, async () => {
      const pageResponse = await request(
        "/",
        null,
        { headers: { "x-paper-orbit-local-request": localRequestToken } },
        origin,
      );
      assert.equal(pageResponse.status, 200);
      assert.match(await pageResponse.text(), /Local Reader/);

      const connectResponse = await request(
        "/api/ai/session",
        null,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-paper-orbit-local-request": localRequestToken,
          },
          body: JSON.stringify({ apiKey, baseUrl, model }),
        },
        origin,
      );
      assert.equal(connectResponse.status, 200);
      assert.deepEqual(await connectResponse.json(), {
        connected: true,
        source: "session",
        baseUrl,
        model,
        sessionAvailable: true,
      });

      const setCookie = connectResponse.headers.get("set-cookie") ?? "";
      assert.match(setCookie, /^paper_orbit_openai_session=v1\./);
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Strict/);
      assert.match(setCookie, /Max-Age=7776000/);
      assert.doesNotMatch(setCookie, /; Secure/);
      assert.doesNotMatch(setCookie, /local-proxy-key/);
      const cookie = setCookie.split(";")[0];

      const statusResponse = await request(
        "/api/ai/session",
        null,
        {
          headers: {
            cookie,
            "x-paper-orbit-local-request": localRequestToken,
          },
        },
        origin,
      );
      assert.equal(statusResponse.status, 200);
      assert.deepEqual(await statusResponse.json(), {
        connected: true,
        source: "session",
        baseUrl,
        model,
        sessionAvailable: true,
      });

      const aiResponse = await request(
        "/api/ai",
        null,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie,
            "x-paper-orbit-local-request": localRequestToken,
          },
          body: JSON.stringify({
            paper: {
              id: "2607.00003",
              title: "Local Loopback Provider Paper",
              authors: ["Local Researcher"],
              summary: "Metadata for the local provider test.",
              category: "cs.AI",
              tags: ["Local AI"],
            },
            action: "chat",
            prompt: "Explain the paper's core mechanism.",
          }),
        },
        origin,
      );
      assert.equal(aiResponse.status, 200);
      const answer = await aiResponse.json();
      assert.equal(answer.mode, "openai");
      assert.equal(answer.provider, "compatible");
      assert.equal(answer.model, model);

      const productionResponse = await request(
        "/api/ai/session",
        "reader@example.com",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiKey, baseUrl, model }),
        },
      );
      assert.equal(productionResponse.status, 400);
      assert.equal(
        (await productionResponse.json()).code,
        "OPENAI_BASE_URL_INVALID",
      );
    });

    assert.deepEqual(
      upstreamCalls.map((call) => call.url),
      [
        `${baseUrl}/models`,
        `${baseUrl}/responses`,
        "https://arxiv.org/pdf/2607.00003",
        "https://arxiv.org/pdf/2607.00003",
        `${baseUrl}/responses`,
      ],
    );
  } finally {
    if (previousLocalMode === undefined) delete process.env.PAPER_ORBIT_LOCAL_MODE;
    else process.env.PAPER_ORBIT_LOCAL_MODE = previousLocalMode;
    if (previousLocalToken === undefined) delete process.env.PAPER_ORBIT_LOCAL_REQUEST_TOKEN;
    else process.env.PAPER_ORBIT_LOCAL_REQUEST_TOKEN = previousLocalToken;
    if (previousLocalEmail === undefined) delete process.env.PAPER_ORBIT_LOCAL_USER_EMAIL;
    else process.env.PAPER_ORBIT_LOCAL_USER_EMAIL = previousLocalEmail;
    if (previousLocalName === undefined) delete process.env.PAPER_ORBIT_LOCAL_USER_NAME;
    else process.env.PAPER_ORBIT_LOCAL_USER_NAME = previousLocalName;
  }
});

test("local development mode chats through the shared .env credential", async () => {
  const previousEnv = {
    PAPER_ORBIT_LOCAL_MODE: process.env.PAPER_ORBIT_LOCAL_MODE,
    PAPER_ORBIT_LOCAL_REQUEST_TOKEN:
      process.env.PAPER_ORBIT_LOCAL_REQUEST_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  };
  const localRequestToken = "b".repeat(64);
  process.env.PAPER_ORBIT_LOCAL_MODE = "1";
  process.env.PAPER_ORBIT_LOCAL_REQUEST_TOKEN = localRequestToken;
  process.env.OPENAI_API_KEY = "env-local-gateway-key";
  process.env.OPENAI_BASE_URL = "http://127.0.0.1:8080/v1";
  process.env.OPENAI_MODEL = "gpt-5.6-terra";

  const origin = "http://127.0.0.1:3000";
  const baseUrl = "http://127.0.0.1:8080/v1";
  const upstreamCalls = [];

  try {
    await withMockedFetch(async (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      upstreamCalls.push({ url, init });
      if (url === "https://arxiv.org/pdf/2607.00005") {
        if (init.method === "HEAD") return arxivPdfHeadResponse(900_000);
        assert.equal(init.method, "GET");
        return arxivPdfRangeResponse(900_000);
      }
      if (url === `${baseUrl}/responses`) {
        assert.equal(
          new Headers(init.headers).get("authorization"),
          "Bearer env-local-gateway-key",
        );
        assert.equal(requestPayload(init).model, "gpt-5.6-terra");
        return Response.json({
          output_text:
            "After reading the full paper through the local shared credential, the model organizes the research question and method structure, then uses experiments and ablations to explain the evidence boundaries. This response verifies the complete Paper Copilot request path through the .env credential.",
          usage: {
            input_tokens: 190,
            output_tokens: 42,
            total_tokens: 232,
          },
        });
      }
      throw new Error(`Unexpected upstream request: ${url}`);
    }, async () => {
      const statusResponse = await request(
        "/api/ai/session",
        null,
        { headers: { "x-paper-orbit-local-request": localRequestToken } },
        origin,
      );
      assert.equal(statusResponse.status, 200);
      assert.deepEqual(await statusResponse.json(), {
        connected: true,
        source: "shared",
        baseUrl,
        model: "gpt-5.6-terra",
        sessionAvailable: true,
      });

      const aiResponse = await request(
        "/api/ai",
        null,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-paper-orbit-local-request": localRequestToken,
          },
          body: JSON.stringify({
            paper: {
              id: "2607.00005",
              title: "Env Credential Loopback Paper",
              authors: ["Local Researcher"],
              summary: "Metadata for the env credential test.",
              category: "cs.AI",
              tags: ["Local AI"],
            },
            action: "chat",
            prompt: "Explain the paper's core mechanism.",
          }),
        },
        origin,
      );
      assert.equal(aiResponse.status, 200);
      const answer = await aiResponse.json();
      assert.equal(answer.mode, "openai");
      assert.equal(answer.provider, "compatible");
      assert.equal(answer.credentialSource, "shared");
      assert.equal(answer.model, "gpt-5.6-terra");

      // A production reader must never receive the shared credential.
      const readerResponse = await request(
        "/api/ai/session",
        "reader@example.com",
      );
      assert.equal(readerResponse.status, 200);
      assert.deepEqual(await readerResponse.json(), {
        connected: false,
        source: null,
        baseUrl: null,
        model: null,
        sessionAvailable: true,
      });

      // Outside local mode a loopback OPENAI_BASE_URL disables the shared
      // credential entirely instead of falling back to the official endpoint.
      delete process.env.PAPER_ORBIT_LOCAL_MODE;
      const managerResponse = await request(
        "/api/ai/session",
        "xumiaojun49@gmail.com",
      );
      assert.equal(managerResponse.status, 200);
      assert.equal((await managerResponse.json()).connected, false);
    });

    assert.deepEqual(
      upstreamCalls.map((call) => call.url),
      [
        "https://arxiv.org/pdf/2607.00005",
        "https://arxiv.org/pdf/2607.00005",
        `${baseUrl}/responses`,
      ],
    );
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("connects a reader-owned Semantic Scholar key for influence enrichment", async () => {
  const apiKey = "semantic-scholar-test-private-reader-key";
  const readerEmail = "reader@example.com";
  const upstreamCalls = [];
  const entries = [
    { id: "2607.00001", title: "Reader-owned influence paper" },
  ];

  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    upstreamCalls.push({ url, init });

    if (
      url.hostname === "api.semanticscholar.org"
      && url.pathname.includes("/paper/ARXIV:1706.03762")
    ) {
      assert.equal(new Headers(init.headers).get("x-api-key"), apiKey);
      return Response.json({ paperId: "204e3073870fae3d05bcbc2f6a8e263d9b72e776" });
    }
    if (url.hostname === "export.arxiv.org") {
      return new Response(atomFeed(entries, { total: 1, limit: 60 }), {
        headers: { "content-type": "application/atom+xml" },
      });
    }
    if (
      url.hostname === "api.semanticscholar.org"
      && url.pathname.endsWith("/paper/batch")
    ) {
      assert.equal(new Headers(init.headers).get("x-api-key"), apiKey);
      return Response.json([
        {
          externalIds: { ArXiv: "2607.00001" },
          citationCount: 12,
          influentialCitationCount: 3,
        },
      ]);
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request(
      "/api/arxiv/session",
      readerEmail,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey }),
      },
    );
    assert.equal(connectResponse.status, 200);
    const connect = await connectResponse.json();
    assert.deepEqual(connect.arxiv, {
      keyRequired: false,
      source: "public",
    });
    assert.equal(connect.semanticScholar.keyConnected, true);
    assert.equal(connect.semanticScholar.source, "session");
    assert.doesNotMatch(JSON.stringify(connect), /private-reader-key/);

    const setCookie = connectResponse.headers.get("set-cookie") ?? "";
    assert.match(
      setCookie,
      /^paper_orbit_semantic_scholar_session=v1\./,
    );
    assert.match(setCookie, /Path=\/api\/arxiv/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Secure/);
    assert.doesNotMatch(setCookie, /private-reader-key/);
    const cookie = setCookie.split(";")[0];

    const statusResponse = await request(
      "/api/arxiv/session",
      readerEmail,
      { headers: { cookie } },
    );
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.semanticScholar.keyConnected, true);
    assert.equal(status.semanticScholar.source, "session");

    const otherAccountResponse = await request(
      "/api/arxiv/session",
      "other-reader@example.com",
      { headers: { cookie } },
    );
    assert.equal(otherAccountResponse.status, 200);
    const otherAccount = await otherAccountResponse.json();
    assert.equal(otherAccount.semanticScholar.keyConnected, false);
    assert.equal(otherAccount.semanticScholar.source, "public");

    const feedResponse = await request(
      "/api/arxiv?mode=feed",
      readerEmail,
      { headers: { cookie } },
    );
    assert.equal(feedResponse.status, 200);
    const feed = await feedResponse.json();
    assert.equal(feed.meta.metadataCredential, "session");
    assert.equal(feed.source, "arxiv+semantic-scholar");
    assert.equal(feed.papers[0].recommendation.citationCount, 12);

    const disconnectResponse = await request(
      "/api/arxiv/session",
      readerEmail,
      { method: "DELETE", headers: { cookie } },
    );
    assert.equal(disconnectResponse.status, 200);
    const disconnect = await disconnectResponse.json();
    assert.equal(disconnect.semanticScholar.source, "public");
    assert.match(
      disconnectResponse.headers.get("set-cookie") ?? "",
      /Max-Age=0/,
    );
  });

  assert.ok(
    upstreamCalls.some(
      (call) => call.url.pathname.endsWith("/paper/batch"),
    ),
  );
});

test("ships ten fallback papers and the local-first recommendation pipeline", async () => {
  const [page, client, localUserStorage, localDevelopment, access, route, searchQuery, researchSession, researchSessionRoute, aiRoute, copilotTransport, boundedResponse, encryptedSession, aiSession, sessionRoute, providerConfig, recommendation, layout, readme, envExample, hosting, gitignore, localDevScript, viteConfig] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/paper-orbit-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/local-user-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/local-development.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/access-control.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/search-query.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/research-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/copilot-transport.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/bounded-response.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/encrypted-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/openai-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/provider-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/recommendation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../scripts/dev-local.mjs", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  ]);

  for (const [name, source] of [
    ["client", client],
    ["layout", layout],
    ["AI session route", sessionRoute],
    ["arXiv session route", researchSessionRoute],
    ["recommendation module", recommendation],
  ]) {
    assert.doesNotMatch(
      source,
      /[\u3400-\u9fff]/,
      `${name} must keep its unconditional user-facing surfaces in English`,
    );
  }

  assert.match(client, /const DAILY_PAPER_COUNT = 10/);
  assert.equal((client.match(/id: "2607\./g) ?? []).length, 10);
  assert.match(localUserStorage, /paper-orbit:user:\$\{scope\}/);
  assert.match(localUserStorage, /paper-orbit:legacy-storage-claim-v1/);
  assert.match(localUserStorage, /if \(!canClaim\) return false/);
  assert.match(client, /viewer\.role !== "reader"/);
  assert.match(recommendation, /paper-orbit:affinity-v3/);
  assert.match(recommendation, /paper-orbit:affinity-v2/);
  assert.match(recommendation, /paper-orbit:paper-feedback-v1/);
  assert.match(page, /requireChatGPTUser/);
  assert.match(access, /xiangk123@gmail\.com/);
  assert.match(access, /xumiaojun49@gmail\.com/);
  assert.match(access, /role: access\?\.role \?\? "reader"/);
  assert.doesNotMatch(access, /not authorized for Paper Orbit/);
  assert.match(route, /paperOrbitApiAccessError/);
  assert.match(route, /max_results", "60"/);
  assert.match(route, /api\.semanticscholar\.org\/graph\/v1\/paper\/batch/);
  assert.match(route, /dailyLimit: 10/);
  assert.match(route, /rankingVersion: "orbit-v3-local"/);
  assert.match(route, /metadataCredential/);
  assert.match(route, /personalization: "client"/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(
    route,
    /searchParams\.get\("(?:interests|profile|affinity|feedback|saved|read|reports)"\)/,
  );
  assert.match(client, /fetch\("\/api\/arxiv\?mode=feed"/);
  assert.match(client, /rankPapersLocally/);
  assert.match(client, /recommendation\.signals\.relevance/);
  assert.match(client, /Why this paper/);
  assert.match(client, /Exact phrase/);
  assert.match(client, /← Previous/);
  assert.match(client, /wasSaved \? -0\.6 : 1/);
  assert.match(client, /learnFromPaper\(paper, 1\.5\)/);
  assert.match(client, /learnFromPaper\(paper, 2\)/);
  assert.match(client, /Respond in English\. Read the full PDF/);
  assert.match(client, /Respond in English\. Analyze this paper in depth/);
  assert.match(client, /function paperPayload/);
  assert.match(client, /delete payload\.zhSummary/);
  assert.match(client, /paper: paperPayload\(copilotPaper\)/);
  assert.match(client, /paper: paperPayload\(paper\)/);
  assert.doesNotMatch(client, /Math\.random/);
  assert.match(searchQuery, /title: "ti"/);
  assert.match(searchQuery, /author: "au"/);
  assert.match(searchQuery, /abstract: "abs"/);
  assert.match(aiRoute, /do not reuse twelve or more consecutive English words from the source/);
  assert.match(aiRoute, /violatesOutputPolicy/);
  assert.match(aiRoute, /repairInstructions/);
  assert.doesNotMatch(aiRoute, /chineseSummary|paper\.zhSummary/);
  assert.match(aiRoute, /type: "input_file"/);
  assert.match(aiRoute, /file_url: pdfUrl/);
  assert.match(aiRoute, /https:\/\/arxiv\.org\/pdf\//);
  assert.match(aiRoute, /fulltext-pdf/);
  assert.match(encryptedSession, /AES-GCM/);
  assert.match(encryptedSession, /HttpOnly/);
  assert.match(encryptedSession, /SameSite=Strict/);
  assert.match(encryptedSession, /LOCAL_SESSION_MAX_AGE_SECONDS/);
  assert.match(encryptedSession, /isLocalDevelopmentRequest/);
  assert.match(localDevelopment, /LOCAL_REQUEST_TOKEN_ENV/);
  assert.match(localDevelopment, /hasTrustedLocalIngress/);
  assert.doesNotMatch(localDevelopment, /x-forwarded-(?:host|proto)/);
  assert.match(viteConfig, /randomBytes\(32\)/);
  assert.match(viteConfig, /remoteAddress/);
  assert.match(viteConfig, /encrypted !== true/);
  assert.match(viteConfig, /socket\.localPort/);
  assert.match(viteConfig, /delete request\.headers\[LOCAL_REQUEST_HEADER\]/);
  assert.match(viteConfig, /request\.rawHeaders\.splice/);
  assert.match(viteConfig, /FORWARDED_INGRESS_HEADERS/);
  assert.match(viteConfig, /!url\.username/);
  assert.match(viteConfig, /url\.pathname === "\/"/);
  assert.match(gitignore, /\/\.paperorbit\//);
  assert.match(localDevScript, /local-session-secret/);
  assert.match(localDevScript, /mode: 0o600/);
  assert.doesNotMatch(localDevScript, /console\.(?:log|info).*sessionSecret/);
  assert.match(aiSession, /isPaperOrbitPrivilegedEmail/);
  assert.match(sessionRoute, /openAIProviderEndpoint\(baseUrl, "models"\)/);
  assert.match(sessionRoute, /openAIProviderEndpoint\(baseUrl, "responses"\)/);
  assert.match(sessionRoute, /PAPER_ORBIT_OK/);
  assert.match(sessionRoute, /max_output_tokens: 16/);
  assert.match(sessionRoute, /OPENAI_LIVE_CHECK_FAILED/);
  assert.match(sessionRoute, /Enter a valid API key/);
  assert.match(aiSession, /validation: "responses"/);
  assert.match(sessionRoute, /redirect: "manual"/);
  assert.match(sessionRoute, /readBoundedResponseJson/);
  assert.match(boundedResponse, /ResponseBodyTooLargeError/);
  assert.match(boundedResponse, /value\.byteLength/);
  assert.match(boundedResponse, /reader\.cancel/);
  assert.match(copilotTransport, /openAIProviderEndpoint\(credential\.baseUrl, "responses"\)/);
  assert.match(copilotTransport, /probeArxivPdf/);
  assert.match(copilotTransport, /text\/event-stream/);
  assert.match(copilotTransport, /MAX_PROVIDER_SUCCESS_BODY/);
  assert.doesNotMatch(copilotTransport, /response\.text\(\)/);
  assert.match(aiRoute, /PROVIDER_FULLTEXT_TIMEOUT/);
  assert.match(aiRoute, /PAPER_ORBIT_DIAGNOSTIC_OK/);
  assert.match(providerConfig, /https:\/\/api\.openai\.com\/v1/);
  assert.match(providerConfig, /normalizeOpenAIBaseUrl/);
  assert.match(providerConfig, /169 && second === 254/);
  assert.match(providerConfig, /normalized\.includes\(":"\)/);
  assert.match(researchSession, /isPaperOrbitPrivilegedEmail/);
  assert.match(researchSessionRoute, /api\.semanticscholar\.org/);
  assert.match(researchSessionRoute, /x-api-key/);
  assert.match(researchSessionRoute, /Enter a valid Semantic Scholar API key/);
  assert.match(client, /Connect your research services/);
  assert.match(client, /OpenAI-compatible API/);
  assert.match(client, /API Base URL/);
  assert.match(client, /no sk- prefix required/);
  assert.match(client, /Public arXiv API/);
  assert.match(client, /Semantic Scholar API Key/);
  assert.match(client, /Full PDF/);
  assert.match(client, /AI text path verified and connected/);
  assert.match(client, /PDF checked per paper/);
  assert.match(client, /Retry this question/);
  assert.doesNotMatch(client, /lastAiRun|setLastAiRun/);
  assert.match(client, /message\.meta/);
  assert.match(client, /message\.diagnostic/);
  assert.match(client, /This proves only that the model and text endpoint work; it does not validate PDF support/);
  assert.match(readme, /Responses `\/responses`/);
  assert.match(readme, /Orbit v3 Local/);
  assert.match(readme, /90-day half-life/);
  assert.match(envExample, /PAPER_ORBIT_SESSION_SECRET=/);
  assert.deepEqual(JSON.parse(hosting), {
    project_id: "appgprj_6a54adc87188819197397fa1dc842363",
  });
  assert.match(recommendation, /relevance: 0\.42/);
  assert.match(recommendation, /similarity: 0\.16/);
  assert.match(recommendation, /rankPapersLocally/);
  assert.match(recommendation, /Marked relevant/);
  assert.match(recommendation, /Diversity exploration/);
  assert.doesNotMatch(recommendation, /Math\.random/);
  assert.match(layout, /Paper Orbit — Daily Paper Reading and AI Research Copilot/);
  assert.match(layout, /<html lang="en">/);
  assert.doesNotMatch(client, /_sites-preview|SkeletonPreview/);
});
