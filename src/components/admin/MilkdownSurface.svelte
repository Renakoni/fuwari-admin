<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import { Crepe } from "@milkdown/crepe";
  import { editorViewCtx } from "@milkdown/kit/core";
  import { Fragment } from "@milkdown/kit/prose/model";
  import "@milkdown/crepe/theme/frame-dark.css";

  type FuwariBlockKind = "note" | "warning" | "figure" | "gallery" | "video" | "evidence";

  export let value = "";
  export let placeholder = "Start writing with Fuwari Markdown...";

  const dispatch = createEventDispatcher<{ change: string; slash: { x: number; y: number } }>();

  let root: HTMLDivElement;
  let crepe: Crepe | null = null;
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
  });

  $: if (crepe && value !== internalValue) {
    internalValue = value;
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
      const coords = view.coordsAtPos(from);
      dispatch("slash", { x: coords.left, y: coords.bottom });
    });
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

  export function insertFuwariBlock(kind: FuwariBlockKind) {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { schema } = view.state;
      const p = schema.nodes.paragraph;
      const blockquote = schema.nodes.blockquote;
      const image = schema.nodes.image;
      const text = (value: string) => schema.text(value);
      const paragraph = (...content: any[]) => p.create(null, content);
      const nodes = {
        note: () => [blockquote.create(null, [paragraph(text("Note")), paragraph(text("内容"))])],
        warning: () => [blockquote.create(null, [paragraph(text("Warning")), paragraph(text("内容"))])],
        figure: () => image ? [paragraph(image.create({ src: "./image.png", alt: "图片说明", title: null })), paragraph(schema.marks.emphasis ? text("图片说明").mark([schema.marks.emphasis.create()]) : text("图片说明"))] : [paragraph(text("图片说明"))],
        gallery: () => image ? [
          paragraph(image.create({ src: "./a.png", alt: "图 1", title: null })),
          paragraph(image.create({ src: "./b.png", alt: "图 2", title: null })),
          paragraph(image.create({ src: "./c.png", alt: "图 3", title: null })),
          paragraph(schema.marks.emphasis ? text("图片组说明").mark([schema.marks.emphasis.create()]) : text("图片组说明")),
        ] : [paragraph(text("图片组说明"))],
        video: () => [paragraph(schema.marks.link ? text("视频说明").mark([schema.marks.link.create({ href: "https://" })]) : text("视频说明"))],
        evidence: () => [blockquote.create(null, [paragraph(text("Evidence")), paragraph(text("内容"))])],
      }[kind]();
      const { $from, to } = view.state.selection;
      const insertAt = $from.depth > 0 ? $from.after($from.depth) : to;
      view.dispatch(view.state.tr.insert(insertAt, Fragment.fromArray(nodes)).scrollIntoView());
      view.focus();
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

  export function setHeading(level = 2) {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const heading = view.state.schema.nodes.heading;
      if (!heading) return;
      const { $from, from, to } = view.state.selection;
      const blockFrom = $from.depth > 0 ? $from.before($from.depth) : from;
      const blockTo = $from.depth > 0 ? $from.after($from.depth) : to;
      view.dispatch(view.state.tr.setBlockType(blockFrom, blockTo, heading, { level }));
      view.focus();
    });
  }

  export function setCodeBlock() {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const codeBlock = view.state.schema.nodes.code_block;
      if (!codeBlock) return;
      const { $from, from, to } = view.state.selection;
      const blockFrom = $from.depth > 0 ? $from.before($from.depth) : from;
      const blockTo = $from.depth > 0 ? $from.after($from.depth) : to;
      view.dispatch(view.state.tr.setBlockType(blockFrom, blockTo, codeBlock));
      view.focus();
    });
  }

  export function setParagraph() {
    if (!crepe) return;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const paragraph = view.state.schema.nodes.paragraph;
      if (!paragraph) return;
      const { $from, from, to } = view.state.selection;
      const blockFrom = $from.depth > 0 ? $from.before($from.depth) : from;
      const blockTo = $from.depth > 0 ? $from.after($from.depth) : to;
      view.dispatch(view.state.tr.setBlockType(blockFrom, blockTo, paragraph));
      view.focus();
    });
  }

  export function insertLink() {
    if (applyMark(["link"], { href: "https://" })) return;
    wrapSelection("[", "](https://)");
  }

  onDestroy(() => {
    root?.removeEventListener("keydown", handleKeydown, { capture: true });
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
  .milkdown-root :global(.ProseMirror h3) {
    color: rgb(255 255 255 / 0.9);
    font-weight: 900;
    letter-spacing: -0.052em;
    line-height: 1.16;
  }
  .milkdown-root :global(.ProseMirror h2) {
    margin: 1.15rem 0 0.58rem;
    font-size: clamp(1.35rem, 2.4vw, 1.85rem);
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
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 0.86rem;
    background: rgb(0 0 0 / 0.2);
    overflow: hidden;
  }
  .milkdown-root :global(.milkdown-code-block .tools) {
    border-bottom: 1px solid rgb(255 255 255 / 0.055);
    background: rgb(255 255 255 / 0.026);
    opacity: 0.46;
    transition: opacity 140ms ease;
  }
  .milkdown-root :global(.milkdown-code-block:hover .tools) {
    opacity: 0.82;
  }
  .milkdown-root :global(.milkdown-code-block button) {
    color: rgb(255 255 255 / 0.48);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.66rem;
  }
  .milkdown-root :global(.cm-editor) {
    background: transparent;
  }
  .milkdown-root :global(.cm-gutters) {
    background: transparent;
    border-right-color: rgb(255 255 255 / 0.055);
  }
  .milkdown-root :global(.cm-content) {
    color: rgb(255 255 255 / 0.72);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.86rem;
  }
  .milkdown-root :global(.ProseMirror blockquote) {
    border-left: 3px solid var(--primary);
    color: rgb(255 255 255 / 0.6);
  }
</style>
