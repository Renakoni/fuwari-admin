export type ContentKind = "blog" | "note";

export type AdminSettings = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  contentPath: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiUseProxy: boolean;
  aiRememberKey: boolean;
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

export type AIApplyMode = "append" | "replace" | "section";

export type AIQuickAction = {
  id: string;
  label: string;
  instruction: string;
};
