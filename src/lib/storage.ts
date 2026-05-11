import type { AdminSettings, EditorState } from "../types";

const SETTINGS_KEY = "fuwari-admin:settings";
const EDITOR_KEY = "fuwari-admin:editor";

export const defaultSettings: AdminSettings = {
  token: "",
  owner: "",
  repo: "",
  branch: "main",
  contentPath: "src/content/posts",
  aiBaseUrl: "",
  aiApiKey: "",
  aiModel: "",
  aiUseProxy: true,
  aiRememberKey: false,
};

export function loadSettings(): AdminSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings;

  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AdminSettings): void {
  const persisted = settings.aiRememberKey ? settings : { ...settings, aiApiKey: "" };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(persisted));
}

export function loadEditorDraft(): EditorState | null {
  const raw = localStorage.getItem(EDITOR_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as EditorState;
  } catch {
    return null;
  }
}

export function saveEditorDraft(editor: EditorState | null): void {
  if (!editor) {
    localStorage.removeItem(EDITOR_KEY);
    return;
  }

  localStorage.setItem(EDITOR_KEY, JSON.stringify(editor));
}
