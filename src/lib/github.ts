import type { AdminSettings } from "../types";

type GitHubFile = {
  type: "file";
  name: string;
  path: string;
  sha: string;
  download_url: string | null;
};

type GitHubDirectory = {
  type: "dir";
  name: string;
  path: string;
  sha: string;
};

type GitHubContent = GitHubFile | GitHubDirectory;

type GitHubFileResponse = {
  content: string;
  encoding: "base64";
  sha: string;
};

const API_BASE = "https://api.github.com";

function authHeaders(settings: AdminSettings): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${settings.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function githubFetch<T>(settings: AdminSettings, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(settings),
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
  const binary = atob(content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export async function listDirectory(settings: AdminSettings, path: string): Promise<GitHubContent[]> {
  const encodedPath = encodePath(path);
  const result = await githubFetch<GitHubContent[] | GitHubContent>(
    settings,
    `/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}?ref=${encodeURIComponent(settings.branch)}`,
  );

  return Array.isArray(result) ? result : [result];
}

export async function readFile(settings: AdminSettings, path: string): Promise<{ sha: string; content: string }> {
  const encodedPath = encodePath(path);
  const file = await githubFetch<GitHubFileResponse>(
    settings,
    `/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}?ref=${encodeURIComponent(settings.branch)}`,
  );

  return {
    sha: file.sha,
    content: decodeBase64(file.content),
  };
}

export async function readFileOrNull(settings: AdminSettings, path: string): Promise<{ sha: string; content: string } | null> {
  try {
    return await readFile(settings, path);
  } catch (caught) {
    if (caught instanceof Error && caught.message.startsWith("GitHub 404:")) return null;
    throw caught;
  }
}

export async function listMarkdownPostFiles(settings: AdminSettings): Promise<GitHubFile[]> {
  const root = await listDirectory(settings, settings.contentPath);
  const files: GitHubFile[] = [];

  for (const item of root) {
    if (item.type === "file" && item.name.endsWith(".md")) {
      files.push(item);
    }

    if (item.type === "dir") {
      const children = await listDirectory(settings, item.path);
      const indexFile = children.find(
        (child): child is GitHubFile => child.type === "file" && child.name === "index.md",
      );
      if (indexFile) files.push(indexFile);
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function writeFile(
  settings: AdminSettings,
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<{ content: { path: string; sha: string }; commit: { html_url: string } }> {
  const encodedPath = encodePath(path);
  return githubFetch<{ content: { path: string; sha: string }; commit: { html_url: string } }>(
    settings,
    `/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: encodeBase64(content),
        branch: settings.branch,
        sha,
      }),
    },
  );
}
