<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let draft = true;
  export let lastSavedAt = "";
  export let mode: "write" | "preview" = "write";

  const dispatch = createEventDispatcher<{ modeChange: "write" | "preview" }>();
</script>

<header class="composer-top card-base">
  <a class="composer-back" href="/blog/">← Blog</a>
  <div class="composer-status">
    <span class="system-label">Fuwari Composer</span>
    <strong>{draft ? "Draft" : "Published"}</strong>
    <span>Local draft{lastSavedAt ? ` · saved ${lastSavedAt}` : ""}</span>
  </div>
  <div class="composer-actions">
    {#each ["write", "preview"] as item}
      <button class:active={mode === item} type="button" on:click={() => dispatch("modeChange", item as "write" | "preview")}>{item}</button>
    {/each}
    <button class="commit" type="button">Commit</button>
  </div>
</header>

<style>
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
  @media (max-width: 760px) {
    .composer-top { grid-template-columns: 1fr; }
    .composer-actions { overflow-x: auto; }
  }
</style>
