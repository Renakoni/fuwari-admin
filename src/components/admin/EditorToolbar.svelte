<script lang="ts">
  import { createEventDispatcher } from "svelte";

  type ToolAction = "bold" | "italic" | "underline" | "strike" | "spoiler" | "link" | "code" | "math" | "quote" | "bullet" | "ordered";
  type FuwariBlockKind = "note" | "warning" | "figure" | "video" | "evidence" | "rating" | "stat" | "github" | "tabs";

  export let tools: Array<{ label: string; icon: string; hint: string; action: ToolAction }> = [];
  export let blocks: Array<{ label: string; icon: string; description: string; kind: FuwariBlockKind; syntax: string }> = [];

  const dispatch = createEventDispatcher<{
    tool: { label: string; icon: string; hint: string; action: ToolAction };
    block: { label: string; icon: string; description: string; kind: FuwariBlockKind; syntax: string };
  }>();
</script>

<nav class="composer-toolbar" aria-label="Composer toolbar">
  {#each tools as tool}
    <button type="button" title={`${tool.label} · ${tool.hint}`} on:click={() => dispatch("tool", tool)}>
      <strong>{tool.icon}</strong>
      <span>{tool.label}</span>
    </button>
  {/each}
  {#each blocks as block}
    <button class="toolbar-block" type="button" title={`${block.label} · ${block.description}`} on:click={() => dispatch("block", block)}>
      <strong>{block.icon}</strong>
      <span>{block.label}</span>
    </button>
  {/each}
</nav>

<style>
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
  .composer-toolbar button:nth-child(5),
  .composer-toolbar button:nth-child(8),
  .composer-toolbar button:nth-child(10) {
    margin-left: 0.44rem;
    box-shadow: -0.5rem 0 0 -0.46rem rgb(255 255 255 / 0.11);
  }
  .composer-toolbar button[title^="下划"] strong {
    text-decoration: underline;
    text-underline-offset: 0.16em;
  }
  .composer-toolbar button[title^="删除"] strong {
    text-decoration: line-through;
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
</style>
