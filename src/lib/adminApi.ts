import type { ContentEntry, EditorSaveResult, EditorState, ImageUpload } from "../types";

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

export function saveRemoteDraft(editor: EditorState, images: ImageUpload[] = []): Promise<EditorSaveResult> {
  return apiFetch<EditorSaveResult>("/api/drafts", {
    method: "PUT",
    body: JSON.stringify({ editor, images }),
  });
}

export function deleteRemoteDraft(path: string, sha: string, title?: string): Promise<{ path: string; commitUrl: string }> {
  return apiFetch<{ path: string; commitUrl: string }>("/api/drafts", {
    method: "DELETE",
    body: JSON.stringify({ path, sha, title }),
  });
}

export function publishContent(editor: EditorState, images: ImageUpload[] = []): Promise<EditorSaveResult> {
  return apiFetch<EditorSaveResult>("/api/content", {
    method: "PUT",
    body: JSON.stringify({ editor, images }),
  });
}

export function deletePublishedContent(path: string, sha: string, title?: string): Promise<{ path: string; deleted: string[]; commitUrl: string }> {
  return apiFetch<{ path: string; deleted: string[]; commitUrl: string }>("/api/content", {
    method: "DELETE",
    body: JSON.stringify({ path, sha, title }),
  });
}
