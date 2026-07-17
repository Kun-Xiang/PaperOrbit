import assert from "node:assert/strict";
import test from "node:test";

import { parseMarkdown, parseMarkdownInline } from "../app/markdown.ts";

test("parses report-style headings, emphasis, and inline code", () => {
  const blocks = parseMarkdown("## 一句话结论\n方法依赖 **多块预测** 与 `MCP` 头。");
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], {
    type: "heading",
    level: 2,
    children: [{ type: "text", text: "一句话结论" }],
  });
  assert.equal(blocks[1].type, "paragraph");
  const inline = blocks[1].lines[0];
  assert.deepEqual(inline[1], {
    type: "strong",
    children: [{ type: "text", text: "多块预测" }],
  });
  assert.deepEqual(inline[3], { type: "code", text: "MCP" });
});

test("keeps blank-separated numbered items in one ordered list", () => {
  const blocks = parseMarkdown("1. 建立对照\n\n2. 加入辅助头\n\n3. 画学习曲线");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "list");
  assert.equal(blocks[0].ordered, true);
  assert.equal(blocks[0].start, 1);
  assert.equal(blocks[0].items.length, 3);
});

test("preserves an explicit ordered-list start number", () => {
  const [list] = parseMarkdown("4. 第四步\n5. 第五步");
  assert.equal(list.type, "list");
  assert.equal(list.start, 4);
  assert.equal(list.items.length, 2);
});

test("nests indented list items and keeps continuation lines in the item", () => {
  const [list] = parseMarkdown(
    "- 复现实验设计\n  论文位置：第 2.3.3 节\n  - 固定随机种子\n- 关键目标",
  );
  assert.equal(list.type, "list");
  assert.equal(list.items.length, 2);
  assert.equal(list.items[0].lines.length, 2);
  assert.equal(list.items[0].child?.items.length, 1);
  assert.deepEqual(list.items[0].child?.items[0].lines[0], [
    { type: "text", text: "固定随机种子" },
  ]);
});

test("never emits links for unsafe protocols", () => {
  const unsafe = parseMarkdownInline("[点我](javascript:alert(1))");
  assert.ok(unsafe.every((node) => node.type === "text"));
  const safe = parseMarkdownInline("[arXiv](https://arxiv.org/abs/1706.03762)");
  assert.equal(safe[0].type, "link");
  assert.equal(safe[0].href, "https://arxiv.org/abs/1706.03762");
});

test("keeps HTML-looking input as literal text tokens", () => {
  const blocks = parseMarkdown("<script>alert(1)</script> 正文 <img src=x onerror=y>");
  assert.equal(blocks.length, 1);
  const [line] = blocks[0].lines;
  assert.equal(line.length, 1);
  assert.equal(line[0].type, "text");
  assert.match(line[0].text, /^<script>alert\(1\)<\/script>/);
});

test("parses display and inline TeX passthrough", () => {
  const blocks = parseMarkdown("\\[\nL = 0.5L_1 + 0.2L_2\n\\]\n权重为 \\(0.5/0.2/0.1\\)。");
  assert.deepEqual(blocks[0], { type: "math", tex: "L = 0.5L_1 + 0.2L_2" });
  const inline = blocks[1].lines[0];
  assert.deepEqual(inline[1], { type: "math", tex: "0.5/0.2/0.1" });
});

test("keeps fenced code verbatim without inline parsing", () => {
  const blocks = parseMarkdown("```python\nx = \"**not bold**\"\n```");
  assert.deepEqual(blocks, [
    { type: "code", language: "python", text: "x = \"**not bold**\"" },
  ]);
});

test("parses pipe tables with inline cells", () => {
  const blocks = parseMarkdown(
    "| 方法 | 成功率 |\n| --- | --- |\n| **MCP** | 86.6% |\n| 基线 | 78.0% |",
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "table");
  assert.equal(blocks[0].header.length, 2);
  assert.equal(blocks[0].rows.length, 2);
  assert.deepEqual(blocks[0].rows[0][0][0], {
    type: "strong",
    children: [{ type: "text", text: "MCP" }],
  });
});

test("parses quotes and horizontal rules", () => {
  const blocks = parseMarkdown("> 引用一行\n> 引用二行\n\n---");
  assert.equal(blocks[0].type, "quote");
  assert.equal(blocks[0].lines.length, 2);
  assert.deepEqual(blocks[1], { type: "rule" });
});
