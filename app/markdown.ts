/**
 * Dependency-free Markdown parsing for model-generated Copilot answers and
 * reading reports. The parser only produces typed tokens; rendering happens
 * with plain React elements, so untrusted text can never become HTML. Links
 * are the single active element and only http/https targets survive parsing.
 */

export type MarkdownInline =
  | { type: "text"; text: string }
  | { type: "strong"; children: MarkdownInline[] }
  | { type: "em"; children: MarkdownInline[] }
  | { type: "code"; text: string }
  | { type: "math"; tex: string }
  | { type: "link"; href: string; children: MarkdownInline[] };

export type MarkdownList = {
  type: "list";
  ordered: boolean;
  start: number;
  items: MarkdownListItem[];
};

export type MarkdownListItem = {
  lines: MarkdownInline[][];
  child?: MarkdownList;
};

export type MarkdownBlock =
  | { type: "heading"; level: number; children: MarkdownInline[] }
  | { type: "paragraph"; lines: MarkdownInline[][] }
  | { type: "quote"; lines: MarkdownInline[][] }
  | { type: "code"; language: string; text: string }
  | { type: "math"; tex: string }
  | { type: "rule" }
  | { type: "table"; header: MarkdownInline[][]; rows: MarkdownInline[][][] }
  | MarkdownList;

const LIST_ITEM = /^(\s*)(?:([-*•])|(\d{1,3})[.、)])\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function safeHttpUrl(candidate: string) {
  if (!/^https?:\/\//i.test(candidate)) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function parseMarkdownInline(source: string): MarkdownInline[] {
  const nodes: MarkdownInline[] = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (buffer) {
      nodes.push({ type: "text", text: buffer });
      buffer = "";
    }
  };

  const closing = (open: string, close: string, from: number) => {
    const end = source.indexOf(close, from + open.length);
    return end > from + open.length - 1 ? end : -1;
  };

  while (index < source.length) {
    const rest = source.slice(index);

    if (rest.startsWith("`")) {
      const end = closing("`", "`", index);
      if (end > index + 1) {
        flush();
        nodes.push({ type: "code", text: source.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (rest.startsWith("\\(")) {
      const end = source.indexOf("\\)", index + 2);
      if (end > index + 2) {
        flush();
        nodes.push({ type: "math", tex: source.slice(index + 2, end).trim() });
        index = end + 2;
        continue;
      }
    }

    if (rest.startsWith("**")) {
      const end = source.indexOf("**", index + 2);
      if (end > index + 2) {
        flush();
        nodes.push({
          type: "strong",
          children: parseMarkdownInline(source.slice(index + 2, end)),
        });
        index = end + 2;
        continue;
      }
    }

    if (rest.startsWith("*")) {
      const end = source.indexOf("*", index + 1);
      const inner = end > index + 1 ? source.slice(index + 1, end) : "";
      if (inner && !/^\s|\s$/.test(inner)) {
        flush();
        nodes.push({ type: "em", children: parseMarkdownInline(inner) });
        index = end + 1;
        continue;
      }
    }

    if (rest.startsWith("[")) {
      const match = rest.match(/^\[([^\]\n]+)\]\(([^\s)]+)\)/);
      const href = match ? safeHttpUrl(match[2]) : "";
      if (match && href) {
        flush();
        nodes.push({
          type: "link",
          href,
          children: parseMarkdownInline(match[1]),
        });
        index += match[0].length;
        continue;
      }
    }

    buffer += source[index];
    index += 1;
  }

  flush();
  return nodes;
}

function parseTableRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => parseMarkdownInline(cell.trim()));
}

function listLevel(indent: string) {
  return indent.replace(/\t/g, "  ").length >= 2 ? 1 : 0;
}

type RawListItem = {
  level: number;
  ordered: boolean;
  number: number;
  lines: string[];
};

function buildList(items: RawListItem[], from: number, level: number) {
  const list: MarkdownList = {
    type: "list",
    ordered: items[from].ordered,
    start: items[from].ordered ? items[from].number : 1,
    items: [],
  };
  let index = from;
  while (index < items.length && items[index].level >= level) {
    if (items[index].level > level) {
      const nested = buildList(items, index, items[index].level);
      const target = list.items.at(-1);
      if (target) target.child = nested.list;
      else list.items.push({ lines: [], child: nested.list });
      index = nested.next;
      continue;
    }
    list.items.push({
      lines: items[index].lines.map((line) => parseMarkdownInline(line)),
    });
    index += 1;
  }
  return { list, next: index };
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^```([\w+-]*)\s*$/);
    if (fence) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", language: fence[1] ?? "", text: body.join("\n") });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        children: parseMarkdownInline(heading[2].trim()),
      });
      index += 1;
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    const mathOpen = trimmed.startsWith("\\[") || trimmed.startsWith("$$");
    if (mathOpen) {
      const closer = trimmed.startsWith("$$") ? "$$" : "\\]";
      const opener = trimmed.startsWith("$$") ? "$$" : "\\[";
      const body: string[] = [];
      let current = trimmed.slice(opener.length);
      while (index < lines.length) {
        const end = current.indexOf(closer);
        if (end >= 0) {
          body.push(current.slice(0, end));
          break;
        }
        body.push(current);
        index += 1;
        current = index < lines.length ? lines[index] : "";
      }
      index += 1;
      const tex = body.join("\n").trim();
      if (tex) blocks.push({ type: "math", tex });
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoted: MarkdownInline[][] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        const inner = lines[index].trim().replace(/^>\s?/, "");
        if (inner) quoted.push(parseMarkdownInline(inner));
        index += 1;
      }
      blocks.push({ type: "quote", lines: quoted });
      continue;
    }

    if (
      trimmed.includes("|")
      && index + 1 < lines.length
      && TABLE_DIVIDER.test(lines[index + 1])
      && lines[index + 1].includes("-")
    ) {
      const header = parseTableRow(line);
      index += 2;
      const rows: MarkdownInline[][][] = [];
      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const listStart = line.match(LIST_ITEM);
    if (listStart) {
      const rawItems: RawListItem[] = [];
      while (index < lines.length) {
        const itemLine = lines[index];
        const item = itemLine.match(LIST_ITEM);
        if (item) {
          rawItems.push({
            level: listLevel(item[1]),
            ordered: item[3] !== undefined,
            number: item[3] !== undefined ? Number(item[3]) : 1,
            lines: [item[4].trim()].filter(Boolean),
          });
          index += 1;
          continue;
        }
        if (itemLine.trim() && /^\s{2,}/.test(itemLine) && rawItems.length) {
          // Indented continuation stays inside the current item.
          rawItems.at(-1)?.lines.push(itemLine.trim());
          index += 1;
          continue;
        }
        if (!itemLine.trim()) {
          // A blank line only ends the list when no further item follows;
          // models often separate "1./2./3." items with blank lines and the
          // numbering must survive as one ordered list.
          let lookahead = index + 1;
          while (lookahead < lines.length && !lines[lookahead].trim()) {
            lookahead += 1;
          }
          if (lookahead < lines.length && LIST_ITEM.test(lines[lookahead])) {
            index = lookahead;
            continue;
          }
        }
        break;
      }
      let cursor = 0;
      while (cursor < rawItems.length) {
        const built = buildList(rawItems, cursor, rawItems[cursor].level);
        blocks.push(built.list);
        cursor = built.next;
      }
      continue;
    }

    const paragraph: MarkdownInline[][] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index].trim();
      if (
        !paragraphLine
        || /^(#{1,6})\s/.test(paragraphLine)
        || paragraphLine.startsWith("```")
        || paragraphLine.startsWith(">")
        || paragraphLine.startsWith("\\[")
        || paragraphLine.startsWith("$$")
        || /^(?:-{3,}|\*{3,}|_{3,})$/.test(paragraphLine)
        || LIST_ITEM.test(lines[index])
      ) {
        break;
      }
      paragraph.push(parseMarkdownInline(paragraphLine));
      index += 1;
    }
    if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}
