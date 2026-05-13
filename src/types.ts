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
  remoteDraftPath?: string;
  remoteDraftSha?: string;
  publishedPath?: string;
  publishedSha?: string;
};

export type ImageUploadRole = "cover" | "content";

export type ImageUpload = {
  src: string;
  name: string;
  size: number;
  type: string;
  data: string;
  role?: ImageUploadRole;
};

export type EditorSaveResult = {
  path: string;
  sha: string;
  commitUrl: string;
  body?: string;
  frontmatter?: PostFrontmatter;
  assets?: string[];
};

export type ContentTab = "all" | "blog" | "note" | "draft";

export type AIApplyMode = "append" | "replace" | "section";

export type AIQuickAction = {
  id: string;
  label: string;
  instruction: string;
};
