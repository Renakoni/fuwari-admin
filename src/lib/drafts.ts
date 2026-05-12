import type { AdminSettings, ContentEntry, ContentKind, EditorState } from "../types";
import { editorForNewPost } from "./content";
import { listDirectory, readFile } from "./github";
import { parsePost } from "./frontmatter";

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

export function draftIdForEditor(editor: EditorState): string {
  return encodeDraftSlug(editor.kind, editor.slug);
}

export function draftPathForEditor(editor: EditorState): string {
  return `${DRAFT_ROOT}/${draftIdForEditor(editor)}/index.md`;
}

export function remoteDraftCommitMessage(editor: EditorState): string {
  const title = editor.frontmatter.title.trim() || editor.slug || "Untitled";
  return `Save admin draft: ${title}`;
}

export async function listRemoteDrafts(settings: AdminSettings): Promise<ContentEntry[]> {
  let root;
  try {
    root = await listDirectory(settings, DRAFT_ROOT);
  } catch (caught) {
    if (caught instanceof Error && caught.message.startsWith("GitHub 404:")) return [];
    throw caught;
  }

  const dirs = root.filter((item) => item.type === "dir");
  const drafts = await Promise.all(
    dirs.map(async (dir) => {
      const path = `${dir.path}/index.md`;
      const { content, sha } = await readFile(settings, path);
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

  return drafts.sort((a, b) => b.frontmatter.published.localeCompare(a.frontmatter.published));
}

export function editorForRemoteDraft(settings: AdminSettings, entry: ContentEntry): EditorState {
  return {
    ...editorForNewPost(settings, entry.kind, entry.slug, entry.frontmatter.title),
    frontmatter: entry.frontmatter,
    body: entry.body,
  };
}
