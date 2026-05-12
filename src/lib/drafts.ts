import type { ContentEntry, ContentKind, EditorSaveResult, EditorState, ImageUpload } from "../types";
import { editorForNewPost } from "./content";
import { listRemoteDrafts as listRemoteDraftsFromApi, saveRemoteDraft as saveRemoteDraftToApi } from "./adminApi";

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

export async function listRemoteDrafts(): Promise<ContentEntry[]> {
  return listRemoteDraftsFromApi();
}

export function saveRemoteDraft(editor: EditorState, images: ImageUpload[] = []): Promise<EditorSaveResult> {
  return saveRemoteDraftToApi(editor, images);
}

export function editorForRemoteDraft(entry: ContentEntry): EditorState {
  return {
    ...editorForNewPost(entry.kind, entry.slug, entry.frontmatter.title),
    frontmatter: entry.frontmatter,
    body: entry.body,
  };
}
