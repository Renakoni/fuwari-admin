import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  CheckCircle2,
  FilePenLine,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { AdminSettings, ContentEntry, ContentKind, ContentTab, EditorState, PostFrontmatter } from "./types";
import { editorForEntry, editorForNewPost, filterEntries, loadContentEntries } from "./lib/content";
import { stringifyPost } from "./lib/frontmatter";
import { loadEditorDraft, loadSettings, saveEditorDraft, saveSettings } from "./lib/storage";
import { writeFile } from "./lib/github";

const tabs: Array<{ key: ContentTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "blog", label: "Blog" },
  { key: "note", label: "Notes" },
  { key: "draft", label: "Drafts" },
];

function emptyCounts() {
  return { all: 0, blog: 0, note: 0, draft: 0 } satisfies Record<ContentTab, number>;
}

function hasSettings(settings: AdminSettings) {
  return Boolean(settings.token && settings.owner && settings.repo && settings.branch && settings.contentPath);
}

function splitTags(tags: string) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function tagsToText(tags: string[]) {
  return tags.join(", ");
}

function field<K extends keyof PostFrontmatter>(
  frontmatter: PostFrontmatter,
  key: K,
  value: PostFrontmatter[K],
): PostFrontmatter {
  return { ...frontmatter, [key]: value };
}

export default function App() {
  const [settings, setSettings] = useState<AdminSettings>(() => loadSettings());
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(() => loadEditorDraft());
  const [activeTab, setActiveTab] = useState<ContentTab>("all");
  const [query, setQuery] = useState("");
  const [newKind, setNewKind] = useState<ContentKind>("blog");
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "neutral" | "good" | "bad"; text: string }>({
    tone: "neutral",
    text: "Connect a GitHub repository to begin.",
  });

  useEffect(() => {
    saveEditorDraft(editor);
  }, [editor]);

  const counts = useMemo(() => {
    const next = emptyCounts();
    next.all = entries.length;
    next.blog = entries.filter((entry) => entry.kind === "blog").length;
    next.note = entries.filter((entry) => entry.kind === "note").length;
    next.draft = entries.filter((entry) => entry.frontmatter.draft).length;
    return next;
  }, [entries]);

  const visibleEntries = useMemo(() => {
    const filtered = filterEntries(entries, activeTab);
    const needle = query.trim().toLowerCase();
    if (!needle) return filtered;

    return filtered.filter((entry) => {
      const haystack = [
        entry.slug,
        entry.path,
        entry.frontmatter.title,
        entry.frontmatter.category,
        entry.frontmatter.notebook,
        entry.frontmatter.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [activeTab, entries, query]);

  function updateSettings(patch: Partial<AdminSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function persistSettings() {
    saveSettings(settings);
    setStatus({ tone: "good", text: "Settings saved locally in this browser." });
  }

  async function refreshEntries() {
    if (!hasSettings(settings)) {
      setStatus({ tone: "bad", text: "Fill token, owner, repo, branch, and content path first." });
      return;
    }

    setIsLoading(true);
    setStatus({ tone: "neutral", text: "Reading Markdown files from GitHub..." });
    try {
      saveSettings(settings);
      const loaded = await loadContentEntries(settings);
      setEntries(loaded);
      setStatus({ tone: "good", text: `Loaded ${loaded.length} Markdown entries from ${settings.owner}/${settings.repo}.` });
    } catch (error) {
      setStatus({ tone: "bad", text: error instanceof Error ? error.message : "Failed to load content." });
    } finally {
      setIsLoading(false);
    }
  }

  function createDraft() {
    if (!newSlug.trim()) {
      setStatus({ tone: "bad", text: "Give the new entry a slug first." });
      return;
    }

    const next = editorForNewPost(settings, newKind, newSlug, newTitle);
    setEditor(next);
    setNewSlug("");
    setNewTitle("");
    setStatus({ tone: "neutral", text: `Prepared ${next.path}. Save will create a GitHub commit.` });
  }

  function updateFrontmatter(patch: Partial<PostFrontmatter>) {
    setEditor((current) => (current ? { ...current, frontmatter: { ...current.frontmatter, ...patch } } : current));
  }

  async function savePost() {
    if (!editor) return;
    if (!hasSettings(settings)) {
      setStatus({ tone: "bad", text: "Complete GitHub settings before saving." });
      return;
    }

    const content = stringifyPost(editor.frontmatter, editor.body);
    const message = editor.mode === "create" ? `Add post: ${editor.frontmatter.title}` : `Update post: ${editor.frontmatter.title}`;

    setIsSaving(true);
    setStatus({ tone: "neutral", text: "Creating GitHub commit..." });
    try {
      const result = await writeFile(settings, editor.path, content, message, editor.sha);
      setEditor({ ...editor, mode: "edit", sha: result.content.sha });
      setStatus({ tone: "good", text: `Committed ${editor.path}.` });
      await refreshEntries();
    } catch (error) {
      setStatus({ tone: "bad", text: error instanceof Error ? error.message : "Save failed." });
    } finally {
      setIsSaving(false);
    }
  }

  const selectedPath = editor?.path;

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow"><Sparkles size={16} /> Fuwari Admin / v1 local</p>
          <h1>Personal publishing console.</h1>
          <p className="hero-copy">Git-backed writing for Blog and Notes. No database, no VPS file manager, just Markdown commits.</p>
        </div>
        <div className={`status-pill status-pill--${status.tone}`}>
          {status.tone === "bad" ? <ShieldAlert size={16} /> : status.tone === "good" ? <CheckCircle2 size={16} /> : <GitBranch size={16} />}
          <span>{status.text}</span>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="control-rail">
          <section className="panel settings-panel">
            <div className="panel-title"><Settings2 size={17} /> Repository</div>
            <label>
              <span>GitHub token</span>
              <input value={settings.token} type="password" placeholder="github_pat_..." onChange={(event) => updateSettings({ token: event.target.value })} />
            </label>
            <div className="two-col">
              <label>
                <span>Owner</span>
                <input value={settings.owner} placeholder="Renakoni" onChange={(event) => updateSettings({ owner: event.target.value })} />
              </label>
              <label>
                <span>Repo</span>
                <input value={settings.repo} placeholder="fuwari" onChange={(event) => updateSettings({ repo: event.target.value })} />
              </label>
            </div>
            <div className="two-col">
              <label>
                <span>Branch</span>
                <input value={settings.branch} onChange={(event) => updateSettings({ branch: event.target.value })} />
              </label>
              <label>
                <span>Content path</span>
                <input value={settings.contentPath} onChange={(event) => updateSettings({ contentPath: event.target.value })} />
              </label>
            </div>
            <div className="button-row">
              <button className="button button--ghost" onClick={persistSettings}>Save settings</button>
              <button className="button button--primary" onClick={refreshEntries} disabled={isLoading}>
                {isLoading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} Load content
              </button>
            </div>
          </section>

          <section className="panel new-panel">
            <div className="panel-title"><Plus size={17} /> New file</div>
            <div className="segmented">
              <button className={newKind === "blog" ? "active" : ""} onClick={() => setNewKind("blog")}>Blog</button>
              <button className={newKind === "note" ? "active" : ""} onClick={() => setNewKind("note")}>Note</button>
            </div>
            <label>
              <span>Slug</span>
              <input value={newSlug} placeholder="my-new-post" onChange={(event) => setNewSlug(event.target.value)} />
            </label>
            <label>
              <span>Title</span>
              <input value={newTitle} placeholder="一篇新文章" onChange={(event) => setNewTitle(event.target.value)} />
            </label>
            <button className="button button--primary button--full" onClick={createDraft}><FilePenLine size={16} /> Prepare draft</button>
          </section>
        </aside>

        <section className="content-column">
          <div className="content-toolbar">
            <div className="tabs">
              {tabs.map((tab) => (
                <button key={tab.key} className={activeTab === tab.key ? "active" : ""} onClick={() => setActiveTab(tab.key)}>
                  {tab.label}<span>{counts[tab.key]}</span>
                </button>
              ))}
            </div>
            <label className="search-box">
              <Search size={16} />
              <input value={query} placeholder="Search title, slug, tag..." onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>

          <div className="entry-list">
            {visibleEntries.map((entry) => (
              <button
                key={entry.path}
                className={`entry-card ${selectedPath === entry.path ? "entry-card--active" : ""}`}
                onClick={() => setEditor(editorForEntry(entry))}
              >
                <span className="entry-kind">{entry.kind === "note" ? "NOTE" : "BLOG"}</span>
                <strong>{entry.frontmatter.title}</strong>
                <em>{entry.slug}</em>
                <div className="entry-meta">
                  <span>{entry.frontmatter.published}</span>
                  {entry.frontmatter.draft && <span className="draft-dot">Draft</span>}
                  {entry.frontmatter.category && <span>{entry.frontmatter.category}</span>}
                </div>
              </button>
            ))}
            {visibleEntries.length === 0 && <div className="empty-state"><BookOpen size={24} />No matching entries loaded yet.</div>}
          </div>
        </section>

        <section className="editor-column">
          {editor ? (
            <>
              <div className="editor-header">
                <div>
                  <p>{editor.mode === "create" ? "NEW CASE" : "OPEN CASE"}</p>
                  <h2>{editor.frontmatter.title || editor.slug}</h2>
                  <span>{editor.path}</span>
                </div>
                <button className="button button--primary" onClick={savePost} disabled={isSaving}>
                  {isSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Commit
                </button>
              </div>

              <div className="frontmatter-grid">
                <label className="wide"><span>Title</span><input value={editor.frontmatter.title} onChange={(event) => updateFrontmatter({ title: event.target.value })} /></label>
                <label><span>Published</span><input type="date" value={editor.frontmatter.published} onChange={(event) => updateFrontmatter({ published: event.target.value })} /></label>
                <label><span>Updated</span><input type="date" value={editor.frontmatter.updated ?? ""} onChange={(event) => updateFrontmatter({ updated: event.target.value })} /></label>
                <label className="wide"><span>Description</span><input value={editor.frontmatter.description} onChange={(event) => updateFrontmatter({ description: event.target.value })} /></label>
                <label><span>Category</span><input value={editor.frontmatter.category} onChange={(event) => updateFrontmatter({ category: event.target.value })} /></label>
                <label><span>Notebook</span><input value={editor.frontmatter.notebook} onChange={(event) => updateFrontmatter({ notebook: event.target.value })} /></label>
                <label className="wide"><span>Image</span><input value={editor.frontmatter.image} placeholder="./cover.jpg or /about-cover.png" onChange={(event) => updateFrontmatter({ image: event.target.value })} /></label>
                <label><span>Tags</span><input value={tagsToText(editor.frontmatter.tags)} onChange={(event) => updateFrontmatter({ tags: splitTags(event.target.value) })} /></label>
                <label><span>Lang</span><input value={editor.frontmatter.lang} onChange={(event) => updateFrontmatter({ lang: event.target.value })} /></label>
                <label className="draft-toggle">
                  <input type="checkbox" checked={editor.frontmatter.draft} onChange={(event) => updateFrontmatter({ draft: event.target.checked })} />
                  <span>Keep as draft</span>
                </label>
              </div>

              <div className="writing-grid">
                <textarea value={editor.body} onChange={(event) => setEditor({ ...editor, body: event.target.value })} spellCheck={false} />
                <article className="preview-pane">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{editor.body || "_Nothing written yet._"}</ReactMarkdown>
                </article>
              </div>
            </>
          ) : (
            <div className="editor-empty">
              <FilePenLine size={34} />
              <h2>Select an entry or prepare a new draft.</h2>
              <p>The first v1 loop is simple: load Markdown, edit frontmatter and body, preview, commit.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
