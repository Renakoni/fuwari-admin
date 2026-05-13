import type { ServerConfig } from "./config.js";
import { parsePost, stringifyPost } from "./frontmatter.js";
import { prepareImages, rewriteFrontmatterImage, rewriteImageSources, uploadImages } from "./assets.js";
import { deleteFile, listDirectory, readFile, readFileOrNull, writeFile } from "./github.js";
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

function isDeleteDraftPayload(value: unknown): value is { path: string; sha: string; title?: string } {
  if (!value || typeof value !== "object") return false;
  const record = value as { path?: unknown; sha?: unknown; title?: unknown };
  return typeof record.path === "string"
    && typeof record.sha === "string"
    && (record.title === undefined || typeof record.title === "string");
}

function validateDraftPath(path: string): void {
  if (!path.startsWith(`${DRAFT_ROOT}/`) || !path.endsWith("/index.md") || path.includes("..")) {
    throw new Error("Invalid draft path.");
  }
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

export async function deleteRemoteDraft(config: ServerConfig, body: unknown): Promise<{ path: string; commitUrl: string }> {
  if (!isDeleteDraftPayload(body)) throw new Error("Invalid draft delete payload.");
  const path = body.path.trim();
  const sha = body.sha.trim();
  if (!sha) throw new Error("Invalid draft sha.");
  validateDraftPath(path);

  const title = body.title?.trim() || path.replace(`${DRAFT_ROOT}/`, "").replace(/\/index\.md$/, "");
  const result = await deleteFile(config, path, `Delete admin draft: ${title}`, sha);
  return { path, commitUrl: result.commit.html_url };
}

export async function saveRemoteDraft(config: ServerConfig, body: unknown): Promise<{ path: string; sha: string; commitUrl: string; body: string; frontmatter: EditorState["frontmatter"]; assets: string[] }> {
  const payload = body && typeof body === "object" && "editor" in body ? body as { editor?: unknown; images?: unknown } : { editor: body, images: [] };
  const editor = payload.editor;

  if (!isEditorState(editor)) throw new Error("Invalid draft payload.");
  const path = draftPathForEditor(editor);
  validateDraftPath(path);

  const images = await prepareImages(payload.images);
  const assetRoot = path.replace(/\/index\.md$/, "/assets");
  const frontmatter = { ...editor.frontmatter, draft: true };
  const message = remoteDraftCommitMessage({ ...editor, frontmatter });
  await uploadImages(config, assetRoot, images, message);
  const rewritten = rewriteImageSources(editor.body, images);
  const rewrittenFrontmatter = rewriteFrontmatterImage(frontmatter, images);
  const assets = [...rewritten.assets, ...rewrittenFrontmatter.assets];
  const existing = await readFileOrNull(config, path);
  const result = await writeFile(
    config,
    path,
    stringifyPost(rewrittenFrontmatter.frontmatter, rewritten.body),
    message,
    existing?.sha,
  );

  return {
    path: result.content.path,
    sha: result.content.sha,
    commitUrl: result.commit.html_url,
    body: rewritten.body,
    frontmatter: rewrittenFrontmatter.frontmatter,
    assets,
  };
}
