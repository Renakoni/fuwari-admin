export type ServerConfig = {
  host: string;
  port: number;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  contentPath: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function loadConfig(): ServerConfig {
  return {
    host: process.env.HOST?.trim() || "127.0.0.1",
    port: Number(process.env.PORT || 8787),
    githubToken: requireEnv("GITHUB_TOKEN"),
    githubOwner: requireEnv("GITHUB_OWNER"),
    githubRepo: requireEnv("GITHUB_REPO"),
    githubBranch: process.env.GITHUB_BRANCH?.trim() || "main",
    contentPath: process.env.CONTENT_PATH?.trim() || "src/content/posts",
  };
}
