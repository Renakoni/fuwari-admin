import type { AdminSettings, ContentEntry, ContentKind, ContentTab, EditorState } from "../types";
import { listMarkdownPostFiles, readFile } from "./github";
import { defaultFrontmatter, parsePost } from "./frontmatter";

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
    .toLowerCase();

  return `${contentPath.replace(/\/+$/g, "")}/${cleanSlug}/index.md`;
}

export function editorForNewPost(settings: AdminSettings, kind: ContentKind, slug: string, title: string): EditorState {
  const frontmatter = defaultFrontmatter(kind, title || slug || "Untitled");
  return {
    mode: "create",
    path: pathForSlug(settings.contentPath, slug),
    slug,
    kind,
    frontmatter,
    body: "这里开始写正文。\n\n## 第一节\n\n",
  };
}

export function editorForEntry(entry: ContentEntry): EditorState {
  return {
    mode: "edit",
    path: entry.path,
    sha: entry.sha,
    slug: entry.slug,
    kind: entry.kind,
    frontmatter: entry.frontmatter,
    body: entry.body,
  };
}

export function filterEntries(entries: ContentEntry[], tab: ContentTab): ContentEntry[] {
  if (tab === "all") return entries;
  if (tab === "draft") return entries.filter((entry) => entry.frontmatter.draft);
  return entries.filter((entry) => entry.kind === tab);
}

export function sortEntries(entries: ContentEntry[]): ContentEntry[] {
  return [...entries].sort((a, b) => b.frontmatter.published.localeCompare(a.frontmatter.published));
}

export async function loadContentEntries(settings: AdminSettings): Promise<ContentEntry[]> {
  const files = await listMarkdownPostFiles(settings);
  const entries = await Promise.all(
    files.map(async (file) => {
      const { content, sha } = await readFile(settings, file.path);
      const parsed = parsePost(content);
      const kind = classifyPost(parsed.frontmatter.category);

      return {
        path: file.path,
        sha,
        slug: slugFromPath(settings.contentPath, file.path),
        kind,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        raw: content,
      } satisfies ContentEntry;
    }),
  );

  return sortEntries(entries);
}
