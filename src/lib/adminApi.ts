import type { ContentEntry, EditorState } from "../types";

const API_BASE = import.meta.env.DEV ? "http://127.0.0.1:8787" : "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const payload = await response.json() as { error?: string };
      message = payload.error || message;
    } catch {
      message = await response.text() || message;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function loadContentEntries(): Promise<ContentEntry[]> {
  return apiFetch<ContentEntry[]>("/api/content");
}

export function listRemoteDrafts(): Promise<ContentEntry[]> {
  return apiFetch<ContentEntry[]>("/api/drafts");
}

export function saveRemoteDraft(editor: EditorState): Promise<{ path: string; sha: string; commitUrl: string }> {
  return apiFetch<{ path: string; sha: string; commitUrl: string }>("/api/drafts", {
    method: "PUT",
    body: JSON.stringify({ editor }),
  });
}
