import type { ServerConfig } from "./config.js";
import { listMarkdownPostFiles, readFile } from "./github.js";
import { parsePost } from "./frontmatter.js";
import type { ContentEntry, ContentKind } from "./types.js";

export function classifyPost(category: string): ContentKind {
  return category.trim().toLowerCase() === "notes" ? "note" : "blog";
}

export function slugFromPath(contentPath: string, path: string): string {
  const relative = path.replace(new RegExp(`^${contentPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?`), "");
  return relative.endsWith("/index.md")
    ? relative.replace(/\/index\.md$/, "")
    : relative.replace(/\.md$/, "");
}

export function sortEntries(entries: ContentEntry[]): ContentEntry[] {
  return [...entries].sort((a, b) => b.frontmatter.published.localeCompare(a.frontmatter.published));
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
