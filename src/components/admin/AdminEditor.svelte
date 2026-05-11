<script lang="ts">
  import { onMount } from "svelte";
  import MilkdownSurface from "./MilkdownSurface.svelte";
  import { loadEditorDraft, saveEditorDraft } from "../../lib/storage";
  import type { EditorState } from "../../types";

  type ComposerMode = "write" | "source" | "preview";
  type ToolAction = "h2" | "bold" | "italic" | "link" | "code" | "quote" | "bullet" | "ordered";
  type FuwariBlockKind = "note" | "warning" | "figure" | "gallery" | "video" | "evidence";
  type PreviewBlock =
    | { type: "heading"; text: string }
    | { type: "paragraph"; text: string }
    | { type: "callout"; label: string; body: string }
    | { type: "figure"; label: string; body: string }
    | { type: "gallery"; label: string; body: string }
    | { type: "video"; label: string; body: string }
    | { type: "evidence"; label: string; body: string };

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
  let textarea: HTMLTextAreaElement;
  let milkdownSurface: any;

  const tools: Array<{ label: string; icon: string; hint: string; action: ToolAction }> = [
    { label: "加粗", icon: "B", hint: "Ctrl+B", action: "bold" },
    { label: "斜体", icon: "I", hint: "Ctrl+I", action: "italic" },
    { label: "标题", icon: "H2", hint: "Ctrl+2", action: "h2" },
    { label: "引用", icon: "❝", hint: "Blockquote", action: "quote" },
    { label: "无序", icon: "•", hint: "List", action: "bullet" },
    { label: "有序", icon: "1.", hint: "List", action: "ordered" },
    { label: "代码块", icon: "</>", hint: "Ctrl+Shift+K", action: "code" },
    { label: "超链接", icon: "↗", hint: "Ctrl+K", action: "link" },
  ];

  const blocks: Array<{ label: string; icon: string; description: string; kind: FuwariBlockKind; syntax: string }> = [
    { label: "Note", icon: "!", description: "提示块", kind: "note", syntax: "\n> [!NOTE]\n> 内容\n" },
    { label: "Warn", icon: "△", description: "警告块", kind: "warning", syntax: "\n> [!WARNING]\n> 内容\n" },
    { label: "Fig", icon: "▧", description: "单图", kind: "figure", syntax: "\n![图片说明](./image.png)\n*图片说明*\n" },
    { label: "Grid", icon: "▦", description: "组图", kind: "gallery", syntax: "\n![图 1](./a.png)\n![图 2](./b.png)\n![图 3](./c.png)\n*图片组说明*\n" },
    { label: "Video", icon: "▶", description: "视频", kind: "video", syntax: "\n[视频说明](https://)\n" },
    { label: "Proof", icon: "※", description: "证据", kind: "evidence", syntax: "\n> [!IMPORTANT]\n> Evidence\n> 内容\n" },
  ];

  $: slashItems = [
    { label: "Heading 2", hint: "小节标题", syntax: "\n## 小节标题\n\n" },
    { label: "Note", hint: "提示块", syntax: "\n> [!NOTE]\n> 内容\n" },
    { label: "Warning", hint: "警告块", syntax: "\n> [!WARNING]\n> 内容\n" },
    { label: "Figure", hint: "单图", syntax: "\n![图片说明](./image.png)\n*图片说明*\n" },
    { label: "Gallery", hint: "图片组", syntax: "\n![图 1](./a.png)\n![图 2](./b.png)\n![图 3](./c.png)\n*图片组说明*\n" },
    { label: "Video", hint: "视频", syntax: "\n[视频说明](https://)\n" },
    { label: "Evidence", hint: "证据材料", syntax: "\n> [!IMPORTANT]\n> Evidence\n> 内容\n" },
  ].filter((item) => !slashQuery || `${item.label} ${item.hint}`.toLowerCase().includes(slashQuery.toLowerCase()));

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
    lastSavedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  function focusEditor() {
    requestAnimationFrame(() => textarea?.focus());
  }

  function insertSyntax(syntax: string) {
    if (mode === "write" && milkdownSurface) {
      milkdownSurface.insertMarkdown(syntax);
      return;
    }
    if (!textarea) {
      body += syntax;
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    body = `${body.slice(0, start)}${syntax}${body.slice(end)}`;
    focusEditor();
    requestAnimationFrame(() => {
      const cursor = start + syntax.length;
      textarea.selectionStart = cursor;
      textarea.selectionEnd = cursor;
    });
  }

  function wrapSelection(before: string, after: string) {
    if (mode === "write" && milkdownSurface) {
      milkdownSurface.wrapSelection(before, after);
      return;
    }
    if (!textarea) return insertSyntax(before + after);
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end) || "text";
    body = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`;
    focusEditor();
    requestAnimationFrame(() => {
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + selected.length;
    });
  }

  function getDirectiveLabel(line: string, fallback: string) {
    const title = line.match(/title="([^"]+)"/)?.[1];
    const caption = line.match(/caption="([^"]+)"/)?.[1];
    const label = line.match(/label="([^"]+)"/)?.[1];
    const type = line.match(/type="([^"]+)"/)?.[1];
    return title || caption || label || type || fallback;
  }

  function parsePreviewBlocks(markdown: string): PreviewBlock[] {
    const blocks: PreviewBlock[] = [];
    const lines = markdown.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("## ")) {
        blocks.push({ type: "heading", text: trimmed.slice(3) });
        continue;
      }
      if (trimmed.startsWith(":::callout")) {
        const content: string[] = [];
        while (lines[index + 1] && !lines[index + 1].trim().startsWith(":::") ) {
          index += 1;
          content.push(lines[index]);
        }
        blocks.push({ type: "callout", label: getDirectiveLabel(trimmed, "Note"), body: content.join("\n").trim() });
        continue;
      }
      if (trimmed.startsWith(":::figure")) {
        const content: string[] = [];
        while (lines[index + 1] && !lines[index + 1].trim().startsWith(":::") ) {
          index += 1;
          content.push(lines[index]);
        }
        blocks.push({ type: "figure", label: getDirectiveLabel(trimmed, "Figure"), body: content.join("\n").trim() });
        continue;
      }
      if (trimmed.startsWith(":::gallery")) {
        const content: string[] = [];
        while (lines[index + 1] && !lines[index + 1].trim().startsWith(":::") ) {
          index += 1;
          content.push(lines[index]);
        }
        blocks.push({ type: "gallery", label: getDirectiveLabel(trimmed, "Gallery"), body: content.join("\n").trim() });
        continue;
      }
      if (trimmed.startsWith(":::evidence")) {
        const content: string[] = [];
        while (lines[index + 1] && !lines[index + 1].trim().startsWith(":::") ) {
          index += 1;
          content.push(lines[index]);
        }
        blocks.push({ type: "evidence", label: getDirectiveLabel(trimmed, "Evidence"), body: content.join("\n").trim() });
        continue;
      }
      if (trimmed.startsWith("::video")) {
        blocks.push({ type: "video", label: getDirectiveLabel(trimmed, "Video"), body: trimmed.match(/src="([^"]+)"/)?.[1] || "Video embed" });
        continue;
      }
      if (!trimmed.startsWith(":::")) {
        blocks.push({ type: "paragraph", text: trimmed });
      }
    }
    return blocks;
  }
  function applyTool(tool: { action: ToolAction }) {
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
    if (tool.action === "quote") milkdownSurface.insertMarkdown("\n> 引用内容\n");
    if (tool.action === "bullet") milkdownSurface.insertMarkdown("\n- 列表项\n");
    if (tool.action === "ordered") milkdownSurface.insertMarkdown("\n1. 列表项\n");
  }

  function openSlashMenu(event: CustomEvent<{ x: number; y: number }>) {
    slashX = event.detail.x;
    slashY = event.detail.y;
    slashQuery = "";
    slashOpen = true;
  }

  function applySlashItem(item: { syntax: string }) {
    insertSyntax(item.syntax);
    slashOpen = false;
    slashQuery = "";
  }

  function insertBlock(block: { kind: FuwariBlockKind; syntax: string }) {
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
</script>

<section class="composer-shell">
  <header class="composer-top card-base">
    <a class="composer-back" href="/blog/">← Blog</a>
    <div class="composer-status">
      <span class="system-label">Fuwari Composer</span>
      <strong>{draft ? "Draft" : "Published"}</strong>
      <span>Local draft{lastSavedAt ? ` · saved ${lastSavedAt}` : ""}</span>
    </div>
    <div class="composer-actions">
      {#each ["write", "source", "preview"] as item}
        <button class:active={mode === item} type="button" on:click={() => (mode = item as ComposerMode)}>{item}</button>
      {/each}
      <button class="commit" type="button">Commit</button>
    </div>
  </header>

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
      <aside class="metadata-rail" aria-label="Post metadata summary">
        <div class="metadata-rail__head">
          <strong>Metadata</strong>
          <button type="button" aria-label="Edit metadata" on:click={() => (metadataOpen = true)}>⚙</button>
        </div>
        <p>{description || "给这篇文章写一句会出现在首页卡片和标题下方的摘要。"}</p>
        {#if tagList.length}
          <div class="metadata-tags">
            {#each tagList as tag}<span>{tag}</span>{/each}
          </div>
        {/if}
        <dl>
          <div><dt>Category</dt><dd>{category || "None"}</dd></div>
          <div><dt>Date</dt><dd>{published}</dd></div>
          {#if cover}<div><dt>Cover</dt><dd>{cover}</dd></div>{/if}
        </dl>
      </aside>
    </section>

    <nav class="composer-toolbar" aria-label="Composer toolbar">
      {#each tools as tool}
        <button type="button" title={`${tool.label} · ${tool.hint}`} on:click={() => applyTool(tool)}>
          <strong>{tool.icon}</strong>
          <span>{tool.label}</span>
        </button>
      {/each}
      {#each blocks as block}
        <button class="toolbar-block" type="button" title={`${block.label} · ${block.description}`} on:click={() => insertBlock(block)}>
          <strong>{block.icon}</strong>
          <span>{block.label}</span>
        </button>
      {/each}
    </nav>

    {#if mode === "preview"}
      <article class="composer-preview">
        <div class="preview-label">Preview / Fuwari Markdown 2.0</div>
        <h1>{title}</h1>
        {#if description}<p class="preview-dek">{description}</p>{/if}
        {#each previewBlocks as block}
          {#if block.type === "heading"}
            <h2>{block.text}</h2>
          {:else if block.type === "paragraph"}
            <p>{block.text}</p>
          {:else if block.type === "callout"}
            <aside class="preview-directive preview-directive--callout">
              <span>Callout</span>
              <strong>{block.label}</strong>
              {#if block.body}<p>{block.body}</p>{/if}
            </aside>
          {:else if block.type === "figure"}
            <figure class="preview-directive preview-directive--figure">
              <div class="preview-media-placeholder">FIG</div>
              {#if block.body}<p>{block.body}</p>{/if}
              <figcaption>{block.label}</figcaption>
            </figure>
          {:else if block.type === "gallery"}
            <section class="preview-directive preview-directive--gallery">
              <span>Gallery</span>
              <strong>{block.label}</strong>
              <div class="preview-gallery-grid"><i></i><i></i><i></i></div>
              {#if block.body}<p>{block.body}</p>{/if}
            </section>
          {:else if block.type === "video"}
            <section class="preview-directive preview-directive--video">
              <span>Video</span>
              <strong>{block.label}</strong>
              <p>{block.body}</p>
            </section>
          {:else if block.type === "evidence"}
            <section class="preview-directive preview-directive--evidence">
              <span>Evidence</span>
              <strong>{block.label}</strong>
              {#if block.body}<p>{block.body}</p>{/if}
            </section>
          {/if}
        {/each}
      </article>
    {:else if mode === "source"}
      <section class="composer-write source-mode">
        <div class="write-rail">
          <span>SOURCE</span>
          <span>FM 2.0</span>
        </div>
        <textarea bind:this={textarea} bind:value={body} spellcheck="false" aria-label="Fuwari Markdown source"></textarea>
      </section>
    {:else}
      <section class="composer-write">
        <div class="write-rail">
          <span>WRITE</span>
          <span>CREPE</span>
        </div>
        <MilkdownSurface bind:this={milkdownSurface} value={body} on:change={(event) => (body = event.detail)} on:slash={openSlashMenu} />
      </section>
    {/if}
  </main>

  {#if slashOpen}
    <section class="slash-menu" style={`left: ${slashX}px; top: ${slashY + 8}px;`}>
      <div class="slash-menu__search">
        <span>/</span>
        <input bind:value={slashQuery} placeholder="Fuwari block or Markdown command" on:keydown={(event) => event.key === "Escape" && closeSlashMenu()} />
      </div>
      <div class="slash-menu__list">
        {#each slashItems as item}
          <button type="button" on:click={() => applySlashItem(item)}>
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
          </button>
        {/each}
      </div>
    </section>
  {/if}

  {#if metadataOpen}
    <button class="metadata-modal-backdrop" type="button" aria-label="Close metadata editor" on:click={() => (metadataOpen = false)}></button>
    <div class="metadata-modal" role="dialog" aria-modal="true" aria-label="Edit post metadata">
      <header>
        <strong>Edit post details</strong>
        <button type="button" aria-label="Close metadata editor" on:click={() => (metadataOpen = false)}>×</button>
      </header>
      <div class="metadata-modal__body">
        <label>
          <span>Description</span>
          <input bind:value={description} placeholder="首页卡片和文章标题下方的摘要" />
        </label>
        <div class="metadata-modal__grid">
          <label>
            <span>Category</span>
            <input bind:value={category} />
          </label>
          <label>
            <span>Date</span>
            <input bind:value={published} type="date" />
          </label>
        </div>
        <label>
          <span>Tags</span>
          <input bind:value={tags} placeholder="Astro, UI" />
        </label>
        <label>
          <span>Cover</span>
          <input bind:value={cover} placeholder="Optional" />
        </label>
        <button class:draft-active={draft} type="button" on:click={() => (draft = !draft)}>{draft ? "Draft" : "Live"}</button>
      </div>
      <footer>
        <button type="button" on:click={() => (metadataOpen = false)}>Done</button>
      </footer>
    </div>
  {/if}
</section>

<style>
  .composer-shell {
    display: grid;
    gap: 0.62rem;
    max-width: 82rem;
    margin: 0 auto;
  }
  .composer-top {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8rem;
    padding: 0.5rem 0.62rem;
  }
  .composer-back,
  .composer-actions button {
    border-radius: 999px;
    border: 1px solid rgb(255 255 255 / 0.08);
    background: rgb(255 255 255 / 0.038);
    padding: 0.48rem 0.72rem;
    color: rgb(255 255 255 / 0.68);
    font-size: 0.76rem;
    font-weight: 850;
  }
  .composer-back,
  .composer-actions .commit {
    color: var(--primary);
    background: color-mix(in oklch, var(--primary) 12%, transparent);
  }
  .composer-status {
    display: flex;
    align-items: baseline;
    gap: 0.55rem;
    min-width: 0;
  }
  .composer-status strong {
    color: rgb(255 255 255 / 0.86);
    font-size: 0.92rem;
  }
  .composer-status span:last-child {
    color: rgb(255 255 255 / 0.36);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.68rem;
  }
  .composer-actions {
    display: flex;
    align-items: center;
    gap: 0.28rem;
  }
  .composer-actions button {
    text-transform: capitalize;
  }
  .composer-actions button.active {
    color: var(--primary);
    background: color-mix(in oklch, var(--primary) 18%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--primary) 22%, transparent);
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
  .composer-title,
  .composer-write textarea,
  .metadata-modal input {
    width: 100%;
    border: 0;
    background: transparent;
    color: rgb(255 255 255 / 0.88);
    outline: none;
  }
  .composer-title {
    display: block;
    max-width: 62rem;
    font-size: clamp(2.35rem, 5.8vw, 4.75rem);
    font-weight: 900;
    letter-spacing: -0.075em;
    line-height: 0.9;
  }
  .metadata-rail {
    border-left: 1px solid rgb(255 255 255 / 0.065);
    padding-left: 1rem;
    color: rgb(255 255 255 / 0.55);
  }
  .metadata-rail__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.72rem;
  }
  .metadata-rail__head strong {
    color: rgb(255 255 255 / 0.84);
    font-size: 0.98rem;
    font-weight: 900;
    letter-spacing: -0.025em;
  }
  .metadata-rail__head button {
    border-radius: 999px;
    width: 1.8rem;
    height: 1.8rem;
    color: rgb(255 255 255 / 0.42);
    background: rgb(255 255 255 / 0.035);
  }
  .metadata-rail p {
    margin: 0;
    color: rgb(255 255 255 / 0.58);
    font-size: 0.88rem;
    line-height: 1.55;
  }
  .metadata-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.32rem;
    margin-top: 0.75rem;
  }
  .metadata-tags span {
    border-radius: 999px;
    background: color-mix(in oklch, var(--primary) 12%, transparent);
    padding: 0.22rem 0.5rem;
    color: var(--primary);
    font-size: 0.68rem;
    font-weight: 850;
  }
  .metadata-rail dl {
    display: grid;
    gap: 0.42rem;
    margin: 0.82rem 0 0;
  }
  .metadata-rail dl div {
    display: flex;
    justify-content: space-between;
    gap: 0.7rem;
    color: rgb(255 255 255 / 0.42);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.62rem;
  }
  .metadata-rail dt {
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .metadata-rail dd {
    margin: 0;
    max-width: 11rem;
    color: rgb(255 255 255 / 0.58);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .composer-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.08rem;
    border-block: 1px solid rgb(255 255 255 / 0.06);
    padding: 0.22rem clamp(0.8rem, 2.4vw, 1.35rem);
    background:
      linear-gradient(90deg, rgb(255 255 255 / 0.018), transparent 22%, rgb(255 255 255 / 0.014)),
      rgb(0 0 0 / 0.11);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.035);
  }
  .composer-toolbar button {
    display: grid;
    grid-template-rows: 1.28rem auto;
    place-items: center;
    gap: 0.02rem;
    min-width: 3.15rem;
    min-height: 2.72rem;
    border: 0;
    border-radius: 0.42rem;
    background: transparent;
    padding: 0.2rem 0.32rem;
    color: rgb(255 255 255 / 0.58);
    text-align: center;
    transition: background 140ms ease, color 140ms ease, transform 140ms ease;
  }
  .composer-toolbar button:hover {
    transform: translateY(-1px);
    background: rgb(255 255 255 / 0.055);
    color: rgb(255 255 255 / 0.84);
  }
  .composer-toolbar button:active {
    transform: translateY(0);
    background: color-mix(in oklch, var(--primary) 13%, transparent);
  }
  .composer-toolbar button strong {
    color: inherit;
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.92rem;
    font-weight: 900;
    line-height: 1;
  }
  .composer-toolbar button span {
    color: rgb(255 255 255 / 0.48);
    font-size: 0.6rem;
    font-weight: 780;
    line-height: 1;
    white-space: nowrap;
  }
  .composer-toolbar button:nth-child(4),
  .composer-toolbar button:nth-child(7),
  .composer-toolbar button:nth-child(9) {
    margin-left: 0.44rem;
    box-shadow: -0.5rem 0 0 -0.46rem rgb(255 255 255 / 0.11);
  }
  .composer-toolbar .toolbar-block {
    min-width: 2.82rem;
    color: rgb(255 255 255 / 0.44);
  }
  .composer-toolbar .toolbar-block strong {
    color: color-mix(in oklch, var(--primary) 58%, rgb(255 255 255 / 0.52));
  }
  .composer-toolbar .toolbar-block:hover {
    color: rgb(255 255 255 / 0.76);
    background: color-mix(in oklch, var(--primary) 7%, rgb(255 255 255 / 0.035));
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
  .composer-write textarea {
    min-height: 31rem;
    resize: vertical;
    padding: 1.1rem clamp(1.05rem, 3vw, 2.25rem) 1.7rem;
    color: rgb(255 255 255 / 0.75);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.95rem;
    line-height: 1.82;
  }
  .composer-write:not(.source-mode) textarea {
    font-family: inherit;
    font-size: 1rem;
  }
  .composer-preview {
    min-height: 31rem;
    padding: clamp(1.15rem, 3vw, 2.2rem);
  }
  .preview-label {
    margin-bottom: 0.8rem;
    color: rgb(255 255 255 / 0.33);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }
  .composer-preview h1 {
    color: rgb(255 255 255 / 0.92);
    font-size: clamp(2.2rem, 5.2vw, 4.4rem);
    font-weight: 900;
    letter-spacing: -0.075em;
    line-height: 0.92;
  }
  .preview-dek,
  .composer-preview p {
    max-width: 44rem;
    color: rgb(255 255 255 / 0.6);
    line-height: 1.75;
  }
  .composer-preview h2 {
    margin-top: 1.7rem;
    color: rgb(255 255 255 / 0.84);
    font-size: 1.45rem;
    letter-spacing: -0.04em;
  }
  .preview-directive {
    position: relative;
    margin: 1rem 0;
    max-width: 48rem;
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 1rem;
    background:
      radial-gradient(circle at 0% 0%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 42%),
      rgb(255 255 255 / 0.032);
    padding: 0.9rem 1rem;
    overflow: hidden;
  }
  .preview-directive span {
    display: block;
    margin-bottom: 0.26rem;
    color: rgb(255 255 255 / 0.34);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .preview-directive strong,
  .preview-directive figcaption {
    display: block;
    color: rgb(255 255 255 / 0.86);
    font-size: 1rem;
    font-weight: 900;
    letter-spacing: -0.025em;
  }
  .preview-directive p {
    margin: 0.42rem 0 0;
    color: rgb(255 255 255 / 0.58);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.76rem;
    line-height: 1.65;
    white-space: pre-wrap;
  }
  .preview-directive--callout {
    border-color: color-mix(in oklch, var(--primary) 24%, transparent);
  }
  .preview-directive--evidence {
    border-left: 3px solid color-mix(in oklch, var(--primary) 52%, transparent);
  }
  .preview-media-placeholder {
    display: grid;
    place-items: center;
    height: 8.5rem;
    margin-bottom: 0.75rem;
    border: 1px dashed rgb(255 255 255 / 0.12);
    border-radius: 0.8rem;
    background: rgb(0 0 0 / 0.16);
    color: rgb(255 255 255 / 0.24);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-weight: 900;
    letter-spacing: 0.16em;
  }
  .preview-gallery-grid {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr 0.8fr;
    gap: 0.35rem;
    margin-top: 0.65rem;
  }
  .preview-gallery-grid i {
    min-height: 4.8rem;
    border-radius: 0.7rem;
    background: linear-gradient(135deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.025));
  }
  .preview-directive--video::after {
    content: "▶";
    position: absolute;
    right: 1rem;
    top: 1rem;
    color: var(--primary);
    font-size: 1.25rem;
  }
  .slash-menu {
    position: fixed;
    z-index: 90;
    width: min(22rem, calc(100vw - 2rem));
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 1rem;
    background:
      radial-gradient(circle at 0% 0%, color-mix(in oklch, var(--primary) 13%, transparent), transparent 42%),
      color-mix(in oklch, var(--card-bg) 96%, black 4%);
    box-shadow: 0 22px 70px rgb(0 0 0 / 0.38);
    overflow: hidden;
  }
  .slash-menu__search {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.45rem;
    border-bottom: 1px solid rgb(255 255 255 / 0.08);
    padding: 0.72rem 0.82rem;
  }
  .slash-menu__search span {
    color: var(--primary);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 1.05rem;
    font-weight: 900;
  }
  .slash-menu__search input {
    border: 0;
    background: transparent;
    color: rgb(255 255 255 / 0.78);
    outline: none;
    font-size: 0.86rem;
  }
  .slash-menu__list {
    display: grid;
    gap: 0.22rem;
    max-height: 20rem;
    overflow: auto;
    padding: 0.45rem;
  }
  .slash-menu__list button {
    display: grid;
    gap: 0.08rem;
    border-radius: 0.72rem;
    padding: 0.56rem 0.66rem;
    text-align: left;
    transition: background 150ms ease, transform 150ms ease;
  }
  .slash-menu__list button:hover {
    transform: translateX(2px);
    background: color-mix(in oklch, var(--primary) 10%, transparent);
  }
  .slash-menu__list strong {
    color: rgb(255 255 255 / 0.82);
    font-size: 0.84rem;
  }
  .slash-menu__list span {
    color: rgb(255 255 255 / 0.38);
    font-size: 0.68rem;
  }
  .metadata-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.48);
    backdrop-filter: blur(12px);
    padding: 1rem;
  }
  .metadata-modal {
    width: min(40rem, 100%);
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 1rem;
    background: color-mix(in oklch, var(--card-bg) 96%, black 4%);
    box-shadow: 0 26px 80px rgb(0 0 0 / 0.42);
    overflow: hidden;
  }
  .metadata-modal header,
  .metadata-modal footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgb(255 255 255 / 0.08);
    padding: 0.9rem 1rem;
  }
  .metadata-modal footer {
    justify-content: flex-end;
    border-top: 1px solid rgb(255 255 255 / 0.08);
    border-bottom: 0;
  }
  .metadata-modal header strong {
    color: rgb(255 255 255 / 0.9);
    font-size: 0.98rem;
    font-weight: 900;
  }
  .metadata-modal button {
    border-radius: 0.72rem;
    background: rgb(255 255 255 / 0.06);
    padding: 0.5rem 0.75rem;
    color: rgb(255 255 255 / 0.76);
    font-weight: 850;
  }
  .metadata-modal header button {
    width: 2rem;
    height: 2rem;
    padding: 0;
    color: rgb(255 255 255 / 0.5);
  }
  .metadata-modal__body {
    display: grid;
    gap: 0.95rem;
    padding: 1rem;
  }
  .metadata-modal__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .metadata-modal label {
    display: grid;
    gap: 0.4rem;
  }
  .metadata-modal label span {
    color: rgb(255 255 255 / 0.8);
    font-size: 0.82rem;
    font-weight: 850;
  }
  .metadata-modal input {
    border: 1px solid rgb(255 255 255 / 0.1);
    border-radius: 0.72rem;
    background: rgb(0 0 0 / 0.16);
    padding: 0.62rem 0.75rem;
    color: rgb(255 255 255 / 0.8);
  }
  .metadata-modal .draft-active {
    color: var(--primary);
    background: color-mix(in oklch, var(--primary) 12%, transparent);
  }
  @media (max-width: 1100px) {
    .composer-hero { grid-template-columns: 1fr; }
    .metadata-rail {
      border-left: 0;
      border-top: 1px solid rgb(255 255 255 / 0.065);
      padding: 0.85rem 0 0;
    }
  }
  @media (max-width: 760px) {
    .composer-top { grid-template-columns: 1fr; }
    .composer-actions { overflow-x: auto; }
    .composer-title { font-size: clamp(2.4rem, 14vw, 4.2rem); }
    .metadata-modal__grid { grid-template-columns: 1fr; }
    .composer-write { grid-template-columns: 1fr; }
    .write-rail { display: none; }
  }
</style>
