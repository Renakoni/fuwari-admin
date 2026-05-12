<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let draft = true;
  export let lastSavedAt = "";
  export let mode: "write" | "preview" = "write";
  export let pendingImageCount = 0;
  export let saveMessage = "";
  export let saveState: "idle" | "saving" | "saved" | "blocked" | "error" = "idle";

  const dispatch = createEventDispatcher<{ modeChange: "write" | "preview"; save: void }>();
</script>

<header class="composer-top card-base">
  <a class="composer-back" href="/blog/">← Blog</a>
  <div class="composer-status">
    <span class="system-label">Fuwari Composer</span>
    <strong>{draft ? "Draft" : "Published"}</strong>
    <span>Remote draft{lastSavedAt ? ` · saved ${lastSavedAt}` : " · not saved"}{pendingImageCount ? ` · ${pendingImageCount} image pending` : ""}</span>
    {#if saveMessage}<span class:success={saveState === "saved"} class:warning={saveState === "blocked"} class:error={saveState === "error"}>{saveMessage}</span>{/if}
  </div>
  <div class="composer-actions">
    {#each ["write", "preview"] as item}
      <button class:active={mode === item} type="button" on:click={() => dispatch("modeChange", item as "write" | "preview")}>{item}</button>
    {/each}
    <button class="save" type="button" disabled={saveState === "saving"} on:click={() => dispatch("save")}>{saveState === "saving" ? "Saving" : "Save"}</button>
    <button class="commit" type="button" disabled title="Publish commit is not wired yet.">Commit</button>
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
  .composer-actions .save,
  .composer-actions .commit {
    color: var(--primary);
    background: color-mix(in oklch, var(--primary) 12%, transparent);
  }
  .composer-actions .commit:disabled,
  .composer-actions .save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .composer-status {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.28rem 0.55rem;
    min-width: 0;
  }
  .composer-status strong {
    color: rgb(255 255 255 / 0.86);
    font-size: 0.92rem;
  }
  .composer-status span {
    color: rgb(255 255 255 / 0.36);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.68rem;
  }
  .composer-status span.success { color: color-mix(in oklch, var(--primary) 62%, rgb(255 255 255 / 0.46)); }
  .composer-status span.warning { color: #f0c674; }
  .composer-status span.error { color: #ff9a9a; }
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
