import type { ServerConfig } from "./config.js";
import type { GitHubContent, GitHubFile } from "./types.js";

type GitHubFileResponse = {
  content: string;
  encoding: "base64";
  sha: string;
};

const API_BASE = "https://api.github.com";

function encodePath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function headers(config: ServerConfig): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${config.githubToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubFetch<T>(config: ServerConfig, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers(config),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub ${response.status}: ${text || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function decodeBase64(content: string): string {
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

function encodeBase64(content: string): string {
  return Buffer.from(content, "utf8").toString("base64");
}

export async function listDirectory(config: ServerConfig, path: string): Promise<GitHubContent[]> {
  const encodedPath = encodePath(path);
  const result = await githubFetch<GitHubContent[] | GitHubContent>(
    config,
    `/repos/${config.githubOwner}/${config.githubRepo}/contents/${encodedPath}?ref=${encodeURIComponent(config.githubBranch)}`,
  );

  return Array.isArray(result) ? result : [result];
}

export async function readFile(config: ServerConfig, path: string): Promise<{ sha: string; content: string }> {
  const file = await readBase64File(config, path);

  return {
    sha: file.sha,
    content: decodeBase64(file.content),
  };
}

export async function readBase64File(config: ServerConfig, path: string): Promise<{ sha: string; content: string }> {
  const encodedPath = encodePath(path);
  const file = await githubFetch<GitHubFileResponse>(
    config,
    `/repos/${config.githubOwner}/${config.githubRepo}/contents/${encodedPath}?ref=${encodeURIComponent(config.githubBranch)}`,
  );

  return {
    sha: file.sha,
    content: file.content.replace(/\n/g, ""),
  };
}

export async function readFileOrNull(config: ServerConfig, path: string): Promise<{ sha: string; content: string } | null> {
  try {
    return await readFile(config, path);
  } catch (caught) {
    if (caught instanceof Error && caught.message.startsWith("GitHub 404:")) return null;
    throw caught;
  }
}

export async function listMarkdownPostFiles(config: ServerConfig): Promise<GitHubFile[]> {
  const root = await listDirectory(config, config.contentPath);
  const files: GitHubFile[] = [];

  for (const item of root) {
    if (item.type === "file" && item.name.endsWith(".md")) {
      files.push(item);
    }

    if (item.type === "dir") {
      const children = await listDirectory(config, item.path);
      const indexFile = children.find(
        (child): child is GitHubFile => child.type === "file" && child.name === "index.md",
      );
      if (indexFile) files.push(indexFile);
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function writeFile(
  config: ServerConfig,
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<{ content: { path: string; sha: string }; commit: { html_url: string } }> {
  return writeBase64File(config, path, encodeBase64(content), message, sha);
}

export async function writeBase64File(
  config: ServerConfig,
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<{ content: { path: string; sha: string }; commit: { html_url: string } }> {
  const encodedPath = encodePath(path);
  return githubFetch<{ content: { path: string; sha: string }; commit: { html_url: string } }>(
    config,
    `/repos/${config.githubOwner}/${config.githubRepo}/contents/${encodedPath}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content,
        branch: config.githubBranch,
        sha,
      }),
    },
  );
}
