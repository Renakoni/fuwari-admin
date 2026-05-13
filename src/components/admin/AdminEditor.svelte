<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import EditorMetadataModal from "./EditorMetadataModal.svelte";
  import EditorMetadataRail from "./EditorMetadataRail.svelte";
  import EditorOutline from "./EditorOutline.svelte";
  import EditorPreview from "./EditorPreview.svelte";
  import EditorToolbar from "./EditorToolbar.svelte";
  import EditorTopBar from "./EditorTopBar.svelte";
  import { publishContent } from "../../lib/adminApi";
  import { pathForSlug } from "../../lib/content";
  import { saveRemoteDraft as saveRemoteDraftToApi } from "../../lib/drafts";
  import { loadEditorDraft, saveEditorDraft } from "../../lib/storage";
  import { isImagePlaceholder } from "./imageBlock";
  import type { EditorState, ImageUpload } from "../../types";
  import { parsePreviewBlocks } from "./adminPreview";
  import type { OutlineItem } from "./EditorOutline.svelte";
  import type { PreviewBlock } from "./adminPreview";
  import { blocks, tools } from "./editorConfig";
  import type { EditorBlock, EditorTool } from "./editorConfig";

  type ComposerMode = "write" | "preview";
  type PendingImage = ImageUpload & {
    objectUrl: string;
  };

  let title = "Untitled Draft";
  let description = "";
  let category = "日志";
  let tags = "";
  let published = new Date().toISOString().slice(0, 10);
  let draft = true;
  let cover = "";
  let body = "这里开始写正文。\n\n## 第一节\n\n";
  let mode: ComposerMode = "write";
  let metadataOpen = false;
  let command = "";
  let lastSavedAt = "";
  let editor: EditorState | null = null;
  let milkdownSurface: any;
  let MilkdownSurfaceComponent: any = null;
  let copiedPreviewCode = "";
  let pendingImages = new Map<string, PendingImage>();
  let pendingCover: PendingImage | null = null;
  let saveState: "idle" | "saving" | "saved" | "blocked" | "error" = "idle";
  let saveMessage = "";
  let confirmedSlugRenamePath = "";
  let removeLeaveGuards: (() => void) | null = null;

  $: sourceLabel = editor?.remoteDraftPath
    ? editor.publishedPath ? "Published post · remote draft saved" : "Editing remote draft"
    : editor?.publishedPath ? "Editing published post" : "New post";

  $: tagList = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  $: wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  $: readingMinutes = Math.max(1, Math.ceil(wordCount / 240));
  $: previewBlocks = parsePreviewBlocks(body);
  $: outlineItems = parseOutlineItems(body, previewBlocks);
  $: coverPreview = pendingCover?.objectUrl || cover;
  $: if (editor) {
    editor.frontmatter = {
      ...editor.frontmatter,
      title,
      description,
      category,
      tags: tagList,
      published,
      draft,
      image: cover,
    };
    editor.body = body;
    saveEditorDraft(editor);
  }

  onMount(() => {
    void import("./MilkdownSurface.svelte").then((module) => {
      MilkdownSurfaceComponent = module.default;
    });

    const confirmBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmBeforeNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target || link.download) return;
      const href = link.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const nextUrl = new URL(link.href, window.location.href);
      if (nextUrl.href === window.location.href) return;
      if (!window.confirm("确定要离开编辑器吗？当前页面内容可能尚未保存。")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", confirmBeforeUnload);
    document.addEventListener("click", confirmBeforeNavigation, true);
    removeLeaveGuards = () => {
      window.removeEventListener("beforeunload", confirmBeforeUnload);
      document.removeEventListener("click", confirmBeforeNavigation, true);
    };

    const stored = loadEditorDraft();
    if (stored) {
      editor = stored;
      title = stored.frontmatter.title;
      description = stored.frontmatter.description;
      category = stored.frontmatter.category || "日志";
      tags = stored.frontmatter.tags.join(", ");
      published = stored.frontmatter.published || published;
      draft = stored.frontmatter.draft;
      cover = stored.frontmatter.image;
      body = stored.body;
    } else {
      editor = {
        mode: "create",
        path: "src/content/posts/untitled-draft/index.md",
        slug: "untitled-draft",
        kind: "blog",
        frontmatter: {
          title,
          published,
          draft,
          description,
          image: cover,
          tags: [],
          category,
          notebook: "Misc",
          lang: "zh_CN",
        },
        body,
      };
    }
  });

  onDestroy(() => {
    removeLeaveGuards?.();
    pendingImages.forEach((image) => URL.revokeObjectURL(image.objectUrl));
    if (pendingCover) URL.revokeObjectURL(pendingCover.objectUrl);
  });

  function slugifyHeading(value: string) {
    return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
  }

  function parseOutlineItems(markdown: string, blocks: PreviewBlock[]): OutlineItem[] {
    const previewHeadingIndexes = blocks
      .map((block, index) => block.type === "heading" ? index : -1)
      .filter((index) => index >= 0);
    let headingIndex = 0;
    const seen = new Map<string, number>();
    return markdown.split("\n").flatMap((line, index) => {
      const match = line.trim().match(/^(#{1,6})\s+(.+)$/);
      if (!match) return [];
      const text = match[2].trim();
      const occurrence = (seen.get(text) ?? 0) + 1;
      seen.set(text, occurrence);
      const previewIndex = previewHeadingIndexes[headingIndex] ?? -1;
      headingIndex += 1;
      return [{ id: `${slugifyHeading(text)}-${index + 1}`, text, level: match[1].length, line: index + 1, previewIndex, occurrence }];
    });
  }

  function jumpToOutlineItem(item: OutlineItem) {
    if (mode === "preview" && item.previewIndex >= 0) {
      document.getElementById(`preview-heading-${item.previewIndex}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    milkdownSurface?.focusHeading?.(item.text, item.occurrence);
  }

  function syncEditorFromFields(): EditorState | null {
    if (!editor) return null;
    editor.frontmatter = {
      ...editor.frontmatter,
      title,
      description,
      category,
      tags: tagList,
      published,
      draft,
      image: cover,
    };
    editor.body = body;
    return editor;
  }

  function markUnsaved() {
    confirmedSlugRenamePath = "";
    if (saveState === "saved") {
      saveState = "idle";
      saveMessage = "Remote draft has local changes.";
    }
  }

  function insertSyntax(syntax: string) {
    markUnsaved();
    if (milkdownSurface) {
      milkdownSurface.insertMarkdown(syntax);
      return;
    }
    body += syntax;
  }

  function wrapSelection(before: string, after: string) {
    markUnsaved();
    if (milkdownSurface) {
      milkdownSurface.wrapSelection(before, after);
      return;
    }
    body += `${before}text${after}`;
  }

  async function copyPreviewCode(block: Extract<PreviewBlock, { type: "code" }>, index: number) {
    const key = `${index}:${block.lang}:${block.code}`;
    copiedPreviewCode = key;
    window.setTimeout(() => {
      if (copiedPreviewCode === key) copiedPreviewCode = "";
    }, 1200);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(block.code);
      }
    } catch {
      // Clipboard permissions vary between browsers and dev contexts.
    }
  }

  function applyTool(tool: Pick<EditorTool, "action">) {
    if (mode !== "write" || !milkdownSurface) {
      if (tool.action === "bold") wrapSelection("**", "**");
      if (tool.action === "italic") wrapSelection("*", "*");
      if (tool.action === "underline") wrapSelection("++", "++");
      if (tool.action === "strike") wrapSelection("~~", "~~");
      if (tool.action === "spoiler") milkdownSurface?.wrapSelectedTextOnly?.("||", "||");
      if (tool.action === "link") wrapSelection("[", "]()");
      if (tool.action === "code") insertSyntax("\n```ts\n\n```\n");
      if (tool.action === "math") insertSyntax("\n```fuwari-latex\nE = mc^2\n```\n");
      if (tool.action === "quote") insertSyntax("\n> 引用内容\n");
      if (tool.action === "bullet") insertSyntax("\n- 列表项\n");
      if (tool.action === "ordered") insertSyntax("\n1. 列表项\n");
      return;
    }
    if (tool.action === "bold") milkdownSurface.toggleWrap("**", "**");
    if (tool.action === "italic") milkdownSurface.toggleWrap("*", "*");
    if (tool.action === "underline") milkdownSurface.toggleWrap("++", "++");
    if (tool.action === "strike") milkdownSurface.toggleWrap("~~", "~~");
    if (tool.action === "spoiler") milkdownSurface.wrapSelectedTextOnly("||", "||");
    if (tool.action === "link") milkdownSurface.insertLink();
    if (tool.action === "code") milkdownSurface.setCodeBlock();
    if (tool.action === "math") milkdownSurface.insertMathBlock();
    if (tool.action === "quote") milkdownSurface.insertBlockquote();
    if (tool.action === "bullet") milkdownSurface.insertList(false);
    if (tool.action === "ordered") milkdownSurface.insertList(true);
  }

  function insertBlock(block: EditorBlock) {
    if (mode === "write" && milkdownSurface?.insertFuwariBlock) {
      milkdownSurface.insertFuwariBlock(block.kind);
      return;
    }
    insertSyntax(block.syntax);
  }

  function selectPendingImage(event: CustomEvent<PendingImage>) {
    const previous = pendingImages.get(event.detail.src);
    if (previous && previous.objectUrl !== event.detail.objectUrl) URL.revokeObjectURL(previous.objectUrl);
    pendingImages = new Map(pendingImages).set(event.detail.src, event.detail);
    markUnsaved();
  }

  function selectPendingCover(event: CustomEvent<PendingImage>) {
    if (pendingCover && pendingCover.objectUrl !== event.detail.objectUrl) URL.revokeObjectURL(pendingCover.objectUrl);
    pendingCover = event.detail;
    cover = event.detail.src;
    markUnsaved();
  }

  function updateCover(value: string) {
    if (pendingCover && value !== pendingCover.src) {
      URL.revokeObjectURL(pendingCover.objectUrl);
      pendingCover = null;
    }
    cover = value;
    markUnsaved();
  }

  function clearCover() {
    if (pendingCover) URL.revokeObjectURL(pendingCover.objectUrl);
    pendingCover = null;
    cover = "";
    markUnsaved();
  }

  function unresolvedRelativeImageCount() {
    return previewBlocks.filter((block) => {
      const src = block.type === "figure" ? block.src || "" : "";
      return block.type === "figure" && isImagePlaceholder(src) && !src.startsWith("./assets/") && !pendingImages.has(src);
    }).length;
  }

  function pendingImageUploads(): ImageUpload[] {
    const uploads = [...pendingImages.values()].map(({ src, name, size, type, data, role }) => ({ src, name, size, type, data, role }));
    if (pendingCover) {
      const { src, name, size, type, data, role } = pendingCover;
      uploads.push({ src, name, size, type, data, role });
    }
    return uploads;
  }

  function unresolvedCoverNeedsUpload() {
    const value = cover.trim();
    if (!value || pendingCover?.src === value || value.startsWith("./assets/") || value.startsWith("/") || /^https?:\/\//i.test(value)) return false;
    return value.startsWith("./");
  }

  function blockIfImagesNeedUpload(action: string): boolean {
    if (unresolvedCoverNeedsUpload()) {
      saveState = "blocked";
      saveMessage = `Cover image needs upload or a remote URL before ${action}.`;
      return true;
    }
    const unresolvedImages = unresolvedRelativeImageCount();
    if (unresolvedImages > 0) {
      saveState = "blocked";
      saveMessage = `${unresolvedImages} relative image${unresolvedImages === 1 ? "" : "s"} need upload or a remote URL before ${action}.`;
      return true;
    }
    return false;
  }

  function blockIfSlugRenameNeedsConfirmation(snapshot: EditorState): boolean {
    if (!snapshot.publishedPath) return false;
    const nextPath = pathForSlug("src/content/posts", snapshot.slug);
    if (nextPath === snapshot.publishedPath || confirmedSlugRenamePath === nextPath) return false;
    confirmedSlugRenamePath = nextPath;
    saveState = "blocked";
    saveMessage = "Slug changed. Commit again to publish the new path; the old published path will not be deleted automatically.";
    return true;
  }

  function clearPendingUploads() {
    pendingImages.forEach((image) => URL.revokeObjectURL(image.objectUrl));
    pendingImages = new Map();
    if (pendingCover) URL.revokeObjectURL(pendingCover.objectUrl);
    pendingCover = null;
  }

  async function saveRemoteDraft() {
    const snapshot = syncEditorFromFields();
    if (!snapshot || blockIfImagesNeedUpload("remote Save")) return;

    saveState = "saving";
    saveMessage = "Saving remote draft...";
    try {
      const wasPublishedEdit = Boolean(snapshot.publishedPath) && !snapshot.remoteDraftPath;
      snapshot.frontmatter = { ...snapshot.frontmatter, draft: true };
      draft = true;
      const saved = await saveRemoteDraftToApi(snapshot, pendingImageUploads());
      snapshot.remoteDraftPath = saved.path;
      snapshot.remoteDraftSha = saved.sha;
      if (!snapshot.publishedPath) {
        snapshot.path = saved.path;
        snapshot.sha = saved.sha;
      }
      if (saved.body) snapshot.body = body = saved.body;
      if (saved.frontmatter) {
        snapshot.frontmatter = saved.frontmatter;
        cover = saved.frontmatter.image;
      }
      clearPendingUploads();
      saveEditorDraft(snapshot);
      lastSavedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      saveState = "saved";
      saveMessage = wasPublishedEdit ? "Saved as remote draft. Published post unchanged." : "Remote draft saved to GitHub.";
    } catch (caught) {
      saveState = "error";
      saveMessage = caught instanceof Error ? caught.message : "Failed to save remote draft.";
    }
  }

  async function commitRemoteContent() {
    const snapshot = syncEditorFromFields();
    if (!snapshot || blockIfImagesNeedUpload("Commit") || blockIfSlugRenameNeedsConfirmation(snapshot)) return;

    saveState = "saving";
    saveMessage = "Publishing to GitHub...";
    try {
      const draftPathToDelete = snapshot.remoteDraftPath;
      const draftShaToDelete = snapshot.remoteDraftSha;
      snapshot.frontmatter = { ...snapshot.frontmatter, draft: false };
      const published = await publishContent(snapshot, pendingImageUploads());
      snapshot.mode = "edit";
      snapshot.path = published.path;
      snapshot.sha = published.sha;
      snapshot.publishedPath = published.path;
      snapshot.publishedSha = published.sha;
      if (published.body) snapshot.body = body = published.body;
      if (published.frontmatter) {
        snapshot.frontmatter = published.frontmatter;
        cover = published.frontmatter.image;
      }
      snapshot.frontmatter.draft = false;
      clearPendingUploads();
      editor = snapshot;
      draft = false;
      lastSavedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      saveState = "saved";
      saveMessage = "Published to GitHub.";

      if (draftPathToDelete || draftShaToDelete) {
        delete snapshot.remoteDraftPath;
        delete snapshot.remoteDraftSha;
        saveMessage = "Published to GitHub. Remote draft cleaned up.";
      }

      confirmedSlugRenamePath = "";
      saveEditorDraft(snapshot);
    } catch (caught) {
      saveState = "error";
      saveMessage = caught instanceof Error ? caught.message : "Failed to publish content.";
    }
  }

  function setMode(nextMode: ComposerMode) {
    mode = nextMode;
    if (nextMode === "preview") milkdownSurface = null;
  }
</script>

<section class="composer-shell">
  <EditorTopBar {draft} {lastSavedAt} {mode} {sourceLabel} pendingImageCount={pendingImages.size} {saveMessage} {saveState} commitDisabled={saveState === "saving"} commitLabel={saveState === "saving" && saveMessage.startsWith("Publishing") ? "Publishing" : "Commit"} on:modeChange={(event) => setMode(event.detail)} on:save={saveRemoteDraft} on:commit={commitRemoteContent} />

  <div class="composer-workbench">
    <main class="composer-stage card-base">
    <section class="composer-hero">
      <div class="composer-title-column">
        <div class="composer-kicker">
          <span>{category || "Uncategorized"}</span>
          <span>{published}</span>
          <span>{draft ? "Draft" : "Live"}</span>
        </div>
        <input class="composer-title" bind:value={title} aria-label="Title" placeholder="Untitled Draft" />
      </div>
      <EditorMetadataRail {description} {tagList} {category} {published} {cover} {coverPreview} on:editMetadata={() => (metadataOpen = true)} />
    </section>

    <EditorToolbar {tools} {blocks} on:tool={(event) => applyTool(event.detail)} on:block={(event) => insertBlock(event.detail)} />

    {#if mode === "preview"}
      <EditorPreview {title} {description} {previewBlocks} {copiedPreviewCode} {pendingImages} on:copyCode={(event) => copyPreviewCode(event.detail.block, event.detail.index)} />
    {:else}
      <section class="composer-write">
        <div class="write-rail">
          <span>WRITE</span>
          <span>CREPE</span>
        </div>
        {#if editor && MilkdownSurfaceComponent}
          <svelte:component this={MilkdownSurfaceComponent} bind:this={milkdownSurface} value={body} {pendingImages} on:change={(event) => { markUnsaved(); body = event.detail; }} on:selectImage={selectPendingImage} />
        {:else}
          <div class="composer-write-loading">Loading editor surface…</div>
        {/if}
      </section>
    {/if}
    </main>

    <EditorOutline items={outlineItems} {mode} on:jump={(event) => jumpToOutlineItem(event.detail)} />
  </div>

  {#if metadataOpen}
    <EditorMetadataModal
      {description}
      {category}
      {published}
      {tags}
      {cover}
      {coverPreview}
      pendingCover={Boolean(pendingCover)}
      {draft}
      on:close={() => (metadataOpen = false)}
      on:descriptionChange={(event) => (description = event.detail)}
      on:categoryChange={(event) => (category = event.detail)}
      on:publishedChange={(event) => (published = event.detail)}
      on:tagsChange={(event) => (tags = event.detail)}
      on:coverChange={(event) => updateCover(event.detail)}
      on:coverImageSelected={selectPendingCover}
      on:clearCover={clearCover}
      on:toggleDraft={() => (draft = !draft)}
    />
  {/if}
</section>

<style>
  .composer-shell {
    display: grid;
    gap: 0.62rem;
    max-width: 82rem;
    margin: 0 auto;
  }
  .composer-workbench {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(13rem, 16rem);
    gap: 0.8rem;
    align-items: start;
  }
  .composer-stage {
    overflow: hidden;
    background:
      radial-gradient(circle at 18% -10%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 28%),
      linear-gradient(180deg, color-mix(in oklch, var(--card-bg) 98%, white 2%), color-mix(in oklch, var(--card-bg) 95%, black 5%));
  }
  .composer-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 19rem);
    gap: clamp(1rem, 3vw, 2rem);
    align-items: start;
    padding: clamp(0.9rem, 2vw, 1.35rem) clamp(1rem, 3vw, 2rem) 0.72rem;
  }
  .composer-title-column {
    min-width: 0;
  }
  .composer-kicker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.38rem;
    margin-bottom: 0.54rem;
    color: rgb(255 255 255 / 0.4);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.6rem;
    font-weight: 900;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }
  .composer-kicker span {
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.032);
    padding: 0.2rem 0.46rem;
  }
  .composer-title {
    box-sizing: border-box;
    width: 100%;
    border: 0;
    background: transparent;
    color: rgb(255 255 255 / 0.88);
    outline: none;
  }
  .composer-title {
    display: block;
    max-width: 62rem;
    font-size: clamp(2rem, 4.4vw, 3.5rem);
    font-weight: 900;
    letter-spacing: -0.035em;
    line-height: 1.16;
    padding-block: 0.06em 0.18em;
  }
  .composer-write {
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 1fr);
    min-height: 31rem;
  }
  .composer-write-loading {
    display: grid;
    place-items: center;
    min-height: 31rem;
    color: rgb(255 255 255 / 0.36);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .write-rail {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-right: 1px solid rgb(255 255 255 / 0.05);
    padding: 0.92rem 0.62rem;
    color: rgb(255 255 255 / 0.24);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.56rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-orientation: mixed;
    writing-mode: vertical-rl;
  }
  @media (max-width: 1180px) {
    .composer-workbench { grid-template-columns: 1fr; }
  }
  @media (max-width: 1100px) {
    .composer-hero { grid-template-columns: 1fr; }
  }
  @media (max-width: 760px) {
    .composer-title { font-size: clamp(2rem, 11vw, 3.2rem); }
    .composer-write { grid-template-columns: 1fr; }
    .write-rail { display: none; }
  }
</style>
