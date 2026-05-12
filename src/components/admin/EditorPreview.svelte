<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import katex from "katex";
  import { highlightedCode, renderInlineMarkdown } from "./adminPreview";
  import type { PreviewBlock } from "./adminPreview";
  import { isImagePlaceholder } from "./imageBlock";

  export let title = "";
  export let description = "";
  export let previewBlocks: PreviewBlock[] = [];
  export let copiedPreviewCode = "";
  export let pendingImages = new Map<string, { objectUrl: string }>();

  const dispatch = createEventDispatcher<{
    copyCode: { block: Extract<PreviewBlock, { type: "code" }>; index: number };
  }>();

  function previewCodeKey(block: Extract<PreviewBlock, { type: "code" }>, index: number) {
    return `${index}:${block.lang}:${block.code}`;
  }

  function renderedMath(block: Extract<PreviewBlock, { type: "math" }>) {
    try {
      return katex.renderToString(block.formula, { displayMode: true, throwOnError: false, strict: false });
    } catch {
      return `<code>${block.formula}</code>`;
    }
  }

  let missingPreviewImages = new Set<string>();

  function figureKey(block: Extract<PreviewBlock, { type: "figure" }>, index: number) {
    return `${index}:${block.src || ""}:${block.label}`;
  }

  $: missingPreviewImages = new Set([...missingPreviewImages].filter((key) => previewBlocks.some((block, index) => block.type === "figure" && figureKey(block, index) === key)));

  function pendingImage(block: Extract<PreviewBlock, { type: "figure" }>) {
    return pendingImages.get(block.src || "");
  }

  function previewImageSrc(block: Extract<PreviewBlock, { type: "figure" }>) {
    return pendingImage(block)?.objectUrl || block.src || "";
  }

  function isFigurePlaceholder(block: Extract<PreviewBlock, { type: "figure" }>, index: number) {
    return !pendingImage(block) && (isImagePlaceholder(block.src || "") || missingPreviewImages.has(figureKey(block, index)));
  }

  function markImageMissing(block: Extract<PreviewBlock, { type: "figure" }>, index: number) {
    missingPreviewImages.add(figureKey(block, index));
    missingPreviewImages = missingPreviewImages;
  }

  function trackPreviewImage(image: HTMLImageElement, params: { block: Extract<PreviewBlock, { type: "figure" }>; index: number }) {
    let current = params;
    const check = () => {
      if (image.complete && image.naturalWidth === 0) markImageMissing(current.block, current.index);
    };
    const timeout = window.setTimeout(check);
    image.addEventListener("load", check);
    image.addEventListener("error", check);
    return {
      update(next: typeof params) {
        current = next;
        window.setTimeout(check);
      },
      destroy() {
        window.clearTimeout(timeout);
        image.removeEventListener("load", check);
        image.removeEventListener("error", check);
      },
    };
  }
</script>

<article class="composer-preview">
  <div class="preview-label">Preview / Fuwari Markdown 2.0</div>
  <h1>{title}</h1>
  {#if description}<p class="preview-dek">{description}</p>{/if}
  {#each previewBlocks as block, index}
    {#if block.type === "heading"}
      <h2>{block.text}</h2>
    {:else if block.type === "paragraph"}
      <p>{@html renderInlineMarkdown(block.text)}</p>
    {:else if block.type === "spacer"}
      <div class="preview-spacer" aria-hidden="true"></div>
    {:else if block.type === "quote"}
      <blockquote class="preview-quote"><p>{@html renderInlineMarkdown(block.text)}</p></blockquote>
    {:else if block.type === "list"}
      {#if block.ordered}
        <ol class="preview-list">
          {#each block.items as item}<li>{@html renderInlineMarkdown(item)}</li>{/each}
        </ol>
      {:else}
        <ul class="preview-list">
          {#each block.items as item}<li>{@html renderInlineMarkdown(item)}</li>{/each}
        </ul>
      {/if}
    {:else if block.type === "math"}
      <figure class="preview-math-block">
        <figcaption>LaTeX</figcaption>
        <div class="preview-math-formula">{@html renderedMath(block)}</div>
      </figure>
    {:else if block.type === "code"}
      <figure class="preview-code-block">
        <figcaption>{block.lang}</figcaption>
        <button class="preview-code-copy" type="button" aria-label="Copy code" on:click={() => dispatch("copyCode", { block, index })}>
          {#if copiedPreviewCode === previewCodeKey(block, index)}
            ✓
          {:else}
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
          {/if}
        </button>
        <pre><code>{@html highlightedCode(block)}</code></pre>
      </figure>
    {:else if block.type === "callout"}
      <aside class={`preview-callout preview-callout--${block.kind}`}>
        <div class="preview-callout-title">
          <span class="preview-callout-icon" aria-hidden="true">
            {#if block.kind === "warning"}
              <svg viewBox="0 0 16 16"><path d="M8.64 1.55a.74.74 0 0 0-1.28 0L1.15 12.78A.8.8 0 0 0 1.82 14h12.36a.8.8 0 0 0 .67-1.22L8.64 1.55ZM8 5.1c.42 0 .75.33.75.75v3.1a.75.75 0 0 1-1.5 0v-3.1c0-.42.33-.75.75-.75Zm0 6.7a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z"/></svg>
            {:else if block.kind === "proof"}
              <svg viewBox="0 0 16 16"><path d="M2.5 2.25A1.25 1.25 0 0 1 3.75 1h8.5a1.25 1.25 0 0 1 1.25 1.25v7.5A1.25 1.25 0 0 1 12.25 11H8.32l-3.13 3.13A.7.7 0 0 1 4 13.64V11h-.25A1.25 1.25 0 0 1 2.5 9.75v-7.5Zm5.5 1.5c-.42 0-.75.33-.75.75v2.25c0 .42.33.75.75.75s.75-.33.75-.75V4.5c0-.42-.33-.75-.75-.75Zm0 5.55a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7Z"/></svg>
            {:else}
              <svg viewBox="0 0 16 16"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 7.75A.75.75 0 0 1 8 7h.25a.75.75 0 0 1 .75.75V11h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25V8.5H7.25a.75.75 0 0 1-.75-.75ZM8 5.9a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9Z"/></svg>
            {/if}
          </span>
          <strong>{block.label}</strong>
        </div>
        {#if block.body}<p>{block.body}</p>{/if}
      </aside>
    {:else if block.type === "figure"}
      <figure class="preview-figure-block">
        <div class="preview-image-frame" class:preview-image-frame--placeholder={isFigurePlaceholder(block, index)}>
          {#if isFigurePlaceholder(block, index)}
            <span>{block.src || "Image"}</span>
          {:else}
            <img src={previewImageSrc(block)} alt={block.label || block.body} loading="lazy" use:trackPreviewImage={{ block, index }} />
          {/if}
        </div>
        {#if block.label}<p>{block.label}</p>{/if}
        {#if pendingImage(block)}<span class="preview-image-status">本地预览，尚未上传</span>{/if}
      </figure>
    {:else if block.type === "video"}
      <section class="preview-video">
        {#if block.embedSrc}
          <iframe src={block.embedSrc} title={block.title || block.label} loading="lazy" allowfullscreen></iframe>
          {#if block.note}<p>{block.note}</p>{/if}
        {/if}
      </section>
    {/if}
  {/each}
</article>

<style>
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
  .preview-spacer {
    height: 1.35rem;
  }
  .composer-preview p :global(strong) {
    color: rgb(255 255 255 / 0.9);
    font-weight: 900;
  }
  .composer-preview p :global(u) {
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.18em;
  }
  .composer-preview p :global(del),
  .preview-list :global(del) {
    color: rgb(255 255 255 / 0.48);
    text-decoration-color: color-mix(in oklch, var(--primary) 55%, rgb(255 255 255 / 0.35));
  }
  .preview-quote {
    position: relative;
    margin: 1rem 0;
    max-width: 44rem;
    border-left: 3px solid color-mix(in oklch, var(--primary) 55%, transparent);
    padding: 0.15rem 0 0.15rem 1rem;
    color: rgb(255 255 255 / 0.66);
  }
  .preview-quote p {
    margin: 0;
  }
  .preview-list {
    max-width: 44rem;
    margin: 0.72rem 0;
    padding-left: 1.35rem;
    color: rgb(255 255 255 / 0.62);
    line-height: 1.75;
  }
  ul.preview-list {
    list-style: disc outside;
  }
  ol.preview-list {
    list-style: decimal outside;
  }
  .preview-list li::marker {
    color: color-mix(in oklch, var(--primary) 70%, rgb(255 255 255 / 0.4));
    font-weight: 800;
  }
  .composer-preview h2 {
    margin-top: 1.7rem;
    color: rgb(255 255 255 / 0.84);
    font-size: 1.45rem;
    letter-spacing: -0.04em;
  }
  .preview-math-block,
  .preview-code-block {
    position: relative;
    margin: 1.05rem 0;
    max-width: 52rem;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 1rem;
    background: rgb(0 0 0 / 0.18);
    overflow: hidden;
  }
  .preview-code-copy {
    position: absolute;
    top: 0.72rem;
    right: 0.72rem;
    display: inline-grid;
    place-items: center;
    width: 1.82rem;
    height: 1.82rem;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 0.45rem;
    background: rgb(13 17 23 / 0.78);
    color: rgb(255 255 255 / 0.66);
    line-height: 1;
    box-shadow: 0 8px 22px rgb(0 0 0 / 0.22);
    backdrop-filter: blur(10px);
  }
  .preview-code-copy:hover {
    color: rgb(255 255 255 / 0.86);
    background: rgb(255 255 255 / 0.08);
  }
  .preview-code-copy svg {
    width: 0.94rem;
    height: 0.94rem;
    fill: currentColor;
  }
  .preview-math-block figcaption,
  .preview-code-block figcaption {
    display: inline-flex;
    margin: 0.72rem 0 0 0.82rem;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.06);
    padding: 0.18rem 0.48rem;
    color: rgb(255 255 255 / 0.46);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.62rem;
    font-weight: 850;
  }
  .preview-code-block pre {
    margin: 0;
    padding: 0.74rem 0.9rem 0.95rem;
    overflow: auto;
  }
  .preview-code-block code {
    color: rgb(255 255 255 / 0.76);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.86rem;
    line-height: 1.72;
    white-space: pre;
  }
  .preview-math-formula {
    margin: 0;
    padding: 1rem 1.1rem 1.2rem;
    overflow-x: auto;
    color: rgb(255 255 255 / 0.84);
  }
  .preview-math-formula :global(.katex-display) {
    margin: 0;
  }
  .preview-math-formula :global(.katex) {
    font-size: 1.12rem;
  }
  :global(.code-token--keyword) {
    color: #ff7b72;
  }
  :global(.code-token--type) {
    color: #79c0ff;
  }
  :global(.code-token--function) {
    color: #d2a8ff;
  }
  :global(.code-token--string) {
    color: #a5d6ff;
  }
  :global(.code-token--number) {
    color: #79c0ff;
  }
  :global(.code-token--comment) {
    color: #8b949e;
    font-style: italic;
  }
  :global(.code-token--meta) {
    color: #ffa657;
  }
  :global(.code-token--variable) {
    color: #ffa657;
  }
  .preview-callout {
    --callout-color: oklch(0.75 0.14 250);
    position: relative;
    margin: 1.08rem 0;
    max-width: 52rem;
    border: 1px solid rgb(255 255 255 / 0.075);
    border-left: 4px solid var(--callout-color);
    border-radius: 1.15rem;
    background:
      radial-gradient(circle at 0% 0%, color-mix(in oklch, var(--callout-color) 13%, transparent), transparent 40%),
      rgb(255 255 255 / 0.045);
    padding: 1rem 1.1rem 1.12rem 1.2rem;
    overflow: hidden;
    box-shadow: 0 18px 45px rgb(0 0 0 / 0.16);
  }
  .preview-callout--warning {
    --callout-color: oklch(0.78 0.15 75);
  }
  .preview-callout--proof {
    --callout-color: oklch(0.75 0.15 310);
  }
  .preview-callout-title {
    display: flex;
    align-items: center;
    gap: 0.58rem;
    color: var(--callout-color);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .preview-callout-icon {
    display: inline-grid;
    flex: 0 0 auto;
    place-items: center;
    width: 1.08rem;
    height: 1.08rem;
    line-height: 1;
  }
  .preview-callout-icon svg {
    display: block;
    width: 1.08rem;
    height: 1.08rem;
    fill: currentColor;
  }
  .preview-callout strong {
    color: inherit;
    font-size: inherit;
    font-weight: inherit;
  }
  .preview-callout p {
    margin: 0.72rem 0 0;
    max-width: 46rem;
    color: rgb(255 255 255 / 0.72);
    font-size: 0.98rem;
    font-weight: 650;
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .preview-figure-block {
    position: relative;
    margin: 1.6rem 0;
    max-width: 52rem;
  }
  .preview-image-frame {
    display: flex;
    justify-content: center;
    width: 100%;
  }
  .preview-image-frame img {
    display: block;
    max-width: 100%;
    width: auto;
    height: auto;
    max-height: 34rem;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 1.1rem;
    background: rgb(0 0 0 / 0.2);
    box-shadow: 0 18px 50px rgb(0 0 0 / 0.18);
  }
  .preview-image-frame--placeholder {
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 9;
    min-height: 18rem;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 1.1rem;
    background: rgb(0 0 0 / 0.2);
    overflow: hidden;
    box-shadow: 0 18px 50px rgb(0 0 0 / 0.18);
  }
  .preview-image-frame--placeholder span {
    max-width: min(26rem, calc(100% - 2rem));
    color: rgb(255 255 255 / 0.34);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.72rem;
    line-height: 1.55;
    text-align: center;
    word-break: break-all;
  }
  .preview-figure-block > p {
    margin: 0.64rem auto 0;
    max-width: 42rem;
    color: rgb(255 255 255 / 0.52);
    font-size: 0.84rem;
    line-height: 1.65;
    text-align: center;
  }
  .preview-image-status {
    display: block;
    margin: 0.22rem auto 0;
    max-width: 42rem;
    color: color-mix(in oklch, var(--primary) 48%, rgb(255 255 255 / 0.36));
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.66rem;
    line-height: 1.5;
    text-align: center;
  }
  .preview-video {
    margin: 1.6rem 0;
    max-width: 52rem;
  }
  .preview-video iframe {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    height: auto;
    min-height: 18rem;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 1.1rem;
    background: rgb(0 0 0 / 0.2);
    box-shadow: 0 18px 50px rgb(0 0 0 / 0.18);
  }
  .preview-video > p {
    margin: 0.64rem auto 0;
    max-width: 42rem;
    color: rgb(255 255 255 / 0.52);
    font-size: 0.84rem;
    line-height: 1.65;
    text-align: center;
  }
  @media (max-width: 640px) {
    .preview-video,
    .preview-figure-block {
      margin: 1.25rem 0;
    }
    .preview-video iframe,
    .preview-image-frame img,
    .preview-image-frame--placeholder {
      min-height: 0;
      border-radius: 0.8rem;
    }
    .preview-video > p,
    .preview-figure-block > p,
    .preview-image-status {
      text-align: left;
    }
  }
</style>
