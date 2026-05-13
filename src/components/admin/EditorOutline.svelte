<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export type OutlineItem = {
    id: string;
    text: string;
    level: number;
    line: number;
    previewIndex: number;
    occurrence: number;
  };

  export let items: OutlineItem[] = [];
  export let mode: "write" | "preview" = "write";

  const dispatch = createEventDispatcher<{ jump: OutlineItem }>();
</script>

<aside class="editor-outline" aria-label="Article outline">
  <div class="outline-label">Outline</div>
  {#if items.length > 0}
    <nav>
      {#each items as item}
        <button class={`outline-item outline-level-${Math.min(item.level, 4)}`} type="button" on:click={() => dispatch("jump", item)}>
          <span>{item.text}</span>
          <small>H{item.level}</small>
        </button>
      {/each}
    </nav>
  {:else}
    <p>用 Markdown 标题生成大纲：<code>## 小节标题</code></p>
  {/if}
</aside>

<style>
  .editor-outline {
    position: sticky;
    top: 5.2rem;
    align-self: start;
    max-height: calc(100vh - 6.2rem);
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: 1rem;
    background:
      radial-gradient(circle at 100% 0%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 38%),
      rgb(255 255 255 / 0.035);
    padding: 0.82rem;
    overflow: auto;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.035), 0 16px 38px rgb(0 0 0 / 0.15);
  }
  .outline-label {
    margin-bottom: 0.58rem;
    color: rgb(255 255 255 / 0.38);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  nav {
    display: grid;
    gap: 0.16rem;
  }
  .outline-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    border: 0;
    border-radius: 0.64rem;
    background: transparent;
    padding: 0.42rem 0.5rem;
    color: rgb(255 255 255 / 0.58);
    text-align: left;
    transition: background 140ms ease, color 140ms ease, transform 140ms ease;
  }
  .outline-item:hover {
    transform: translateX(2px);
    background: rgb(255 255 255 / 0.055);
    color: rgb(255 255 255 / 0.86);
  }
  .outline-item span {
    overflow: hidden;
    font-size: 0.78rem;
    font-weight: 760;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .outline-item small {
    color: rgb(255 255 255 / 0.28);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.56rem;
    font-weight: 850;
  }
  .outline-level-2 { padding-left: 0.72rem; }
  .outline-level-3 { padding-left: 1.16rem; }
  .outline-level-4 { padding-left: 1.58rem; }
  p {
    margin: 0;
    color: rgb(255 255 255 / 0.42);
    font-size: 0.74rem;
    line-height: 1.65;
  }
  code {
    color: color-mix(in oklch, var(--primary) 62%, white 8%);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.7rem;
  }
  @media (max-width: 1180px) {
    .editor-outline {
      position: static;
      max-height: 13rem;
    }
  }
</style>
