<script lang="ts">
  import { editorForEntry, editorForNewPost, loadContentEntries } from "../../lib/content";
  import { editorForRemoteDraft, listRemoteDrafts } from "../../lib/drafts";
  import { loadSettings, saveEditorDraft } from "../../lib/storage";
  import type { AdminSettings, ContentEntry } from "../../types";

  export let kind: "blog" | "note" = "blog";

  const title = kind === "note" ? "Notes" : "Blog";
  const newTitle = kind === "note" ? "New Note" : "New Post";
  const newLabel = kind === "note" ? "Notebook" : "Archive";
  const emptyText = kind === "note" ? "还没有读取到 Notes。" : "还没有读取到 Blog 文章。";

  let entries: ContentEntry[] = [];
  let remoteDrafts: ContentEntry[] = [];
  let currentSettings: AdminSettings | null = null;
  let loading = true;
  let error = "";

  function formatDate(value: string) {
    if (!value) return "Draft";
    return value.slice(0, 10);
  }

  function estimateMinutes(body: string) {
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 240));
  }

  function createSlug() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    return kind === "note" ? `notes/${date}-note` : `${date}-draft`;
  }

  function openNew() {
    const settings = loadSettings();
    const draft = editorForNewPost(settings, kind, createSlug(), newTitle);
    saveEditorDraft(draft);
    window.location.href = "/editor/";
  }

  function openEntry(entry: ContentEntry) {
    saveEditorDraft(editorForEntry(entry));
    window.location.href = "/editor/";
  }

  function openRemoteDraft(entry: ContentEntry) {
    if (!currentSettings) return;
    saveEditorDraft(editorForRemoteDraft(currentSettings, entry));
    window.location.href = "/editor/";
  }

  async function refresh() {
    loading = true;
    error = "";
    try {
      const settings = loadSettings();
      currentSettings = settings;
      if (!settings.owner.trim() || !settings.repo.trim() || !settings.token.trim()) {
        error = "还没有配置 GitHub repository 和 token。";
        entries = [];
        remoteDrafts = [];
        return;
      }
      const [allEntries, allRemoteDrafts] = await Promise.all([loadContentEntries(settings), listRemoteDrafts(settings)]);
      entries = allEntries.filter((entry) => entry.kind === kind);
      remoteDrafts = allRemoteDrafts.filter((entry) => entry.kind === kind);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "无法读取内容列表。";
      entries = [];
      remoteDrafts = [];
    } finally {
      loading = false;
    }
  }

  refresh();
</script>

<section class="admin-archive-page space-y-4">
  <header class="admin-archive-hero card-base">
    <div>
      <span class="system-label">Admin / {title}</span>
      <h1>{title}</h1>
      <p>第一张新建，下面打开已有内容。</p>
    </div>
    <button class="admin-refresh" type="button" on:click={refresh} disabled={loading}>
      {loading ? "Loading" : "Refresh"}
    </button>
  </header>

  <div class="admin-card-list">
    <button class="admin-post-card admin-post-card--new post-card card-base surface-hover" type="button" on:click={openNew}>
      <span class="admin-post-card__kicker">{newLabel} / Compose</span>
      <strong>{newTitle}</strong>
      <p>进入专注编辑页。</p>
      <span class="admin-post-card__meta">Create draft →</span>
    </button>

    {#if loading}
      {#each Array(3) as _}
        <article class="admin-post-card admin-post-card--skeleton post-card card-base">
          <span></span>
          <strong></strong>
          <p></p>
        </article>
      {/each}
    {:else if error}
      <article class="admin-post-card admin-post-card--message post-card card-base">
        <span class="admin-post-card__kicker">Repository</span>
        <strong>Connect GitHub</strong>
        <p>{error}</p>
        <span class="admin-post-card__meta">Settings modal pending</span>
      </article>
    {:else if entries.length === 0 && remoteDrafts.length === 0}
      <article class="admin-post-card admin-post-card--message post-card card-base">
        <span class="admin-post-card__kicker">Empty</span>
        <strong>{emptyText}</strong>
        <p>先点第一张卡片新建，或用 Save 保存远程草稿。</p>
      </article>
    {:else}
      {#each remoteDrafts as entry}
        <button class="admin-post-card admin-post-card--remote-draft post-card card-base surface-hover" type="button" on:click={() => openRemoteDraft(entry)}>
          <span class="admin-post-card__kicker">Remote Draft / {formatDate(entry.frontmatter.published)}</span>
          <strong>{entry.frontmatter.title}</strong>
          <p>{entry.frontmatter.description || entry.body.split("\n").find((line) => line.trim() && !line.startsWith("#")) || "Saved admin draft."}</p>
          <span class="admin-post-card__meta">Saved · {estimateMinutes(entry.body)} min · {entry.slug}</span>
        </button>
      {/each}
      {#each entries as entry}
        <button class="admin-post-card post-card card-base surface-hover" type="button" on:click={() => openEntry(entry)}>
          <span class="admin-post-card__kicker">{formatDate(entry.frontmatter.published)} / {entry.frontmatter.category || title}</span>
          <strong>{entry.frontmatter.title}</strong>
          <p>{entry.frontmatter.description || entry.body.split("\n").find((line) => line.trim() && !line.startsWith("#")) || "No description yet."}</p>
          <span class="admin-post-card__meta">
            {entry.frontmatter.draft ? "Draft" : "Published"} · {estimateMinutes(entry.body)} min · {entry.slug}
          </span>
        </button>
      {/each}
    {/if}
  </div>
</section>

<style>
  .admin-archive-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.95rem 1.15rem;
  }
  .admin-archive-hero h1 {
    margin: 0.22rem 0 0.08rem;
    color: rgb(255 255 255 / 0.9);
    font-size: clamp(1.45rem, 3.2vw, 2.15rem);
    font-weight: 900;
    letter-spacing: -0.055em;
    line-height: 0.98;
  }
  .admin-archive-hero p {
    max-width: 32rem;
    margin: 0;
    color: rgb(255 255 255 / 0.48);
    font-size: 0.92rem;
    line-height: 1.45;
  }
  .admin-refresh {
    border-radius: 999px;
    background: color-mix(in oklch, var(--primary) 13%, transparent);
    padding: 0.5rem 0.78rem;
    color: var(--primary);
    font-size: 0.82rem;
    font-weight: 850;
  }
  .admin-refresh:disabled { opacity: 0.55; }
  .admin-card-list {
    display: grid;
    gap: 0.72rem;
  }
  .admin-post-card {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "kicker meta"
      "title meta"
      "desc meta";
    column-gap: 1.25rem;
    row-gap: 0.42rem;
    align-items: center;
    padding: 1rem 1.15rem 1rem 1.65rem;
    position: relative;
    text-align: left;
    color: inherit;
    min-height: 7.4rem;
  }
  .admin-post-card::after {
    content: "";
    position: absolute;
    left: 1rem;
    top: 1rem;
    bottom: 1rem;
    width: 2px;
    border-radius: 999px;
    background: linear-gradient(180deg, color-mix(in oklch, var(--primary) 58%, transparent), transparent);
    opacity: 0.65;
  }
  .admin-post-card__kicker,
  .admin-post-card__meta {
    color: rgb(255 255 255 / 0.42);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.66rem;
    font-weight: 850;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }
  .admin-post-card__kicker { grid-area: kicker; }
  .admin-post-card__meta {
    grid-area: meta;
    max-width: 11rem;
    text-align: right;
    line-height: 1.55;
  }
  .admin-post-card strong {
    grid-area: title;
    display: block;
    max-width: 42rem;
    color: rgb(255 255 255 / 0.9);
    font-size: clamp(1.32rem, 2.6vw, 2rem);
    font-weight: 900;
    letter-spacing: -0.047em;
    line-height: 1.04;
    transition: color var(--motion-duration-base) var(--motion-ease-standard);
  }
  .admin-post-card:hover strong { color: var(--primary); }
  .admin-post-card p {
    grid-area: desc;
    max-width: 40rem;
    margin: 0;
    color: rgb(255 255 255 / 0.52);
    line-height: 1.55;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .admin-post-card--new {
    min-height: 8.4rem;
    background:
      radial-gradient(circle at 8% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 36%),
      linear-gradient(135deg, color-mix(in oklch, var(--card-bg) 88%, var(--primary) 12%), var(--card-bg));
  }
  .admin-post-card--new strong { font-size: clamp(1.55rem, 3vw, 2.35rem); }
  .admin-post-card--remote-draft {
    background:
      radial-gradient(circle at 92% 0%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 32%),
      color-mix(in oklch, var(--card-bg) 96%, var(--primary) 4%);
  }
  .admin-post-card--message { cursor: default; }
  .admin-post-card--message strong { color: rgb(255 255 255 / 0.84); }
  .admin-post-card--message:hover strong { color: rgb(255 255 255 / 0.84); }
  .admin-post-card--skeleton { overflow: hidden; min-height: 6.4rem; }
  .admin-post-card--skeleton span,
  .admin-post-card--skeleton strong,
  .admin-post-card--skeleton p {
    display: block;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.08);
  }
  .admin-post-card--skeleton span { width: 9rem; height: 0.7rem; }
  .admin-post-card--skeleton strong { width: min(24rem, 70%); height: 1.7rem; }
  .admin-post-card--skeleton p { width: min(34rem, 88%); height: 0.85rem; }
  @media (max-width: 700px) {
    .admin-archive-hero { align-items: start; flex-direction: column; }
    .admin-post-card {
      grid-template-columns: 1fr;
      grid-template-areas: "kicker" "title" "desc" "meta";
      min-height: 8rem;
    }
    .admin-post-card__meta { text-align: left; max-width: none; }
  }
</style>
