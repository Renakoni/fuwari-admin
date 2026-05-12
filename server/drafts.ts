import type { ServerConfig } from "./config.js";
import { parsePost, stringifyPost } from "./frontmatter.js";
import { listDirectory, readFile, readFileOrNull, writeFile } from "./github.js";
import { sortEntries } from "./content.js";
import type { ContentEntry, ContentKind, EditorState } from "./types.js";

const DRAFT_ROOT = ".admin/drafts";

function cleanSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^-+|-+$/g, "") || "untitled";
}

function encodeDraftSlug(kind: ContentKind, slug: string): string {
  return `${kind}-${cleanSegment(slug).replace(/\//g, "~")}`;
}

function decodeDraftSlug(name: string): { kind: ContentKind; slug: string } {
  const kind: ContentKind = name.startsWith("note-") ? "note" : "blog";
  return { kind, slug: name.replace(/^(blog|note)-/, "").replace(/~/g, "/") };
}

function isEditorState(value: unknown): value is EditorState {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EditorState>;
  return (record.kind === "blog" || record.kind === "note")
    && typeof record.slug === "string"
    && typeof record.body === "string"
    && !!record.frontmatter
    && typeof record.frontmatter === "object";
}

export function draftPathForEditor(editor: EditorState): string {
  return `${DRAFT_ROOT}/${encodeDraftSlug(editor.kind, editor.slug)}/index.md`;
}

export function remoteDraftCommitMessage(editor: EditorState): string {
  const title = editor.frontmatter.title.trim() || editor.slug || "Untitled";
  return `Save admin draft: ${title}`;
}

export async function listRemoteDrafts(config: ServerConfig): Promise<ContentEntry[]> {
  let root;
  try {
    root = await listDirectory(config, DRAFT_ROOT);
  } catch (caught) {
    if (caught instanceof Error && caught.message.startsWith("GitHub 404:")) return [];
    throw caught;
  }

  const dirs = root.filter((item) => item.type === "dir");
  const drafts = await Promise.all(
    dirs.map(async (dir) => {
      const path = `${dir.path}/index.md`;
      const { content, sha } = await readFile(config, path);
      const parsed = parsePost(content);
      const { kind, slug } = decodeDraftSlug(dir.name);
      return {
        path,
        sha,
        slug,
        kind,
        frontmatter: { ...parsed.frontmatter, draft: true },
        body: parsed.body,
        raw: content,
      } satisfies ContentEntry;
    }),
  );

  return sortEntries(drafts);
}

export async function saveRemoteDraft(config: ServerConfig, body: unknown): Promise<{ path: string; sha: string; commitUrl: string }> {
  const editor = (body && typeof body === "object" && "editor" in body)
    ? (body as { editor?: unknown }).editor
    : body;

  if (!isEditorState(editor)) throw new Error("Invalid draft payload.");
  const path = draftPathForEditor(editor);
  if (!path.startsWith(`${DRAFT_ROOT}/`) || !path.endsWith("/index.md")) throw new Error("Invalid draft path.");

  const frontmatter = { ...editor.frontmatter, draft: true };
  const existing = await readFileOrNull(config, path);
  const result = await writeFile(
    config,
    path,
    stringifyPost(frontmatter, editor.body),
    remoteDraftCommitMessage({ ...editor, frontmatter }),
    existing?.sha,
  );

  return {
    path: result.content.path,
    sha: result.content.sha,
    commitUrl: result.commit.html_url,
  };
}
