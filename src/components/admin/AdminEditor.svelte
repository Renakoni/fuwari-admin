<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import EditorMetadataModal from "./EditorMetadataModal.svelte";
  import EditorMetadataRail from "./EditorMetadataRail.svelte";
  import EditorPreview from "./EditorPreview.svelte";
  import EditorToolbar from "./EditorToolbar.svelte";
  import EditorTopBar from "./EditorTopBar.svelte";
  import MilkdownSurface from "./MilkdownSurface.svelte";
  import SlashMenu from "./SlashMenu.svelte";
  import { draftPathForEditor, remoteDraftCommitMessage } from "../../lib/drafts";
  import { readFileOrNull, writeFile } from "../../lib/github";
  import { loadEditorDraft, loadSettings, saveEditorDraft } from "../../lib/storage";
  import { stringifyPost } from "../../lib/frontmatter";
  import { isImagePlaceholder } from "./imageBlock";
  import type { EditorState } from "../../types";
  import { parsePreviewBlocks } from "./adminPreview";
  import type { PreviewBlock } from "./adminPreview";
  import { blocks, slashItems as allSlashItems, tools } from "./editorConfig";
  import type { EditorBlock, EditorTool, SlashItem } from "./editorConfig";

  type ComposerMode = "write" | "preview";
  type PendingImage = {
    src: string;
    objectUrl: string;
    name: string;
    size: number;
    type: string;
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
  let slashOpen = false;
  let slashX = 0;
  let slashY = 0;
  let slashQuery = "";
  let editor: EditorState | null = null;
  let milkdownSurface: any;
  let copiedPreviewCode = "";
  let pendingImages = new Map<string, PendingImage>();
  let saveState: "idle" | "saving" | "saved" | "blocked" | "error" = "idle";
  let saveMessage = "";

  $: slashItems = allSlashItems.filter((item) => !slashQuery || `${item.label} ${item.hint}`.toLowerCase().includes(slashQuery.toLowerCase()));

  $: tagList = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  $: wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  $: readingMinutes = Math.max(1, Math.ceil(wordCount / 240));
  $: previewBlocks = parsePreviewBlocks(body);
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
    pendingImages.forEach((image) => URL.revokeObjectURL(image.objectUrl));
  });

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
      if (tool.action === "h2") insertSyntax("\n## 小节标题\n\n");
      if (tool.action === "bold") wrapSelection("**", "**");
      if (tool.action === "italic") wrapSelection("*", "*");
      if (tool.action === "link") wrapSelection("[", "](https://)");
      if (tool.action === "code") insertSyntax("\n```ts\n\n```\n");
      if (tool.action === "quote") insertSyntax("\n> 引用内容\n");
      if (tool.action === "bullet") insertSyntax("\n- 列表项\n");
      if (tool.action === "ordered") insertSyntax("\n1. 列表项\n");
      return;
    }
    if (tool.action === "h2") milkdownSurface.setHeading(2);
    if (tool.action === "bold") milkdownSurface.toggleWrap("**", "**");
    if (tool.action === "italic") milkdownSurface.toggleWrap("*", "*");
    if (tool.action === "link") milkdownSurface.insertLink();
    if (tool.action === "code") milkdownSurface.setCodeBlock();
    if (tool.action === "quote") milkdownSurface.insertBlockquote();
    if (tool.action === "bullet") milkdownSurface.insertList(false);
    if (tool.action === "ordered") milkdownSurface.insertList(true);
  }

  function openSlashMenu(event: CustomEvent<{ x: number; y: number }>) {
    slashX = Math.min(Math.max(event.detail.x, 12), window.innerWidth - 364);
    slashY = event.detail.y;
    slashQuery = "";
    slashOpen = true;
  }

  function applySlashItem(item: Pick<SlashItem, "syntax">) {
    insertSyntax(item.syntax);
    slashOpen = false;
    slashQuery = "";
  }

  function insertBlock(block: EditorBlock) {
    if (mode === "write" && milkdownSurface?.insertFuwariBlock) {
      milkdownSurface.insertFuwariBlock(block.kind);
      return;
    }
    insertSyntax(block.syntax);
  }

  function closeSlashMenu() {
    slashOpen = false;
    slashQuery = "";
  }

  function selectPendingImage(event: CustomEvent<PendingImage>) {
    const previous = pendingImages.get(event.detail.src);
    if (previous && previous.objectUrl !== event.detail.objectUrl) URL.revokeObjectURL(previous.objectUrl);
    pendingImages = new Map(pendingImages).set(event.detail.src, event.detail);
    markUnsaved();
  }

  function unresolvedRelativeImageCount() {
    return previewBlocks.filter((block) => block.type === "figure" && isImagePlaceholder(block.src || "") && !pendingImages.has(block.src || "")).length;
  }

  async function saveRemoteDraft() {
    const snapshot = syncEditorFromFields();
    if (!snapshot) return;
    const settings = loadSettings();
    if (!settings.owner.trim() || !settings.repo.trim() || !settings.token.trim()) {
      saveState = "error";
      saveMessage = "Configure GitHub settings before remote Save.";
      return;
    }
    if (pendingImages.size > 0) {
      saveState = "blocked";
      saveMessage = `${pendingImages.size} local image${pendingImages.size === 1 ? "" : "s"} must be uploaded before remote Save.`;
      return;
    }
    const unresolvedImages = unresolvedRelativeImageCount();
    if (unresolvedImages > 0) {
      saveState = "blocked";
      saveMessage = `${unresolvedImages} relative image${unresolvedImages === 1 ? "" : "s"} need upload or a remote URL before Save.`;
      return;
    }

    saveState = "saving";
    saveMessage = "Saving remote draft...";
    try {
      snapshot.frontmatter = { ...snapshot.frontmatter, draft: true };
      draft = true;
      const path = draftPathForEditor(snapshot);
      const existing = await readFileOrNull(settings, path);
      await writeFile(settings, path, stringifyPost(snapshot.frontmatter, snapshot.body), remoteDraftCommitMessage(snapshot), existing?.sha);
      saveEditorDraft(snapshot);
      lastSavedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      saveState = "saved";
      saveMessage = "Remote draft saved to GitHub.";
    } catch (caught) {
      saveState = "error";
      saveMessage = caught instanceof Error ? caught.message : "Failed to save remote draft.";
    }
  }

  function setMode(nextMode: ComposerMode) {
    mode = nextMode;
    if (nextMode === "preview") milkdownSurface = null;
  }
</script>

<section class="composer-shell">
  <EditorTopBar {draft} {lastSavedAt} {mode} pendingImageCount={pendingImages.size} {saveMessage} {saveState} on:modeChange={(event) => setMode(event.detail)} on:save={saveRemoteDraft} />

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
      <EditorMetadataRail {description} {tagList} {category} {published} {cover} on:editMetadata={() => (metadataOpen = true)} />
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
        {#if editor}
          <MilkdownSurface bind:this={milkdownSurface} value={body} {pendingImages} on:change={(event) => { markUnsaved(); body = event.detail; }} on:slash={openSlashMenu} on:selectImage={selectPendingImage} />
        {/if}
      </section>
    {/if}
  </main>

  {#if slashOpen}
    <SlashMenu x={slashX} y={slashY} query={slashQuery} items={slashItems} on:queryChange={(event) => (slashQuery = event.detail)} on:selectItem={(event) => applySlashItem(event.detail)} on:close={closeSlashMenu} />
  {/if}

  {#if metadataOpen}
    <EditorMetadataModal
      {description}
      {category}
      {published}
      {tags}
      {cover}
      {draft}
      on:close={() => (metadataOpen = false)}
      on:descriptionChange={(event) => (description = event.detail)}
      on:categoryChange={(event) => (category = event.detail)}
      on:publishedChange={(event) => (published = event.detail)}
      on:tagsChange={(event) => (tags = event.detail)}
      on:coverChange={(event) => (cover = event.detail)}
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
  @media (max-width: 1100px) {
    .composer-hero { grid-template-columns: 1fr; }
  }
  @media (max-width: 760px) {
    .composer-title { font-size: clamp(2rem, 11vw, 3.2rem); }
    .composer-write { grid-template-columns: 1fr; }
    .write-rail { display: none; }
  }
</style>
