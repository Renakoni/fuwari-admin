<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import { Crepe } from "@milkdown/crepe";
  import { editorViewCtx } from "@milkdown/kit/core";
  import { Fragment, type Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
  import { TextSelection } from "@milkdown/kit/prose/state";
  import type { EditorView } from "@milkdown/kit/prose/view";
  import { defaultImageBlock, imageNote, isImagePlaceholder, parseImageBlock, serializeImageBlock } from "./imageBlock";
  import "@milkdown/crepe/theme/frame-dark.css";

  type FuwariBlockKind = "note" | "warning" | "figure" | "video" | "evidence";

  export let value = "";
  export let placeholder = "Start writing with Fuwari Markdown...";
  export let pendingImages = new Map<string, PendingImage>();

  type PendingImage = {
    src: string;
    objectUrl: string;
    name: string;
    size: number;
    type: string;
  };

  const dispatch = createEventDispatcher<{ change: string; slash: { x: number; y: number }; selectImage: PendingImage }>();

  const COPY_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`;
  const LANGUAGE_OPTIONS = [
    "C",
    "C++",
    "CQL",
    "CSS",
    "Go",
    "HTML",
    "Java",
    "JavaScript",
    "JSON",
    "JSX",
    "Markdown",
    "PHP",
    "PLSQL",
    "PostgreSQL",
    "Python",
    "Rust",
    "Sass",
    "SCSS",
    "SQL",
    "SQLite",
    "TSX",
    "TypeScript",
    "XML",
    "YAML",
  ];

  let root: HTMLDivElement;
  let crepe: Crepe | null = null;
  let copyObserver: MutationObserver | null = null;
  let syncingEditorChrome = false;
  let copiedUntil = 0;
  let internalValue = "";

  onMount(async () => {
    internalValue = value;
    crepe = new Crepe({
      root,
      defaultValue: value,
      features: {
        [Crepe.Feature.BlockEdit]: false,
        [Crepe.Feature.Toolbar]: false,
        [Crepe.Feature.ImageBlock]: false,
        [Crepe.Feature.LinkTooltip]: false,
        [Crepe.Feature.Cursor]: false,
        [Crepe.Feature.ListItem]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: placeholder,
          mode: "block",
        },
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown) => {
        internalValue = markdown;
        dispatch("change", markdown);
      });
    });

    await crepe.create();
    root.addEventListener("keydown", handleKeydown, { capture: true });
    document.addEventListener("pointerdown", handleDocumentCopyPointerDown, true);
    syncEditorChrome();
    copyObserver = new MutationObserver(syncEditorChrome);
    copyObserver.observe(root, { childList: true, subtree: true });
  });

  $: if (crepe && value !== internalValue) {
    internalValue = value;
  }

  $: if (root && pendingImages) syncImageCards();

  function safeImageSrc(name: string) {
    const trimmed = name.trim().toLowerCase();
    const lastDot = trimmed.lastIndexOf(".");
    const base = (lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed)
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image";
    const ext = lastDot > 0 ? trimmed.slice(lastDot + 1).replace(/[^a-z0-9]/g, "") : "png";
    return `./${base}.${ext || "png"}`;
  }

  function handleKeydown(event: KeyboardEvent) {
    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && event.shiftKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setCodeBlock();
      return;
    }
    if (isMod && /^[1-6]$/.test(event.key)) {
      event.preventDefault();
      setHeading(Number(event.key));
      return;
    }
    if (isMod && event.key === "0") {
      event.preventDefault();
      setParagraph();
      return;
    }
    if (isMod && event.key.toLowerCase() === "b") {
      event.preventDefault();
      toggleMark(["strong", "bold"]);
      return;
    }
    if (isMod && event.key.toLowerCase() === "i") {
      event.preventDefault();
      toggleMark(["emphasis", "em", "italic"]);
      return;
    }
    if (isMod && event.key.toLowerCase() === "k") {
      event.preventDefault();
      insertLink();
      return;
    }
    if (event.key !== "/" || !crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { from, empty } = view.state.selection;
      if (!empty) return;
      event.preventDefault();
      const coords = view.coordsAtPos(from);
      dispatch("slash", { x: coords.left, y: coords.bottom });
    });
  }

  function codeBlockText(codeBlock: Element) {
    return Array.from(codeBlock.querySelectorAll(".cm-line"))
      .map((line) => line.textContent ?? "")
      .join("\n");
  }

  function handleDocumentCopyPointerDown(event: PointerEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest(".fuwari-copy-button");
    if (!(button instanceof HTMLButtonElement)) return;
    const codeBlock = button.closest(".milkdown-code-block");
    if (!codeBlock || !root?.contains(codeBlock)) return;
    event.preventDefault();
    event.stopPropagation();
    void markCustomCopy(button, codeBlock);
  }

  async function markCustomCopy(button: HTMLButtonElement, codeBlock: Element) {
    const text = codeBlockText(codeBlock);
    copiedUntil = Date.now() + 1200;
    button.dataset.copied = "true";
    button.innerHTML = "✓";
    window.setTimeout(() => {
      button.dataset.copied = "";
      button.innerHTML = COPY_ICON;
      syncEditorChrome();
    }, 1200);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Clipboard permissions vary between browsers and dev contexts.
    }
  }

  function syncEditorChrome() {
    if (syncingEditorChrome) return;
    syncingEditorChrome = true;
    copyObserver?.disconnect();
    try {
      syncCopyButtons();
      syncImageCards();
    } finally {
      if (root) copyObserver?.observe(root, { childList: true, subtree: true });
      syncingEditorChrome = false;
    }
  }

  function syncCopyButtons() {
    root?.querySelectorAll(".milkdown-code-block").forEach((codeBlock) => {
      const language = getCodeBlockLanguage(codeBlock).trim().toLowerCase();
      const isCalloutBlock = ["note", "warning", "proof"].includes(language);
      codeBlock.toggleAttribute("data-fuwari-video", language === "video");
      codeBlock.toggleAttribute("data-fuwari-image", language === "image");
      codeBlock.toggleAttribute("data-fuwari-callout", isCalloutBlock);
      codeBlock.setAttribute("data-fuwari-language", language || "text");
      if (language === "image") {
        codeBlock.querySelector(".fuwari-copy-button")?.remove();
      } else {
        let button = codeBlock.querySelector(".fuwari-copy-button") as HTMLButtonElement | null;
        if (!button) {
          button = document.createElement("button");
          button.type = "button";
          button.className = "fuwari-copy-button";
          button.setAttribute("aria-label", "Copy code");
          button.innerHTML = COPY_ICON;
          button.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            void markCustomCopy(button!, codeBlock);
          });
          codeBlock.append(button);
        }
      }
      syncLanguageInput(codeBlock);
    });
  }

  function syncImageCards() {
    root?.querySelectorAll(".milkdown-code-block").forEach((codeBlock) => {
      const language = getCodeBlockLanguage(codeBlock).trim().toLowerCase();
      if (language !== "image") {
        codeBlock.querySelector(".fuwari-image-card")?.remove();
        return;
      }
      let card = codeBlock.querySelector(".fuwari-image-card") as HTMLDivElement | null;
      if (!card) {
        card = createImageCard(codeBlock);
        codeBlock.append(card);
      }
      updateImageCard(codeBlock, card);
    });
  }

  function createImageCard(codeBlock: Element) {
    const card = document.createElement("div");
    card.className = "fuwari-image-card";
    card.contentEditable = "false";
    card.addEventListener("pointerdown", (event) => event.stopPropagation());
    card.addEventListener("keydown", (event) => event.stopPropagation());
    card.innerHTML = `
      <div class="fuwari-image-card-preview"><div class="fuwari-image-card-fallback"><span>IMG</span></div><img alt="" /></div>
      <div class="fuwari-image-card-body">
        <div class="fuwari-image-card-fields">
          <label>src<input class="fuwari-image-card-src" spellcheck="false" /></label>
          <label>note<input class="fuwari-image-card-note-input" /></label>
        </div>
        <div class="fuwari-image-card-actions">
          <input class="fuwari-image-card-file" type="file" accept="image/*" />
          <button class="fuwari-image-card-pick" type="button">选择图片</button>
          <span class="fuwari-image-card-status"></span>
        </div>
      </div>
      <button class="fuwari-image-card-delete" type="button" aria-label="Delete image block">×</button>
    `;
    card.querySelector("img")?.addEventListener("error", () => {
      const img = card.querySelector("img") as HTMLImageElement | null;
      card.dataset.failedSrc = img?.getAttribute("src") || "";
      card.removeAttribute("data-has-image");
      img?.removeAttribute("src");
    });
    card.querySelectorAll(".fuwari-image-card-src, .fuwari-image-card-note-input").forEach((input) => {
      input.addEventListener("input", () => updateImageBlockFromCard(codeBlock, card));
    });
    card.querySelector(".fuwari-image-card-pick")?.addEventListener("click", () => {
      (card.querySelector(".fuwari-image-card-file") as HTMLInputElement | null)?.click();
    });
    card.querySelector(".fuwari-image-card-file")?.addEventListener("change", () => selectImageFile(codeBlock, card));
    card.querySelector(".fuwari-image-card-delete")?.addEventListener("click", () => deleteCodeBlock(codeBlock));
    return card;
  }

  function updateImageCard(codeBlock: Element, card: HTMLDivElement) {
    const image = parseImageBlock(getCodeBlockNodeText(codeBlock));
    const srcInput = card.querySelector(".fuwari-image-card-src") as HTMLInputElement | null;
    const noteInput = card.querySelector(".fuwari-image-card-note-input") as HTMLInputElement | null;
    if (srcInput && document.activeElement !== srcInput) srcInput.value = image.src;
    if (noteInput && document.activeElement !== noteInput) noteInput.value = imageNote(image);

    const img = card.querySelector("img") as HTMLImageElement | null;
    const pickButton = card.querySelector(".fuwari-image-card-pick") as HTMLButtonElement | null;
    const status = card.querySelector(".fuwari-image-card-status") as HTMLSpanElement | null;
    const pendingImage = pendingImages.get(image.src);
    const previewSrc = pendingImage?.objectUrl || image.src;
    const showFallback = !pendingImage && (isImagePlaceholder(image.src) || card.dataset.failedSrc === image.src);
    if (card.dataset.failedSrc && card.dataset.failedSrc !== image.src) card.dataset.failedSrc = "";
    card.toggleAttribute("data-has-image", !showFallback);
    if (pickButton) pickButton.textContent = pendingImage ? "更换图片" : "选择图片";
    if (status) status.textContent = pendingImage ? "未上传，仅本地预览" : "";
    if (img) {
      img.alt = image.alt || image.caption;
      if (!showFallback && img.getAttribute("src") !== previewSrc) img.src = previewSrc;
      if (showFallback) img.removeAttribute("src");
    }
  }

  function selectImageFile(codeBlock: Element, card: HTMLDivElement) {
    const input = card.querySelector(".fuwari-image-card-file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!input || !file) return;
    if (!file.type.startsWith("image/")) {
      const status = card.querySelector(".fuwari-image-card-status") as HTMLSpanElement | null;
      if (status) status.textContent = "请选择图片文件";
      input.value = "";
      return;
    }
    const src = safeImageSrc(file.name);
    const objectUrl = URL.createObjectURL(file);
    const note = (card.querySelector(".fuwari-image-card-note-input") as HTMLInputElement | null)?.value ?? defaultImageBlock.caption;
    updateImageBlockText(codeBlock, serializeImageBlock({ src, alt: note, caption: note }));
    dispatch("selectImage", { src, objectUrl, name: file.name, size: file.size, type: file.type });
    input.value = "";
  }

  function getCodeBlockNodeText(codeBlock: Element) {
    let text = codeBlockText(codeBlock);
    crepe?.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const found = findCodeBlockPosition(view, codeBlock);
      if (found) text = found.node.textContent;
    });
    return text;
  }

  function updateImageBlockFromCard(codeBlock: Element, card: Element) {
    const src = (card.querySelector(".fuwari-image-card-src") as HTMLInputElement | null)?.value ?? "";
    const note = (card.querySelector(".fuwari-image-card-note-input") as HTMLInputElement | null)?.value ?? defaultImageBlock.caption;
    updateImageBlockText(codeBlock, serializeImageBlock({ src, alt: note, caption: note }));
  }

  function updateImageBlockText(codeBlock: Element, text: string) {
    crepe?.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const found = findCodeBlockPosition(view, codeBlock);
      const codeBlockNode = view.state.schema.nodes.code_block;
      if (!found || !codeBlockNode) return;
      const nextNode = codeBlockNode.create({ ...found.node.attrs, language: "image" }, view.state.schema.text(text));
      view.dispatch(view.state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, nextNode));
    });
  }

  function deleteCodeBlock(codeBlock: Element) {
    crepe?.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const found = findCodeBlockPosition(view, codeBlock);
      if (!found) return;
      view.dispatch(view.state.tr.delete(found.pos, found.pos + found.node.nodeSize).scrollIntoView());
      view.focus();
    });
  }

  function findCodeBlockPosition(view: EditorView, codeBlock: Element) {
    let found: { pos: number; node: ProseMirrorNode } | null = null;
    view.state.doc.descendants((node, pos) => {
      if (found || node.type.name !== "code_block") return false;
      if (view.nodeDOM(pos) === codeBlock) {
        found = { pos, node };
        return false;
      }
      return true;
    });
    return found;
  }

  function getCodeBlockLanguage(codeBlock: Element) {
    let language = "";
    crepe?.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const found = findCodeBlockPosition(view, codeBlock);
      language = String(found?.node.attrs.language ?? "");
    });
    return language;
  }

  function setCodeBlockLanguage(codeBlock: Element, language: string) {
    crepe?.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const found = findCodeBlockPosition(view, codeBlock);
      if (!found) return;
      view.dispatch(view.state.tr.setNodeAttribute(found.pos, "language", language));
    });
  }

  function syncLanguageInput(codeBlock: Element) {
    const languageButton = codeBlock.querySelector(".language-button") as HTMLButtonElement | null;
    if (!languageButton) return;
    let input = codeBlock.querySelector(".fuwari-language-input") as HTMLInputElement | null;
    if (!input) {
      input = document.createElement("input");
      input.className = "fuwari-language-input";
      input.setAttribute("aria-label", "Code language");
      input.spellcheck = false;
      input.value = "";
      input.placeholder = "";
      input.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        input!.focus();
      });
      input.addEventListener("input", () => renderLanguageSuggestions(codeBlock, input!.value));
      input.addEventListener("blur", () => {
        window.setTimeout(() => renderLanguageSuggestions(codeBlock, ""), 120);
      });
      codeBlock.append(input);
    }
    const selectedLanguage = getCodeBlockLanguage(codeBlock);
    if (document.activeElement !== input) {
      input.value = selectedLanguage;
    }
  }

  function renderLanguageSuggestions(codeBlock: Element, query: string) {
    let list = codeBlock.querySelector(".fuwari-language-suggestions") as HTMLDivElement | null;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      list?.remove();
      return;
    }
    const matches = LANGUAGE_OPTIONS.filter((item) => item.toLowerCase().startsWith(normalizedQuery)).slice(0, 5);
    if (matches.length === 0) {
      list?.remove();
      return;
    }
    if (!list) {
      list = document.createElement("div");
      list.className = "fuwari-language-suggestions";
      codeBlock.append(list);
    }
    list.replaceChildren(...matches.map((language) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = language;
      item.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectLanguage(codeBlock, language);
      });
      return item;
    }));
  }

  function selectLanguage(codeBlock: Element, language: string) {
    const input = codeBlock.querySelector(".fuwari-language-input") as HTMLInputElement | null;
    if (!input) return;
    input.value = language;
    setCodeBlockLanguage(codeBlock, language);
    codeBlock.querySelector(".fuwari-language-suggestions")?.remove();
  }

  export function getMarkdown() {
    return crepe?.getMarkdown() ?? internalValue;
  }

  export function focus() {
    crepe?.editor.action((ctx) => {
      ctx.get(editorViewCtx).focus();
    });
  }

  function applyMark(markNames: string[], attrs: Record<string, unknown> = {}) {
    if (!crepe) return false;
    let applied = false;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const markType = markNames.map((name) => view.state.schema.marks[name]).find(Boolean);
      if (!markType) return;
      const { from, to, empty } = view.state.selection;
      const tr = view.state.tr;
      if (empty) {
        const active = Boolean(markType.isInSet(view.state.storedMarks ?? view.state.selection.$from.marks()));
        view.dispatch(active ? tr.removeStoredMark(markType) : tr.addStoredMark(markType.create(attrs)));
      } else if (view.state.doc.rangeHasMark(from, to, markType)) {
        view.dispatch(tr.removeMark(from, to, markType));
      } else {
        view.dispatch(tr.addMark(from, to, markType.create(attrs)));
      }
      view.focus();
      applied = true;
    });
    return applied;
  }

  export function toggleMark(markNames: string[]) {
    applyMark(markNames);
  }

  export function insertMarkdown(markdown: string) {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { from, to } = view.state.selection;
      view.dispatch(view.state.tr.insertText(markdown, from, to));
      view.focus();
    });
  }

  function insertAfterCurrentBlock(view: any, nodes: any[]) {
    const { $from, to } = view.state.selection;
    const insertAt = $from.depth > 0 ? $from.after($from.depth) : to;
    const fragment = Fragment.fromArray(nodes);
    const tr = view.state.tr.insert(insertAt, fragment);
    const cursor = Math.min(insertAt + fragment.size, tr.doc.content.size);
    view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(cursor))).scrollIntoView());
    view.focus();
  }

  export function insertFuwariBlock(kind: FuwariBlockKind) {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { schema } = view.state;
      const codeBlock = schema.nodes.code_block;
      const nodes = {
        note: () => [codeBlock.create({ language: "note" }, schema.text("title: 提示标题\n写下关键提示或补充说明。"))],
        warning: () => [codeBlock.create({ language: "warning" }, schema.text("title: 注意事项\n说明风险、限制或需要读者特别留意的地方。"))],
        figure: () => [codeBlock.create({ language: "image" }, schema.text(serializeImageBlock()))],
        video: () => [codeBlock.create({ language: "video" }, schema.text("src: https://www.youtube.com/embed/VIDEO_ID\nnote: 视频注记"))],
        evidence: () => [codeBlock.create({ language: "proof" }, schema.text("title: 证据\n来源、观察或支撑结论的材料。"))],
      }[kind]();
      insertAfterCurrentBlock(view, nodes);
    });
  }

  export function insertBlockquote() {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { schema } = view.state;
      const paragraph = schema.nodes.paragraph;
      const blockquote = schema.nodes.blockquote;
      if (!paragraph || !blockquote) return;
      insertAfterCurrentBlock(view, [blockquote.create(null, [paragraph.create(null, schema.text("引用内容"))])]);
    });
  }

  export function insertList(ordered = false) {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { schema } = view.state;
      const list = ordered ? schema.nodes.ordered_list : schema.nodes.bullet_list;
      const listItem = schema.nodes.list_item;
      const paragraph = schema.nodes.paragraph;
      if (!list || !listItem || !paragraph) return;
      insertAfterCurrentBlock(view, [list.create(null, [listItem.create(null, [paragraph.create(null, schema.text("列表项"))])])]);
    });
  }

  export function wrapSelection(before: string, after: string) {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { from, to, empty } = view.state.selection;
      const selected = empty ? "text" : view.state.doc.textBetween(from, to, "\n");
      const next = `${before}${selected}${after}`;
      view.dispatch(view.state.tr.insertText(next, from, to));
      view.focus();
    });
  }

  export function toggleWrap(before: string, after: string) {
    if (before === "**" && after === "**" && applyMark(["strong", "bold"])) return;
    if (before === "*" && after === "*" && applyMark(["emphasis", "em", "italic"])) return;
    wrapSelection(before, after);
  }

  function currentTextblockRange(view: any) {
    const { $from } = view.state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).isTextblock) {
        return { from: $from.before(depth), to: $from.after(depth) };
      }
    }
    return null;
  }

  export function setHeading(level = 2) {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const heading = view.state.schema.nodes.heading;
      if (!heading) return;
      const range = currentTextblockRange(view);
      if (!range) return;
      const tr = view.state.tr.setBlockType(range.from, range.to, heading, { level });
      const cursor = Math.min(view.state.selection.from, tr.doc.content.size);
      view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(cursor))).scrollIntoView());
      view.focus();
    });
  }

  export function setCodeBlock() {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const codeBlock = view.state.schema.nodes.code_block;
      if (!codeBlock) return;
      const range = currentTextblockRange(view);
      if (!range) return;
      const tr = view.state.tr.setBlockType(range.from, range.to, codeBlock);
      const cursor = Math.min(view.state.selection.from, tr.doc.content.size);
      view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(cursor))).scrollIntoView());
      view.focus();
    });
  }

  export function setParagraph() {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const paragraph = view.state.schema.nodes.paragraph;
      if (!paragraph) return;
      const range = currentTextblockRange(view);
      if (!range) return;
      const tr = view.state.tr.setBlockType(range.from, range.to, paragraph);
      const cursor = Math.min(view.state.selection.from, tr.doc.content.size);
      view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(cursor))).scrollIntoView());
      view.focus();
    });
  }

  export function insertLink() {
    if (applyMark(["link"], { href: "https://" })) return;
    wrapSelection("[", "](https://)");
  }

  onDestroy(() => {
    root?.removeEventListener("keydown", handleKeydown, { capture: true });
    if (typeof document !== "undefined") {
      document.removeEventListener("pointerdown", handleDocumentCopyPointerDown, true);
    }
    copyObserver?.disconnect();
    copyObserver = null;
    crepe?.destroy();
    crepe = null;
  });
</script>

<div class="milkdown-frame">
  <div bind:this={root} class="milkdown-root"></div>
</div>

<style>
  .milkdown-frame {
    min-height: 31rem;
    color: rgb(255 255 255 / 0.76);
  }
  .milkdown-root :global(.milkdown) {
    --crepe-color-background: transparent;
    --crepe-color-surface: rgb(255 255 255 / 0.04);
    --crepe-color-surface-low: rgb(255 255 255 / 0.026);
    --crepe-color-on-background: rgb(255 255 255 / 0.78);
    --crepe-color-on-surface: rgb(255 255 255 / 0.74);
    --crepe-color-outline: rgb(255 255 255 / 0.075);
    --crepe-color-primary: var(--primary);
    --crepe-color-secondary: color-mix(in oklch, var(--primary) 18%, transparent);
    --crepe-font-default: inherit;
    --crepe-font-code: "JetBrains Mono Variable", ui-monospace, monospace;
    background: transparent;
  }
  .milkdown-root :global(.ProseMirror) {
    min-height: 31rem;
    padding: 1.08rem clamp(1.05rem, 3vw, 2.25rem) 1.7rem;
    color: rgb(255 255 255 / 0.75);
    font-size: 1rem;
    line-height: 1.82;
    outline: none;
    white-space: pre-wrap;
    caret-color: var(--primary);
    overflow-anchor: none;
  }
  .milkdown-root :global(.ProseMirror h1),
  .milkdown-root :global(.ProseMirror h2),
  .milkdown-root :global(.ProseMirror h3),
  .milkdown-root :global(.ProseMirror h4),
  .milkdown-root :global(.ProseMirror h5),
  .milkdown-root :global(.ProseMirror h6) {
    color: rgb(255 255 255 / 0.9);
    font-weight: 900;
    letter-spacing: -0.052em;
    line-height: 1.16;
  }
  .milkdown-root :global(.ProseMirror h1) {
    margin: 1.35rem 0 0.66rem;
    font-size: clamp(1.68rem, 3.1vw, 2.36rem);
  }
  .milkdown-root :global(.ProseMirror h2) {
    margin: 1.15rem 0 0.58rem;
    font-size: clamp(1.35rem, 2.4vw, 1.85rem);
  }
  .milkdown-root :global(.ProseMirror h3) {
    margin: 1rem 0 0.48rem;
    font-size: clamp(1.16rem, 1.9vw, 1.46rem);
    letter-spacing: -0.04em;
  }
  .milkdown-root :global(.ProseMirror h4) {
    margin: 0.9rem 0 0.38rem;
    font-size: 1.06rem;
    letter-spacing: -0.03em;
  }
  .milkdown-root :global(.ProseMirror h5),
  .milkdown-root :global(.ProseMirror h6) {
    margin: 0.8rem 0 0.3rem;
    color: rgb(255 255 255 / 0.72);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.86rem;
    letter-spacing: 0.03em;
  }
  .milkdown-root :global(.ProseMirror h6) {
    color: rgb(255 255 255 / 0.56);
    text-transform: uppercase;
  }
  .milkdown-root :global(.ProseMirror p) {
    margin: 0.58rem 0;
    min-height: 1.82em;
  }
  .milkdown-root :global(.ProseMirror code) {
    border-radius: 0.36rem;
    background: rgb(255 255 255 / 0.075);
    padding: 0.1rem 0.28rem;
    color: var(--primary);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
  }
  .milkdown-root :global(.ProseMirror pre) {
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 0.86rem;
    background: rgb(0 0 0 / 0.2);
    padding: 0.85rem;
  }
  .milkdown-root :global(.milkdown-code-block) {
    position: relative;
    margin: 1rem 0 2.9rem;
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 0.78rem;
    background: rgb(13 17 23 / 0.58);
    overflow: visible;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.025);
  }
  .milkdown-root :global(.milkdown-code-block .cm-editor) {
    border-radius: 0.78rem;
    overflow: hidden;
  }
  .milkdown-root :global(.milkdown-code-block .cm-editor),
  .milkdown-root :global(.milkdown-code-block .cm-scroller),
  .milkdown-root :global(.milkdown-code-block .cm-gutters) {
    background: transparent !important;
  }
  .milkdown-root :global(.milkdown-code-block .cm-activeLine),
  .milkdown-root :global(.milkdown-code-block .cm-activeLineGutter) {
    background: rgb(255 255 255 / 0.035) !important;
  }
  .milkdown-root :global(.milkdown-code-block .cm-gutters) {
    border-right-color: rgb(255 255 255 / 0.055) !important;
  }
  .milkdown-root :global(.milkdown-code-block[data-fuwari-video]),
  .milkdown-root :global(.milkdown-code-block[data-fuwari-image]),
  .milkdown-root :global(.milkdown-code-block[data-fuwari-callout]) {
    margin-bottom: 1rem;
  }
  .milkdown-root :global(.milkdown-code-block[data-fuwari-image]) {
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  .milkdown-root :global(.milkdown-code-block[data-fuwari-video] .fuwari-language-input),
  .milkdown-root :global(.milkdown-code-block[data-fuwari-video] .fuwari-language-suggestions),
  .milkdown-root :global(.milkdown-code-block[data-fuwari-image] .fuwari-language-input),
  .milkdown-root :global(.milkdown-code-block[data-fuwari-image] .fuwari-language-suggestions),
  .milkdown-root :global(.milkdown-code-block[data-fuwari-callout] .fuwari-language-input),
  .milkdown-root :global(.milkdown-code-block[data-fuwari-callout] .fuwari-language-suggestions) {
    display: none !important;
  }
  .milkdown-root :global(.milkdown-code-block[data-fuwari-video]::before),
  .milkdown-root :global(.milkdown-code-block[data-fuwari-image]::before),
  .milkdown-root :global(.milkdown-code-block[data-fuwari-callout]::before) {
    content: attr(data-fuwari-language);
    position: absolute;
    top: 0.62rem;
    left: 0.74rem;
    z-index: 4;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.06);
    padding: 0.16rem 0.48rem;
    color: rgb(255 255 255 / 0.52);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.68rem;
    font-weight: 850;
  }
  .milkdown-root :global(.milkdown-code-block[data-fuwari-video] .cm-editor),
  .milkdown-root :global(.milkdown-code-block[data-fuwari-callout] .cm-editor) {
    padding-top: 2.2rem;
  }
  .milkdown-root :global(.milkdown-code-block[data-fuwari-callout]) {
    border-color: color-mix(in oklch, var(--primary) 22%, transparent);
    background:
      radial-gradient(circle at 0% 0%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 42%),
      rgb(13 17 23 / 0.62);
  }
  .milkdown-root :global(.milkdown-code-block[data-fuwari-language="warning"]) {
    --primary: oklch(0.78 0.15 75);
  }
  .milkdown-root :global(.milkdown-code-block[data-fuwari-language="proof"]) {
    --primary: oklch(0.75 0.15 310);
  }
  .milkdown-root :global(.milkdown-code-block[data-fuwari-image] .cm-editor) {
    position: absolute;
    inset: 0;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }
  .milkdown-root :global(.milkdown-code-block[data-fuwari-image]::before) {
    display: none;
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-image-card) {
    display: grid;
    grid-template-columns: 4.4rem minmax(0, 1fr) 1.8rem;
    align-items: center;
    gap: 0.7rem;
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 0.78rem;
    background: rgb(255 255 255 / 0.03);
    padding: 0.46rem;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.02);
  }
  .milkdown-root :global(.fuwari-image-card-preview) {
    position: relative;
    width: 4.4rem;
    aspect-ratio: 4 / 3;
    border: 1px dashed rgb(255 255 255 / 0.12);
    border-radius: 0.58rem;
    background: rgb(0 0 0 / 0.18);
    overflow: hidden;
  }
  .milkdown-root :global(.fuwari-image-card-preview img) {
    display: none;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .milkdown-root :global(.fuwari-image-card[data-has-image] .fuwari-image-card-preview img) {
    display: block;
  }
  .milkdown-root :global(.fuwari-image-card[data-has-image] .fuwari-image-card-fallback) {
    display: none;
  }
  .milkdown-root :global(.fuwari-image-card-fallback) {
    display: grid;
    place-items: center;
    height: 100%;
    color: rgb(255 255 255 / 0.36);
  }
  .milkdown-root :global(.fuwari-image-card-fallback span) {
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: 0.12em;
  }
  .milkdown-root :global(.fuwari-image-card-body) {
    display: grid;
    gap: 0.38rem;
    min-width: 0;
  }
  .milkdown-root :global(.fuwari-image-card-fields) {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 0.48rem;
    min-width: 0;
  }
  .milkdown-root :global(.fuwari-image-card-fields label) {
    display: grid;
    gap: 0.18rem;
    min-width: 0;
    color: rgb(255 255 255 / 0.34);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.56rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .milkdown-root :global(.fuwari-image-card-fields input) {
    min-width: 0;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 0.46rem;
    background: rgb(0 0 0 / 0.15);
    padding: 0.4rem 0.5rem;
    color: rgb(255 255 255 / 0.74);
    font: 500 0.76rem/1.25 inherit;
    letter-spacing: 0;
    text-transform: none;
    outline: none;
  }
  .milkdown-root :global(.fuwari-image-card-fields input:focus) {
    border-color: color-mix(in oklch, var(--primary) 48%, white 8%);
    background: rgb(255 255 255 / 0.045);
  }
  .milkdown-root :global(.fuwari-image-card-actions) {
    display: flex;
    align-items: center;
    gap: 0.48rem;
    min-width: 0;
  }
  .milkdown-root :global(.fuwari-image-card-file) {
    display: none;
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-image-card-pick) {
    min-height: 1.54rem;
    border-radius: 999px;
    padding: 0 0.58rem;
    color: rgb(255 255 255 / 0.58);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.62rem;
    font-weight: 850;
    white-space: nowrap;
    box-shadow: none;
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-image-card-pick:hover) {
    border-color: color-mix(in oklch, var(--primary) 38%, transparent);
    background: rgb(255 255 255 / 0.06);
    color: rgb(255 255 255 / 0.8);
  }
  .milkdown-root :global(.fuwari-image-card-status) {
    min-width: 0;
    color: color-mix(in oklch, var(--primary) 52%, rgb(255 255 255 / 0.38));
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.62rem;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .milkdown-root :global(.fuwari-image-card-delete) {
    width: 1.78rem;
    height: 1.78rem;
    border-radius: 999px;
    color: rgb(255 255 255 / 0.38);
    font-size: 1.05rem;
    box-shadow: none;
  }
  .milkdown-root :global(.fuwari-image-card-delete:hover) {
    border-color: color-mix(in oklch, #ff6b6b 42%, transparent);
    background: rgb(255 107 107 / 0.1);
    color: rgb(255 210 210 / 0.9);
  }
  .milkdown-root :global(.milkdown-code-block .tools) {
    position: static !important;
    display: contents !important;
    width: auto;
    height: 0;
    border: 0 !important;
    border-bottom: 0 !important;
    background: transparent !important;
    padding: 0 !important;
    margin: 0 !important;
    opacity: 1;
    pointer-events: none;
    box-shadow: none !important;
  }
  .milkdown-root :global(.milkdown-code-block .tools::before),
  .milkdown-root :global(.milkdown-code-block .tools::after) {
    display: none !important;
    content: none !important;
  }
  .milkdown-root :global(.milkdown-code-block:hover .fuwari-language-input),
  .milkdown-root :global(.milkdown-code-block:focus-within .fuwari-language-input) {
    opacity: 1;
    transform: translateY(0);
  }
  .milkdown-root :global(.milkdown-code-block button) {
    display: inline-grid;
    place-items: center;
    border: 1px solid rgb(255 255 255 / 0.08);
    background: color-mix(in oklch, var(--card-bg) 78%, black 22%);
    color: rgb(255 255 255 / 0.52);
    line-height: 1;
    pointer-events: auto;
    box-shadow: 0 8px 22px rgb(0 0 0 / 0.2);
  }
  .milkdown-root :global(.milkdown-code-block .language-button) {
    position: absolute !important;
    right: 0;
    bottom: -2.02rem;
    z-index: -1;
    width: 1px !important;
    height: 1px !important;
    overflow: hidden !important;
    border: 0 !important;
    padding: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
    transform: none !important;
    box-shadow: none !important;
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-language-input) {
    position: absolute;
    right: 0;
    bottom: -2.02rem;
    z-index: 4;
    width: 6.4rem;
    height: 1.78rem;
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 0.42rem;
    background: color-mix(in oklch, var(--card-bg) 92%, black 8%);
    padding: 0 0.7rem;
    color: rgb(255 255 255 / 0.72);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.72rem;
    font-weight: 500;
    line-height: 1;
    opacity: 0;
    transform: translateY(-0.16rem);
    transition: opacity 140ms ease, transform 140ms ease, border-color 140ms ease, background 140ms ease;
    outline: none;
    box-shadow: 0 10px 26px rgb(0 0 0 / 0.22);
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-language-input:hover),
  .milkdown-root :global(.milkdown-code-block .fuwari-language-input:focus) {
    color: rgb(255 255 255 / 0.86);
    border-color: color-mix(in oklch, var(--primary) 60%, white 8%);
    background: color-mix(in oklch, var(--card-bg) 96%, white 4%);
  }
  .milkdown-root :global(.milkdown-code-block .language-button .expand-icon) {
    display: none;
  }
  .milkdown-root :global(.milkdown-code-block .language-picker) {
    display: none !important;
  }
  .milkdown-root :global(.milkdown-code-block .language-picker .search-box) {
    display: none !important;
  }
  .milkdown-root :global(.milkdown-code-block .language-picker .language-list) {
    margin: 0 !important;
    padding: 0.25rem 0 !important;
  }
  .milkdown-root :global(.milkdown-code-block .language-picker:not(:empty)) {
    border: 1px solid rgb(255 255 255 / 0.1) !important;
    background: color-mix(in oklch, var(--card-bg) 94%, black 6%) !important;
    box-shadow: 0 18px 50px rgb(0 0 0 / 0.36) !important;
  }
  .milkdown-root :global(.milkdown-code-block .language-picker button),
  .milkdown-root :global(.milkdown-code-block .language-picker [role="option"]) {
    min-height: 2.05rem;
    border: 0 !important;
    border-radius: 0;
    background: transparent !important;
    box-shadow: none !important;
    color: rgb(255 255 255 / 0.74);
    font-size: 0.78rem;
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-language-suggestions) {
    position: absolute;
    right: 0;
    top: calc(100% + 2.55rem);
    z-index: 4;
    width: 10.5rem;
    max-height: 8.4rem;
    overflow: hidden auto;
    border: 1px solid rgb(255 255 255 / 0.1);
    border-radius: 0.62rem;
    background: color-mix(in oklch, var(--card-bg) 94%, black 6%);
    padding: 0.25rem 0;
    box-shadow: 0 18px 50px rgb(0 0 0 / 0.36);
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-language-suggestions button) {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 2.05rem;
    border: 0 !important;
    border-radius: 0;
    background: transparent !important;
    padding: 0 0.72rem;
    color: rgb(255 255 255 / 0.74);
    font-size: 0.78rem;
    text-align: left;
    box-shadow: none !important;
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-language-suggestions button:hover) {
    background: rgb(255 255 255 / 0.07) !important;
    color: rgb(255 255 255 / 0.9);
  }
  .milkdown-root :global(.milkdown-code-block .tools-button-group) {
    display: contents !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }
  .milkdown-root :global(.milkdown-code-block .copy-button) {
    display: none !important;
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-copy-button) {
    position: absolute;
    z-index: 3;
    top: 0.62rem;
    right: 0.64rem;
    display: inline-grid;
    place-items: center;
    width: 1.72rem;
    height: 1.72rem;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 0.42rem;
    background: rgb(13 17 23 / 0.78);
    color: rgb(255 255 255 / 0.62);
    line-height: 1;
    pointer-events: auto;
    box-shadow: 0 8px 22px rgb(0 0 0 / 0.22);
    backdrop-filter: blur(10px);
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-copy-button:hover) {
    color: rgb(255 255 255 / 0.82);
    background: rgb(255 255 255 / 0.08);
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-copy-button svg) {
    width: 0.94rem;
    height: 0.94rem;
    fill: currentColor;
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-copy-button.copied svg),
  .milkdown-root :global(.milkdown-code-block .fuwari-copy-button:focus svg) {
    display: none;
  }
  .milkdown-root :global(.milkdown-code-block .fuwari-copy-button[data-copied="true"]),
  .milkdown-root :global(.milkdown-code-block .fuwari-copy-button:focus::before) {
    content: "✓";
    color: rgb(255 255 255 / 0.82);
    font-size: 1rem;
    font-weight: 800;
    line-height: 1;
  }
  .milkdown-root :global(.milkdown-code-block .copy-button .milkdown-icon) {
    display: block;
    width: 1rem;
    height: 1rem;
  }
  .milkdown-root :global(.milkdown-code-block .copy-button .milkdown-icon svg) {
    width: 1rem;
    height: 1rem;
    stroke: currentColor;
    fill: none;
  }
  .milkdown-root :global(.milkdown-code-block .copy-button .milkdown-icon path) {
    fill: currentColor;
  }
  .milkdown-root :global(.milkdown-code-block.copied .copy-button .milkdown-icon) {
    display: none;
  }
  .milkdown-root :global(.milkdown-code-block.copied .copy-button::before) {
    content: "✓";
    color: rgb(255 255 255 / 0.82);
    font-size: 1rem;
    font-weight: 800;
    line-height: 1;
  }
  .milkdown-root :global(.cm-editor) {
    background: transparent;
  }
  .milkdown-root :global(.milkdown-code-block .cm-editor) {
    min-height: 0;
    padding: 0;
  }
  .milkdown-root :global(.cm-gutters) {
    background: transparent;
    border-right-color: rgb(255 255 255 / 0.055);
  }
  .milkdown-root :global(.milkdown-code-block .cm-gutters) {
    color: rgb(255 255 255 / 0.24);
    background: rgb(255 255 255 / 0.035);
  }
  .milkdown-root :global(.cm-content) {
    color: rgb(255 255 255 / 0.72);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.86rem;
  }
  .milkdown-root :global(.milkdown-code-block .cm-content) {
    min-height: 2.6rem;
    padding: 0.72rem 3.2rem 0.78rem 0.95rem;
    color: rgb(255 255 255 / 0.78);
    line-height: 1.72;
  }
  .milkdown-root :global(.ProseMirror blockquote) {
    border-left: 3px solid var(--primary);
    color: rgb(255 255 255 / 0.6);
  }
  @media (max-width: 760px) {
    .milkdown-root :global(.milkdown-code-block .fuwari-image-card) {
      grid-template-columns: 3.6rem minmax(0, 1fr) 1.8rem;
      gap: 0.48rem;
    }
    .milkdown-root :global(.fuwari-image-card-preview) {
      width: 3.6rem;
    }
    .milkdown-root :global(.fuwari-image-card-fields) {
      grid-template-columns: 1fr;
    }
    .milkdown-root :global(.fuwari-image-card-actions) {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.28rem;
    }
  }
</style>
