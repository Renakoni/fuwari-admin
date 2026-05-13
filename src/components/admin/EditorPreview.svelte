<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import katex from "katex";
  import { highlightCode, highlightedCode, renderInlineMarkdown } from "./adminPreview";
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

  function metricRatio(block: Extract<PreviewBlock, { type: "metric" }>) {
    return Math.max(0, Math.min(1, block.value / block.max));
  }

  function metricPercent(block: Extract<PreviewBlock, { type: "metric" }>) {
    return `${Math.round(metricRatio(block) * 100)}%`;
  }

  function ratingStars(block: Extract<PreviewBlock, { type: "metric" }>) {
    const ratio = metricRatio(block);
    return Array.from({ length: Math.ceil(block.max) }, (_, index) => ({ filled: index < Math.round(ratio * Math.ceil(block.max)) }));
  }

  function githubRepoName(repo: string) {
    return repo.split("/")[1] || repo;
  }

  function githubOwner(repo: string) {
    return repo.split("/")[0] || "GitHub";
  }

  function tabInputName(index: number) {
    return `preview-tabs-${index}`;
  }

  function tabInputId(index: number, tabIndex: number) {
    return `preview-tabs-${index}-${tabIndex}`;
  }

  function renderedTabBody(tab: Extract<PreviewBlock, { type: "tabs" }>["tabs"][number]) {
    return tab.lang === "text" ? renderInlineMarkdown(tab.body) : highlightCode(tab.body, tab.lang);
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
      <h2 id={`preview-heading-${index}`}>{block.text}</h2>
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
    {:else if block.type === "metric"}
      <section class={`preview-metric preview-metric--${block.kind}`} style={`--metric-progress: ${metricPercent(block)}`}>
        <div class="preview-metric-topline">
          <span>{block.kind === "rating" ? "Rating" : "Stat"}</span>
          <strong>{block.value}<small>/ {block.max}</small></strong>
        </div>
        <div class="preview-metric-main">
          <h3>{block.label}</h3>
          {#if block.kind === "rating"}
            <div class="preview-rating-stars" aria-label={`${block.value} out of ${block.max}`}>
              {#each ratingStars(block) as star}
                <span class:star-empty={!star.filled}>★</span>
              {/each}
            </div>
          {/if}
        </div>
        <div class="preview-metric-track" aria-hidden="true"><span></span></div>
        {#if block.note}<p>{block.note}</p>{/if}
      </section>
    {:else if block.type === "github"}
      <a class="preview-github-card" href={block.href} target="_blank" rel="noreferrer">
        <div class="preview-github-mark" aria-hidden="true">
          <svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.6 7.6 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
        </div>
        <div class="preview-github-body">
          <span>GitHub repository</span>
          <strong><em>{githubOwner(block.repo)}</em><small>/</small>{githubRepoName(block.repo)}</strong>
          <p>{block.href}</p>
        </div>
        <div class="preview-github-corner" aria-hidden="true">↗</div>
      </a>
    {:else if block.type === "tabs"}
      <section class="preview-tabs">
        {#each block.tabs as tab, tabIndex}
          <input id={tabInputId(index, tabIndex)} name={tabInputName(index)} type="radio" checked={tabIndex === 0} />
        {/each}
        <div class="preview-tabs-rail" role="tablist" aria-label="Preview tabs">
          {#each block.tabs as tab, tabIndex}
            <label for={tabInputId(index, tabIndex)} role="tab">{tab.label}</label>
          {/each}
        </div>
        {#each block.tabs as tab, tabIndex}
          <div class="preview-tab-panel" role="tabpanel" data-tab-index={tabIndex}>
            {#if tab.lang === "text"}
              <p>{@html renderedTabBody(tab)}</p>
            {:else}
              <pre><code>{@html renderedTabBody(tab)}</code></pre>
            {/if}
          </div>
        {/each}
      </section>
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
    letter-spacing: -0.018em;
    line-height: 0.92;
    text-wrap: balance;
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
  .composer-preview p :global(a),
  .preview-list :global(a),
  .preview-quote :global(a) {
    color: color-mix(in oklch, var(--primary) 78%, white 8%);
    font-weight: 800;
    text-decoration: underline;
    text-decoration-color: color-mix(in oklch, var(--primary) 42%, transparent);
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.2em;
  }
  .composer-preview p :global(a:hover),
  .preview-list :global(a:hover),
  .preview-quote :global(a:hover) {
    color: rgb(255 255 255 / 0.92);
    text-decoration-color: color-mix(in oklch, var(--primary) 70%, white 10%);
  }
  .composer-preview p :global(del),
  .preview-list :global(del) {
    color: rgb(255 255 255 / 0.48);
    text-decoration-color: color-mix(in oklch, var(--primary) 55%, rgb(255 255 255 / 0.35));
  }
  .composer-preview :global(.preview-spoiler) {
    display: inline;
    border-radius: 0.28em;
    background:
      linear-gradient(90deg, rgb(0 0 0 / 0.96), rgb(10 12 18 / 0.94)),
      color-mix(in oklch, var(--primary) 18%, black 82%);
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    color: transparent;
    cursor: help;
    padding: 0.02em 0.22em;
    text-shadow: none;
    transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease;
  }
  .composer-preview :global(.preview-spoiler:hover),
  .composer-preview :global(.preview-spoiler:focus) {
    background: color-mix(in oklch, var(--primary) 16%, rgb(255 255 255 / 0.075));
    color: rgb(255 255 255 / 0.84);
    outline: none;
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--primary) 36%, transparent);
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
    letter-spacing: -0.01em;
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
  .preview-metric {
    --metric-color: oklch(0.78 0.14 88);
    position: relative;
    display: grid;
    gap: 0.62rem;
    max-width: 34rem;
    margin: 1.18rem 0;
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 0.92rem;
    background:
      radial-gradient(circle at 8% 0%, color-mix(in oklch, var(--metric-color) 14%, transparent), transparent 42%),
      linear-gradient(135deg, rgb(255 255 255 / 0.045), rgb(255 255 255 / 0.018));
    padding: 0.92rem 1.1rem 1rem 1.15rem;
    overflow: hidden;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04), 0 16px 40px rgb(0 0 0 / 0.12);
  }
  .preview-metric::before {
    content: "";
    position: absolute;
    top: 0.88rem;
    bottom: 0.88rem;
    left: 0;
    width: 2px;
    border-radius: 999px;
    background: linear-gradient(180deg, transparent, var(--metric-color), transparent);
  }
  .preview-metric::after {
    content: "";
    position: absolute;
    inset: 0 0 0 auto;
    width: 30%;
    background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.018));
    pointer-events: none;
  }
  .preview-metric--stat {
    --metric-color: oklch(0.74 0.12 230);
  }
  .preview-metric-topline,
  .preview-metric-main {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1.25rem;
  }
  .preview-metric-topline {
    color: var(--metric-color);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
  }
  .preview-metric-topline span {
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .preview-metric-topline strong {
    color: rgb(255 255 255 / 0.88);
    font-size: 1.12rem;
    font-weight: 920;
    letter-spacing: -0.035em;
  }
  .preview-metric-topline small {
    margin-left: 0.12rem;
    color: rgb(255 255 255 / 0.32);
    font-size: 0.64rem;
    letter-spacing: 0;
  }
  .preview-metric h3 {
    margin: 0;
    color: rgb(255 255 255 / 0.82);
    font-size: 1rem;
    font-weight: 820;
    letter-spacing: -0.025em;
  }
  .preview-rating-stars {
    display: flex;
    flex: 0 0 auto;
    gap: 0.08rem;
    color: var(--metric-color);
    font-size: 0.9rem;
    letter-spacing: 0.02em;
    opacity: 0.9;
  }
  .preview-rating-stars .star-empty {
    color: rgb(255 255 255 / 0.16);
  }
  .preview-metric-track {
    position: relative;
    z-index: 1;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgb(255 255 255 / 0.11), rgb(255 255 255 / 0.045));
    overflow: hidden;
  }
  .preview-metric-track span {
    display: block;
    width: var(--metric-progress);
    height: 100%;
    background: linear-gradient(90deg, color-mix(in oklch, var(--metric-color) 55%, white 8%), var(--metric-color));
    box-shadow: 0 0 14px color-mix(in oklch, var(--metric-color) 45%, transparent);
  }
  .preview-metric p {
    position: relative;
    z-index: 1;
    margin: 0;
    color: rgb(255 255 255 / 0.5);
    font-size: 0.82rem;
    font-weight: 620;
    line-height: 1.6;
  }
  .preview-github-card {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.9rem;
    align-items: center;
    max-width: 42rem;
    margin: 1.18rem 0;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 1.05rem;
    background:
      radial-gradient(circle at 8% 0%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 40%),
      linear-gradient(135deg, rgb(255 255 255 / 0.048), rgb(255 255 255 / 0.018));
    padding: 0.92rem 1rem;
    color: inherit;
    text-decoration: none;
    overflow: hidden;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04), 0 18px 46px rgb(0 0 0 / 0.14);
  }
  .preview-github-card::after {
    content: "";
    position: absolute;
    inset: auto 0 0 0;
    height: 2px;
    background: linear-gradient(90deg, color-mix(in oklch, var(--primary) 62%, white 6%), transparent 72%);
    opacity: 0.72;
  }
  .preview-github-mark {
    display: grid;
    place-items: center;
    width: 2.55rem;
    height: 2.55rem;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 0.78rem;
    background: rgb(255 255 255 / 0.06);
    color: rgb(255 255 255 / 0.82);
  }
  .preview-github-mark svg {
    width: 1.22rem;
    height: 1.22rem;
    fill: currentColor;
  }
  .preview-github-body {
    min-width: 0;
  }
  .preview-github-body span,
  .preview-github-body p {
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
  }
  .preview-github-body span {
    display: block;
    margin-bottom: 0.18rem;
    color: color-mix(in oklch, var(--primary) 50%, rgb(255 255 255 / 0.42));
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .preview-github-body strong {
    display: block;
    overflow: hidden;
    color: rgb(255 255 255 / 0.86);
    font-size: 1.08rem;
    font-weight: 880;
    letter-spacing: -0.035em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .preview-github-body em {
    color: rgb(255 255 255 / 0.48);
    font-style: normal;
    font-weight: 650;
  }
  .preview-github-body small {
    margin: 0 0.32rem;
    color: rgb(255 255 255 / 0.28);
  }
  .preview-github-body p {
    margin: 0.28rem 0 0;
    overflow: hidden;
    color: rgb(255 255 255 / 0.42);
    font-size: 0.68rem;
    font-weight: 650;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .preview-github-corner {
    color: rgb(255 255 255 / 0.36);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.8rem;
    font-weight: 900;
  }
  .preview-github-card:hover {
    border-color: color-mix(in oklch, var(--primary) 24%, rgb(255 255 255 / 0.1));
    background:
      radial-gradient(circle at 8% 0%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 42%),
      linear-gradient(135deg, rgb(255 255 255 / 0.058), rgb(255 255 255 / 0.024));
  }
  .preview-tabs {
    max-width: 44rem;
    margin: 1.18rem 0;
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 1.05rem;
    background: linear-gradient(135deg, rgb(255 255 255 / 0.04), rgb(255 255 255 / 0.016));
    padding: 0.52rem;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.035), 0 16px 42px rgb(0 0 0 / 0.12);
  }
  .preview-tabs-rail {
    display: flex;
    flex-wrap: wrap;
    gap: 0.28rem;
    border-bottom: 1px solid rgb(255 255 255 / 0.065);
    padding: 0 0 0.48rem;
  }
  .preview-tabs > input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .preview-tabs-rail label {
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    padding: 0.32rem 0.7rem;
    color: rgb(255 255 255 / 0.46);
    cursor: pointer;
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.66rem;
    font-weight: 850;
    letter-spacing: 0.03em;
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
  }
  .preview-tabs-rail label:hover {
    border-color: color-mix(in oklch, var(--primary) 18%, rgb(255 255 255 / 0.08));
    color: rgb(255 255 255 / 0.72);
  }
  .preview-tab-panel {
    display: none;
    padding: 0.78rem 0.2rem 0.18rem;
  }
  .preview-tabs > input:nth-of-type(1):checked ~ .preview-tabs-rail label:nth-of-type(1),
  .preview-tabs > input:nth-of-type(2):checked ~ .preview-tabs-rail label:nth-of-type(2),
  .preview-tabs > input:nth-of-type(3):checked ~ .preview-tabs-rail label:nth-of-type(3),
  .preview-tabs > input:nth-of-type(4):checked ~ .preview-tabs-rail label:nth-of-type(4),
  .preview-tabs > input:nth-of-type(5):checked ~ .preview-tabs-rail label:nth-of-type(5) {
    border-color: color-mix(in oklch, var(--primary) 28%, rgb(255 255 255 / 0.08));
    background: color-mix(in oklch, var(--primary) 12%, rgb(255 255 255 / 0.035));
    color: rgb(255 255 255 / 0.82);
  }
  .preview-tabs > input:nth-of-type(1):checked ~ .preview-tab-panel[data-tab-index="0"],
  .preview-tabs > input:nth-of-type(2):checked ~ .preview-tab-panel[data-tab-index="1"],
  .preview-tabs > input:nth-of-type(3):checked ~ .preview-tab-panel[data-tab-index="2"],
  .preview-tabs > input:nth-of-type(4):checked ~ .preview-tab-panel[data-tab-index="3"],
  .preview-tabs > input:nth-of-type(5):checked ~ .preview-tab-panel[data-tab-index="4"] {
    display: block;
  }
  .preview-tab-panel p {
    margin: 0;
    max-width: 40rem;
    color: rgb(255 255 255 / 0.64);
    font-size: 0.94rem;
    line-height: 1.75;
    white-space: pre-wrap;
  }
  .preview-tab-panel pre {
    margin: 0;
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: 0.72rem;
    background: rgb(0 0 0 / 0.18);
    padding: 0.7rem 0.78rem;
    overflow-x: auto;
  }
  .preview-tab-panel code {
    color: rgb(255 255 255 / 0.74);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.84rem;
    line-height: 1.68;
    white-space: pre;
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
    .preview-github-card {
      grid-template-columns: auto minmax(0, 1fr);
      padding: 0.84rem;
    }
    .preview-github-corner {
      display: none;
    }
    .preview-tabs {
      border-radius: 0.85rem;
      padding: 0.42rem;
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
