import matter from "gray-matter";
import type { ContentKind, PostFrontmatter } from "../types";

function dateOnly(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function defaultFrontmatter(kind: ContentKind, title = "Untitled"): PostFrontmatter {
  return {
    title,
    published: new Date().toISOString().slice(0, 10),
    updated: "",
    draft: true,
    description: "",
    image: "",
    tags: [],
    category: kind === "note" ? "Notes" : "",
    notebook: kind === "note" ? "Misc" : "",
    lang: "zh_CN",
  };
}

export function normalizeFrontmatter(input: Record<string, unknown>, kind?: ContentKind): PostFrontmatter {
  const inferredKind = kind ?? (String(input.category ?? "").toLowerCase() === "notes" ? "note" : "blog");
  const defaults = defaultFrontmatter(inferredKind);
  const tags = Array.isArray(input.tags) ? input.tags.map(String) : [];

  return {
    ...defaults,
    title: String(input.title ?? defaults.title),
    published: dateOnly(input.published) || defaults.published,
    updated: dateOnly(input.updated),
    draft: Boolean(input.draft ?? defaults.draft),
    description: String(input.description ?? ""),
    image: String(input.image ?? ""),
    tags,
    category: input.category == null ? defaults.category : String(input.category),
    notebook: String(input.notebook ?? defaults.notebook),
    lang: String(input.lang ?? defaults.lang),
  };
}

export function parsePost(raw: string) {
  const parsed = matter(raw);
  const frontmatter = normalizeFrontmatter(parsed.data);
  return {
    frontmatter,
    body: parsed.content.trimStart(),
  };
}

export function stringifyPost(frontmatter: PostFrontmatter, body: string) {
  const data: Record<string, unknown> = {
    title: frontmatter.title,
    published: frontmatter.published,
  };

  if (frontmatter.updated) data.updated = frontmatter.updated;
  if (frontmatter.description) data.description = frontmatter.description;
  if (frontmatter.image) data.image = frontmatter.image;
  data.tags = frontmatter.tags;
  data.category = frontmatter.category;
  if (frontmatter.notebook) data.notebook = frontmatter.notebook;
  data.draft = frontmatter.draft;
  if (frontmatter.lang) data.lang = frontmatter.lang;

  return matter.stringify(body.trimStart(), data);
}
