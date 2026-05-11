<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let x = 0;
  export let y = 0;
  export let query = "";
  export let items: Array<{ label: string; hint: string; syntax: string }> = [];

  const dispatch = createEventDispatcher<{
    queryChange: string;
    selectItem: { label: string; hint: string; syntax: string };
    close: void;
  }>();
</script>

<section class="slash-menu" style={`left: ${x}px; top: ${y + 8}px;`}>
  <div class="slash-menu__search">
    <span>/</span>
    <input value={query} placeholder="Fuwari block or Markdown command" on:input={(event) => dispatch("queryChange", event.currentTarget.value)} on:keydown={(event) => event.key === "Escape" && dispatch("close")} />
  </div>
  <div class="slash-menu__list">
    {#each items as item}
      <button type="button" on:click={() => dispatch("selectItem", item)}>
        <strong>{item.label}</strong>
        <span>{item.hint}</span>
      </button>
    {/each}
  </div>
</section>

<style>
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
</style>
