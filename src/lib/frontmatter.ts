import { dump, load } from "js-yaml";
import type { ContentKind, PostFrontmatter } from "../types";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function dateOnly(value: unknown): string {
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

export type ParsedPost = {
  frontmatter: PostFrontmatter;
  body: string;
};

export function parsePost(raw: string): ParsedPost {
  const match = raw.match(FRONTMATTER_PATTERN);
  const data: Record<string, unknown> = match ? asRecord(load(match[1])) : {};
  const body: string = match ? raw.slice(match[0].length) : raw;
  return {
    frontmatter: normalizeFrontmatter(data),
    body: body.trimStart(),
  };
}

export function stringifyPost(frontmatter: PostFrontmatter, body: string): string {
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

  const yaml = dump(data, { lineWidth: -1, noRefs: true }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trimStart()}`;
}
