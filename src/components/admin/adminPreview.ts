export type PreviewBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "callout"; label: string; body: string }
  | { type: "figure"; label: string; body: string; src?: string }
  | { type: "gallery"; label: string; body: string; images?: string[] }
  | { type: "video"; label: string; body: string; href?: string }
  | { type: "evidence"; label: string; body: string };

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
  while (lines[index + 1] && !lines[index + 1].trim().startsWith(":::")) {
    index += 1;
    content.push(lines[index]);
  }
  return { index, body: content.join("\n").trim() };
}

function parseMarkdownImage(line: string) {
  const match = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  return match ? { alt: match[1] || "Image", src: match[2] } : null;
}

function parseMarkdownLink(line: string) {
  const match = line.trim().match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  return match ? { label: match[1], href: match[2] } : null;
}

export function parsePreviewBlocks(markdown: string): PreviewBlock[] {
  const blocks: PreviewBlock[] = [];
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || "text";
      const code: string[] = [];
      while (index + 1 < lines.length && !lines[index + 1].trim().startsWith("```")) {
        index += 1;
        code.push(lines[index]);
      }
      if (index + 1 < lines.length) index += 1;
      blocks.push({ type: "code", lang, code: code.join("\n") });
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", text: heading[2] });
      continue;
    }
    const callout = trimmed.match(/^>\s?\[!(NOTE|WARNING|IMPORTANT|TIP)\]\s*(.*)$/i);
    if (callout) {
      const content: string[] = [];
      while (lines[index + 1]?.trim().startsWith(">")) {
        index += 1;
        content.push(cleanBlockquoteLine(lines[index]));
      }
      const label = callout[2] || (callout[1].toUpperCase() === "WARNING" ? "Warning" : callout[1].toUpperCase() === "IMPORTANT" ? "Evidence" : "Note");
      blocks.push({ type: callout[1].toUpperCase() === "IMPORTANT" ? "evidence" : "callout", label, body: content.join("\n").trim() });
      continue;
    }
    if (trimmed.startsWith(":::callout")) {
      const result = readDirectiveBody(lines, index);
      index = result.index;
      blocks.push({ type: "callout", label: getDirectiveLabel(trimmed, "Note"), body: result.body });
      continue;
    }
    if (trimmed.startsWith(":::figure")) {
      const result = readDirectiveBody(lines, index);
      index = result.index;
      blocks.push({ type: "figure", label: getDirectiveLabel(trimmed, "Figure"), body: result.body });
      continue;
    }
    if (trimmed.startsWith(":::gallery")) {
      const result = readDirectiveBody(lines, index);
      index = result.index;
      blocks.push({ type: "gallery", label: getDirectiveLabel(trimmed, "Gallery"), body: result.body });
      continue;
    }
    if (trimmed.startsWith(":::evidence")) {
      const result = readDirectiveBody(lines, index);
      index = result.index;
      blocks.push({ type: "evidence", label: getDirectiveLabel(trimmed, "Evidence"), body: result.body });
      continue;
    }
    if (trimmed.startsWith("::video")) {
      const href = trimmed.match(/src="([^"]+)"/)?.[1];
      blocks.push({ type: "video", label: getDirectiveLabel(trimmed, "Video"), body: href || "Video embed", href });
      continue;
    }
    const galleryImages: string[] = [];
    let galleryIndex = index;
    while (parseMarkdownImage(lines[galleryIndex]?.trim() || "")) {
      galleryImages.push(parseMarkdownImage(lines[galleryIndex].trim())!.src);
      galleryIndex += 1;
    }
    if (galleryImages.length > 1) {
      const caption = lines[galleryIndex]?.trim().match(/^\*(.+)\*$/)?.[1];
      index = caption ? galleryIndex : galleryIndex - 1;
      blocks.push({ type: "gallery", label: caption || "Gallery", body: caption || `${galleryImages.length} images`, images: galleryImages });
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
    const link = parseMarkdownLink(trimmed);
    if (link && /^https?:\/\//.test(link.href)) {
      blocks.push({ type: "video", label: link.label, body: link.href, href: link.href });
      continue;
    }
    if (!trimmed.startsWith(":::")) {
      blocks.push({ type: "paragraph", text: trimmed });
    }
  }
  return blocks;
}
