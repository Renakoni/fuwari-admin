import { parseImageBlock } from "./imageBlock";

export type PreviewCalloutKind = "note" | "warning" | "proof";

export type PreviewBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "spacer" }
  | { type: "code"; lang: string; code: string }
  | { type: "math"; formula: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "callout"; kind: PreviewCalloutKind; label: string; body: string }
  | { type: "metric"; kind: "rating" | "stat"; label: string; value: number; max: number; note: string }
  | { type: "github"; repo: string; href: string }
  | { type: "tabs"; tabs: Array<{ label: string; body: string; lang: string }> }
  | { type: "figure"; label: string; body: string; src?: string }
  | { type: "video"; label: string; body: string; href?: string; embedSrc?: string; title?: string; note?: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function classifyCodeIdentifier(value: string, lang: string): "keyword" | "type" | "variable" | "plain" {
  const normalizedLang = lang.toLowerCase();
  const keywordSet = new Set([
    "alignas", "alignof", "asm", "auto", "bool", "break", "case", "catch", "char", "class", "const", "constexpr", "continue", "decltype", "default", "delete", "do", "double", "else", "enum", "export", "extern", "false", "float", "for", "friend", "if", "inline", "int", "long", "namespace", "new", "nullptr", "operator", "private", "protected", "public", "return", "short", "signed", "sizeof", "static", "struct", "switch", "template", "this", "throw", "true", "try", "typedef", "typename", "union", "unsigned", "using", "virtual", "void", "volatile", "while",
    "abstract", "as", "async", "await", "boolean", "constructor", "debugger", "extends", "finally", "from", "function", "get", "implements", "import", "in", "instanceof", "interface", "let", "module", "of", "package", "readonly", "set", "string", "super", "type", "var", "yield",
    "and", "assert", "break", "class", "continue", "def", "del", "elif", "else", "except", "False", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "None", "nonlocal", "not", "or", "pass", "raise", "return", "True", "try", "while", "with", "yield",
    "pnpm", "npm", "yarn", "bun", "npx", "node", "git", "cd", "mkdir", "rm", "cp", "mv", "install", "add", "run", "build", "dev", "test",
  ]);
  const typeSet = new Set(["std", "String", "Array", "Promise", "Record", "Map", "Set", "HTMLElement", "HTMLDivElement", "KeyboardEvent", "CustomEvent", "Node", "Date", "RegExp", "Error", "console", "document", "window", "self", "list", "dict", "tuple", "set", "str", "int", "float", "bool", "None", "print", "len", "range", "enumerate", "zip", "Path"]);
  if (keywordSet.has(value)) return "keyword";
  if (typeSet.has(value) || /^[A-Z][A-Za-z0-9_]*$/.test(value)) return "type";
  if (normalizedLang === "py" || normalizedLang === "python") {
    if (["self", "cls"].includes(value)) return "variable";
  }
  return "plain";
}

export function highlightCode(code: string, lang: string): string {
  const token = /(^\s*#\s*(include|define|if|ifdef|ifndef|endif|pragma)\b.*$|#.*$|\/\/.*$|\/\*[\s\S]*?\*\/|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\s*\()|\b[A-Za-z_]\w*\b)/gm;
  let result = "";
  let cursor = 0;
  for (const match of code.matchAll(token)) {
    const value = match[0];
    const index = match.index ?? 0;
    result += escapeHtml(code.slice(cursor, index));
    if (/^\s*#\s*(include|define|if|ifdef|ifndef|endif|pragma)\b/.test(value)) {
      result += `<span class="code-token code-token--meta">${escapeHtml(value)}</span>`;
    } else if (/^(\/\/|\/\*|#)/.test(value)) {
      result += `<span class="code-token code-token--comment">${escapeHtml(value)}</span>`;
    } else if (/^("""|'''|["'`])/.test(value)) {
      result += `<span class="code-token code-token--string">${escapeHtml(value)}</span>`;
    } else if (/^\d/.test(value)) {
      result += `<span class="code-token code-token--number">${escapeHtml(value)}</span>`;
    } else if (/\b[A-Za-z_]\w*$/.test(value) && code.slice(index + value.length).match(/^\s*\(/)) {
      result += `<span class="code-token code-token--function">${escapeHtml(value)}</span>`;
    } else {
      const kind = classifyCodeIdentifier(value, lang);
      result += kind === "plain" ? escapeHtml(value) : `<span class="code-token code-token--${kind}">${escapeHtml(value)}</span>`;
    }
    cursor = index + value.length;
  }
  return result + escapeHtml(code.slice(cursor));
}

export function highlightedCode(block: Extract<PreviewBlock, { type: "code" }>): string {
  return highlightCode(block.code || "// code", block.lang);
}

function safeLinkHref(value: string): string {
  const href = value.trim();
  if (/^(https?:|mailto:|tel:)\/\//i.test(href) || /^mailto:|^tel:/i.test(href) || href.startsWith("/") || href.startsWith("#")) return escapeHtml(href);
  return "#";
}

export function renderInlineMarkdown(value: string): string {
  let html = escapeHtml(value);
  html = html.replace(/\[([^\]\n]+)\]\(([^\s)]+)\)/g, (_, label: string, href: string) => `<a href="${safeLinkHref(href)}" target="_blank" rel="noreferrer">${label}</a>`);
  html = html.replace(/\*\*\+\+([\s\S]+?)\+\+\*\*/g, "<strong><u>$1</u></strong>");
  html = html.replace(/\+\+\*\*([\s\S]+?)\*\*\+\+/g, "<u><strong>$1</strong></u>");
  html = html.replace(/~~\+\+([\s\S]+?)\+\+~~/g, "<del><u>$1</u></del>");
  html = html.replace(/\+\+~~([\s\S]+?)~~\+\+/g, "<u><del>$1</del></u>");
  html = html.replace(/\*\*~~([\s\S]+?)~~\*\*/g, "<strong><del>$1</del></strong>");
  html = html.replace(/~~\*\*([\s\S]+?)\*\*~~/g, "<del><strong>$1</strong></del>");
  html = html.replace(/\+\+([\s\S]+?)\+\+/g, "<u>$1</u>");
  html = html.replace(/~~([\s\S]+?)~~/g, "<del>$1</del>");
  html = html.replace(/\|\|([^|\n]+)\|\|/g, '<span class="preview-spoiler" tabindex="0">$1</span>');
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return html;
}

function getDirectiveLabel(line: string, fallback: string): string {
  const title = line.match(/title="([^"]+)"/)?.[1];
  const caption = line.match(/caption="([^"]+)"/)?.[1];
  const label = line.match(/label="([^"]+)"/)?.[1];
  const type = line.match(/type="([^"]+)"/)?.[1];
  return title || caption || label || type || fallback;
}

function cleanBlockquoteLine(line: string): string {
  return line.replace(/^>\s?/, "").trim();
}

function readDirectiveBody(lines: string[], index: number) {
  const content: string[] = [];
  while (index + 1 < lines.length && !lines[index + 1].trim().startsWith(":::")) {
    index += 1;
    content.push(lines[index]);
  }
  return { index, body: content.join("\n").trim() };
}

function parseMarkdownImage(line: string) {
  const match = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  return match ? { alt: match[1] || "Image", src: match[2] } : null;
}

function parseVideoDirectiveBody(body: string) {
  const src = body.match(/^src:\s*(.+)$/im)?.[1]?.trim();
  const note = body.match(/^note:\s*(.+)$/im)?.[1]?.trim() || "";
  if (!src || !/^https?:\/\//i.test(src)) return null;
  return { src, note };
}

function parseCalloutBlockBody(body: string, fallbackLabel: string) {
  const lines = body.split("\n");
  const titleLine = lines[0]?.match(/^title:\s*(.+)$/i);
  if (!titleLine) return { label: fallbackLabel, body: body.trim() };
  return { label: titleLine[1].trim() || fallbackLabel, body: lines.slice(1).join("\n").trim() };
}

function parseBlockFields(body: string) {
  const fields = new Map<string, string>();
  for (const line of body.split("\n")) {
    const match = line.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
    if (match) fields.set(match[1].toLowerCase(), match[2].trim());
  }
  return fields;
}

function normalizeGithubRepo(value: string) {
  const trimmed = value.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/^github\.com\//i, "").replace(/\.git$/i, "");
  const repo = trimmed.split(/[?#]/)[0].split("/").slice(0, 2).join("/");
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) ? repo : "";
}

function parseGithubDirective(line: string) {
  const repo = line.match(/^::github\{[^}]*repo="([^"]+)"[^}]*\}\s*$/)?.[1] || line.match(/^::github\{[^}]*repo='([^']+)'[^}]*\}\s*$/)?.[1];
  const normalized = repo ? normalizeGithubRepo(repo) : "";
  return normalized ? { repo: normalized, href: `https://github.com/${normalized}` } : null;
}

function parseGithubUrl(line: string) {
  const link = line.match(/^\[[^\]]+\]\((https?:\/\/github\.com\/[^)]+)\)$/i)?.[1];
  const value = link || line.replace(/\\:/g, ":");
  if (!/^https?:\/\/github\.com\//i.test(value) && !/^github\.com\//i.test(value)) return null;
  const repo = normalizeGithubRepo(value);
  return repo ? { repo, href: `https://github.com/${repo}` } : null;
}

function guessTabLang(label: string, body: string) {
  const value = `${label} ${body}`.toLowerCase();
  if (/\b(pnpm|npm|yarn|bun|npx|node|git|cd|mkdir|rm|cp|mv)\b/.test(value)) return "shell";
  if (/\b(import|export|const|let|function|return|=>)\b/.test(body)) return "ts";
  return "text";
}

function parseTabsBody(body: string) {
  const tabs: Array<{ label: string; body: string; lang: string }> = [];
  let current: { label: string; lines: string[] } | null = null;
  for (const line of body.split("\n")) {
    const inline = line.match(/^([^=\n]+?)\s*=\s*(.+)$/);
    if (inline && !current) {
      const label = inline[1].trim();
      const tabBody = inline[2].trim();
      tabs.push({ label, body: tabBody, lang: guessTabLang(label, tabBody) });
      continue;
    }
    const tab = line.match(/^\\?==\s+(.+)$/);
    if (tab) {
      if (current) {
        const tabBody = current.lines.join("\n").trim();
        tabs.push({ label: current.label, body: tabBody, lang: guessTabLang(current.label, tabBody) });
      }
      current = { label: tab[1].trim(), lines: [] };
      continue;
    }
    current?.lines.push(line);
  }
  if (current) {
    const tabBody = current.lines.join("\n").trim();
    tabs.push({ label: current.label, body: tabBody, lang: guessTabLang(current.label, tabBody) });
  }
  return tabs.filter((tab) => tab.label);
}

function parseMetricBlock(kind: "rating" | "stat", body: string) {
  const fields = parseBlockFields(body);
  const fallbackMax = kind === "rating" ? 5 : 100;
  const label = fields.get("label") || (kind === "rating" ? "Rating" : "Stat");
  const value = Number(fields.get("value") || 0);
  const max = Number(fields.get("max") || fallbackMax);
  const note = fields.get("note") || "";
  return { kind, label, value: Number.isFinite(value) ? value : 0, max: Number.isFinite(max) && max > 0 ? max : fallbackMax, note };
}

export function parsePreviewBlocks(markdown: string): PreviewBlock[] {
  const blocks: PreviewBlock[] = [];
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || /^<br\s*\/?>$/i.test(trimmed)) {
      if (blocks.length > 0) blocks.push({ type: "spacer" });
      continue;
    }
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || "text";
      const code: string[] = [];
      while (index + 1 < lines.length && !lines[index + 1].trim().startsWith("```")) {
        index += 1;
        code.push(lines[index]);
      }
      if (index + 1 < lines.length) index += 1;
      const codeText = code.join("\n");
      if (lang.toLowerCase() === "video") {
        const video = parseVideoDirectiveBody(codeText);
        if (video) {
          blocks.push({
            type: "video",
            label: video.note || "Video",
            body: video.src,
            embedSrc: video.src,
            title: video.note || "Video player",
            note: video.note,
          });
          continue;
        }
      }
      if (lang.toLowerCase() === "image") {
        const image = parseImageBlock(codeText);
        blocks.push({ type: "figure", label: image.caption, body: image.alt, src: image.src });
        continue;
      }
      if (lang.toLowerCase() === "github") {
        const repo = normalizeGithubRepo(codeText.split("\n").find((item) => item.trim()) || "");
        if (repo) blocks.push({ type: "github", repo, href: `https://github.com/${repo}` });
        continue;
      }
      if (lang.toLowerCase() === "tabs") {
        const tabs = parseTabsBody(codeText);
        if (tabs.length > 0) blocks.push({ type: "tabs", tabs });
        continue;
      }
      if (["note", "warning", "proof"].includes(lang.toLowerCase())) {
        const kind = lang.toLowerCase() as PreviewCalloutKind;
        const fallback = kind === "warning" ? "Warning" : kind === "proof" ? "Proof" : "Note";
        const callout = parseCalloutBlockBody(codeText, fallback);
        blocks.push({ type: "callout", kind, label: callout.label, body: callout.body });
        continue;
      }
      if (["rating", "stat"].includes(lang.toLowerCase())) {
        blocks.push({ type: "metric", ...parseMetricBlock(lang.toLowerCase() as "rating" | "stat", codeText) });
        continue;
      }
      if (lang.toLowerCase() === "fuwari-latex") {
        blocks.push({ type: "math", formula: codeText.trim() || "E = mc^2" });
        continue;
      }
      blocks.push({ type: "code", lang, code: codeText });
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }
    const callout = trimmed.match(/^>\s?\[!(NOTE|WARNING|IMPORTANT|TIP)\]\s*(.*)$/i);
    if (callout) {
      const content: string[] = [];
      while (lines[index + 1]?.trim().startsWith(">")) {
        index += 1;
        content.push(cleanBlockquoteLine(lines[index]));
      }
      const kind = callout[1].toUpperCase() === "WARNING" ? "warning" : callout[1].toUpperCase() === "IMPORTANT" ? "proof" : "note";
      const label = callout[2] || (kind === "warning" ? "Warning" : kind === "proof" ? "Proof" : "Note");
      blocks.push({ type: "callout", kind, label, body: content.join("\n").trim() });
      continue;
    }
    if (trimmed.startsWith(">")) {
      const content = [cleanBlockquoteLine(line)];
      while (lines[index + 1]?.trim().startsWith(">")) {
        index += 1;
        content.push(cleanBlockquoteLine(lines[index]));
      }
      blocks.push({ type: "quote", text: content.join("\n").trim() });
      continue;
    }
    const unorderedItem = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unorderedItem) {
      const items = [unorderedItem[1]];
      while (lines[index + 1]?.trim().match(/^[-*+]\s+(.+)$/)) {
        index += 1;
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ""));
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }
    const orderedItem = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedItem) {
      const items = [orderedItem[1]];
      while (lines[index + 1]?.trim().match(/^\d+\.\s+(.+)$/)) {
        index += 1;
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }
    const githubDirective = parseGithubDirective(trimmed);
    if (githubDirective) {
      blocks.push({ type: "github", ...githubDirective });
      continue;
    }
    const githubUrl = parseGithubUrl(trimmed);
    if (githubUrl) {
      blocks.push({ type: "github", ...githubUrl });
      continue;
    }
    if (trimmed.startsWith(":::tabs")) {
      const result = readDirectiveBody(lines, index);
      index = result.index;
      const tabs = parseTabsBody(result.body);
      if (tabs.length > 0) blocks.push({ type: "tabs", tabs });
      continue;
    }
    if (trimmed.startsWith(":::callout")) {
      const result = readDirectiveBody(lines, index);
      index = result.index;
      const type = trimmed.match(/type="([^"]+)"/)?.[1]?.toLowerCase();
      const kind = type === "warning" ? "warning" : type === "important" ? "proof" : "note";
      blocks.push({ type: "callout", kind, label: getDirectiveLabel(trimmed, "Note"), body: result.body });
      continue;
    }
    if (trimmed.startsWith(":::figure")) {
      const result = readDirectiveBody(lines, index);
      index = result.index;
      blocks.push({ type: "figure", label: getDirectiveLabel(trimmed, "Figure"), body: result.body });
      continue;
    }
    if (trimmed.startsWith(":::evidence")) {
      const result = readDirectiveBody(lines, index);
      index = result.index;
      blocks.push({ type: "callout", kind: "proof", label: getDirectiveLabel(trimmed, "Proof"), body: result.body });
      continue;
    }
    const image = parseMarkdownImage(trimmed);
    if (image) {
      const next = lines[index + 1]?.trim();
      const caption = next?.match(/^\*(.+)\*$/)?.[1];
      if (caption) index += 1;
      blocks.push({ type: "figure", label: caption || image.alt, body: image.alt, src: image.src });
      continue;
    }
    if (!trimmed.startsWith(":::")) {
      blocks.push({ type: "paragraph", text: trimmed });
    }
  }
  return blocks;
}
