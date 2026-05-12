import type { ServerConfig } from "./config.js";
import { listMarkdownPostFiles, readFile, readFileOrNull, writeFile } from "./github.js";
import { parsePost, stringifyPost } from "./frontmatter.js";
import type { ContentEntry, ContentKind, EditorState } from "./types.js";

export function classifyPost(category: string): ContentKind {
  return category.trim().toLowerCase() === "notes" ? "note" : "blog";
}

export function slugFromPath(contentPath: string, path: string): string {
  const relative = path.replace(new RegExp(`^${contentPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?`), "");
  return relative.endsWith("/index.md")
    ? relative.replace(/\/index\.md$/, "")
    : relative.replace(/\.md$/, "");
}

export function pathForSlug(contentPath: string, slug: string): string {
  const cleanSlug = slug
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, "-")
    .replace(/\/{2,}/g, "/")
    .toLowerCase();

  return `${contentPath.replace(/\/+$/g, "")}/${cleanSlug}/index.md`;
}

export function sortEntries(entries: ContentEntry[]): ContentEntry[] {
  return [...entries].sort((a, b) => b.frontmatter.published.localeCompare(a.frontmatter.published));
}

function isEditorState(value: unknown): value is EditorState {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EditorState>;
  return (record.kind === "blog" || record.kind === "note")
    && typeof record.slug === "string"
    && record.slug.trim().length > 0
    && typeof record.body === "string"
    && !!record.frontmatter
    && typeof record.frontmatter === "object"
    && typeof record.frontmatter.title === "string"
    && record.frontmatter.title.trim().length > 0;
}

function publishCommitMessage(editor: EditorState): string {
  return `Publish post: ${editor.frontmatter.title.trim() || editor.slug}`;
}

export async function loadContentEntries(config: ServerConfig): Promise<ContentEntry[]> {
  const files = await listMarkdownPostFiles(config);
  const entries = await Promise.all(
    files.map(async (file) => {
      const { content, sha } = await readFile(config, file.path);
      const parsed = parsePost(content);
      const kind = classifyPost(parsed.frontmatter.category);

      return {
        path: file.path,
        sha,
        slug: slugFromPath(config.contentPath, file.path),
        kind,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        raw: content,
      } satisfies ContentEntry;
    }),
  );

  return sortEntries(entries);
}

export async function publishEditor(config: ServerConfig, body: unknown): Promise<{ path: string; sha: string; commitUrl: string }> {
  const editor = (body && typeof body === "object" && "editor" in body)
    ? (body as { editor?: unknown }).editor
    : body;

  if (!isEditorState(editor)) throw new Error("Invalid publish payload.");

  const path = pathForSlug(config.contentPath, editor.slug);
  const contentRoot = config.contentPath.replace(/\/+$/g, "");
  if (!path.startsWith(`${contentRoot}/`) || !path.endsWith("/index.md") || path.includes("..")) {
    throw new Error("Invalid publish path.");
  }

  const frontmatter = { ...editor.frontmatter, draft: false };
  const existing = await readFileOrNull(config, path);
  const result = await writeFile(
    config,
    path,
    stringifyPost(frontmatter, editor.body),
    publishCommitMessage({ ...editor, frontmatter }),
    existing?.sha,
  );

  return {
    path: result.content.path,
    sha: result.content.sha,
    commitUrl: result.commit.html_url,
  };
}
