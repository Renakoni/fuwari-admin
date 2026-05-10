export type ContentKind = "blog" | "note";

export type AdminSettings = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  contentPath: string;
};

export type PostFrontmatter = {
  title: string;
  published: string;
  updated?: string;
  draft: boolean;
  description: string;
  image: string;
  tags: string[];
  category: string;
  notebook: string;
  lang: string;
};

export type ContentEntry = {
  path: string;
  sha: string;
  slug: string;
  kind: ContentKind;
  frontmatter: PostFrontmatter;
  body: string;
  raw: string;
};

export type EditorState = {
  mode: "create" | "edit";
  path: string;
  sha?: string;
  slug: string;
  kind: ContentKind;
  frontmatter: PostFrontmatter;
  body: string;
};

export type ContentTab = "all" | "blog" | "note" | "draft";
