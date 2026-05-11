<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { highlightedCode } from "./adminPreview";
  import type { PreviewBlock } from "./adminPreview";

  export let title = "";
  export let description = "";
  export let previewBlocks: PreviewBlock[] = [];
  export let copiedPreviewCode = "";

  const dispatch = createEventDispatcher<{
    copyCode: { block: Extract<PreviewBlock, { type: "code" }>; index: number };
  }>();

  function previewCodeKey(block: Extract<PreviewBlock, { type: "code" }>, index: number) {
    return `${index}:${block.lang}:${block.code}`;
  }
</script>

<article class="composer-preview">
  <div class="preview-label">Preview / Fuwari Markdown 2.0</div>
  <h1>{title}</h1>
  {#if description}<p class="preview-dek">{description}</p>{/if}
  {#each previewBlocks as block, index}
    {#if block.type === "heading"}
      <h2>{block.text}</h2>
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
      <aside class="preview-directive preview-directive--callout">
        <span>Callout</span>
        <strong>{block.label}</strong>
        {#if block.body}<p>{block.body}</p>{/if}
      </aside>
    {:else if block.type === "figure"}
      <figure class="preview-directive preview-directive--figure">
        <div class="preview-media-placeholder">{block.src ? block.src : "FIG"}</div>
        {#if block.body}<p>{block.body}</p>{/if}
        <figcaption>{block.label}</figcaption>
      </figure>
    {:else if block.type === "gallery"}
      <section class="preview-directive preview-directive--gallery">
        <span>Gallery</span>
        <strong>{block.label}</strong>
        <div class="preview-gallery-grid">
          {#each block.images?.slice(0, 3) || ["", "", ""] as image}<i>{image}</i>{/each}
        </div>
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
  .composer-preview h2 {
    margin-top: 1.7rem;
    color: rgb(255 255 255 / 0.84);
    font-size: 1.45rem;
    letter-spacing: -0.04em;
  }
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
</style>
