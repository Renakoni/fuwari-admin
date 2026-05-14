import type { ServerConfig } from "./config.js";
import { deleteDraftAssetOperations, draftAssetCommitOperations, imageCommitOperations, prepareImages, rewriteFrontmatterImage, rewriteImageSources } from "./assets.js";
import { commitFiles, listDirectory, listMarkdownPostFiles, readFile, type MultiFileCommitOperation } from "./github.js";
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

type DeleteContentPayload = {
  path: string;
  sha: string;
  title?: string;
};

function isDeleteContentPayload(value: unknown): value is DeleteContentPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DeleteContentPayload>;
  return typeof record.path === "string"
    && record.path.trim().length > 0
    && typeof record.sha === "string"
    && record.sha.trim().length > 0
    && (record.title === undefined || typeof record.title === "string");
}

function validatePublishedPath(config: ServerConfig, path: string): void {
  const contentRoot = config.contentPath.replace(/\/+$/g, "");
  if (!path.startsWith(`${contentRoot}/`) || !path.endsWith("/index.md") || path.includes("..")) {
    throw new Error("Invalid content delete path.");
  }
}

async function collectAssetDeletes(config: ServerConfig, assetRoot: string): Promise<MultiFileCommitOperation[]> {
  const entries = await listDirectory(config, assetRoot).catch((caught) => {
    if (caught instanceof Error && caught.message.startsWith("GitHub 404:")) return [];
    throw caught;
  });
  const operations: MultiFileCommitOperation[] = [];
  for (const entry of entries) {
    if (entry.type === "file") {
      operations.push({ path: entry.path, delete: true });
      continue;
    }
    operations.push(...await collectAssetDeletes(config, entry.path));
  }
  return operations;
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

export async function deletePublishedContent(config: ServerConfig, body: unknown): Promise<{ path: string; deleted: string[]; commitUrl: string }> {
  if (!isDeleteContentPayload(body)) throw new Error("Invalid content delete payload.");
  const path = body.path.trim();
  const sha = body.sha.trim();
  validatePublishedPath(config, path);

  const current = await readFile(config, path);
  if (current.sha !== sha) {
    throw new Error("Published content changed on GitHub. Refresh before deleting.");
  }

  const assetRoot = path.replace(/\/index\.md$/, "/assets");
  const assetDeletes = await collectAssetDeletes(config, assetRoot);
  const operations: MultiFileCommitOperation[] = [
    { path, delete: true },
    ...assetDeletes,
  ];
  const title = body.title?.trim() || path.replace(/^.*\//, "").replace(/\.md$/, "") || "Untitled";
  const result = await commitFiles(config, `Delete published post: ${title}`, operations);
  return {
    path,
    deleted: operations.map((operation) => operation.path),
    commitUrl: result.commit.html_url,
  };
}

export async function publishEditor(config: ServerConfig, body: unknown): Promise<{ path: string; sha: string; commitUrl: string; body: string; frontmatter: EditorState["frontmatter"]; assets: string[] }> {
  const payload = body && typeof body === "object" && "editor" in body ? body as { editor?: unknown; images?: unknown } : { editor: body, images: [] };
  const editor = payload.editor;

  if (!isEditorState(editor)) throw new Error("Invalid publish payload.");

  const path = pathForSlug(config.contentPath, editor.slug);
  const contentRoot = config.contentPath.replace(/\/+$/g, "");
  if (!path.startsWith(`${contentRoot}/`) || !path.endsWith("/index.md") || path.includes("..")) {
    throw new Error("Invalid publish path.");
  }

  const images = await prepareImages(payload.images);
  const assetRoot = path.replace(/\/index\.md$/, "/assets");
  const frontmatter = { ...editor.frontmatter, draft: false };
  const message = publishCommitMessage({ ...editor, frontmatter });
  const rewritten = rewriteImageSources(editor.body, images);
  const rewrittenFrontmatter = rewriteFrontmatterImage(frontmatter, images);
  const assets = [...rewritten.assets, ...rewrittenFrontmatter.assets];
  const draftAssets = await draftAssetCommitOperations(config, editor, rewritten.body, rewrittenFrontmatter.frontmatter.image, assetRoot, assets);
  const draftAssetDeletes = editor.remoteDraftPath ? await deleteDraftAssetOperations(config, editor) : [];
  const operations = [
    ...imageCommitOperations(assetRoot, images),
    ...draftAssets,
    {
      path,
      content: stringifyPost(rewrittenFrontmatter.frontmatter, rewritten.body),
    },
    ...(editor.remoteDraftPath ? [{ path: editor.remoteDraftPath, delete: true as const }, ...draftAssetDeletes] : []),
  ];
  const result = await commitFiles(config, message, operations);

  return {
    path,
    sha: result.commit.sha,
    commitUrl: result.commit.html_url,
    body: rewritten.body,
    frontmatter: rewrittenFrontmatter.frontmatter,
    assets,
  };
}
