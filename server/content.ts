import type { ServerConfig } from "./config.js";
import { draftAssetCommitOperations, imageCommitOperations, prepareImages, rewriteFrontmatterImage, rewriteImageSources } from "./assets.js";
import { commitFiles, listMarkdownPostFiles, readFile } from "./github.js";
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
  const operations = [
    ...imageCommitOperations(assetRoot, images),
    ...draftAssets,
    {
      path,
      content: stringifyPost(rewrittenFrontmatter.frontmatter, rewritten.body),
    },
    ...(editor.remoteDraftPath ? [{ path: editor.remoteDraftPath, delete: true as const }] : []),
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
