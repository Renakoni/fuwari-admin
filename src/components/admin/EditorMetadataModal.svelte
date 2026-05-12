<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import CoverImagePicker from "./CoverImagePicker.svelte";
  import type { ImageUpload } from "../../types";

  type PendingImage = ImageUpload & {
    objectUrl: string;
  };

  export let description = "";
  export let category = "";
  export let published = "";
  export let tags = "";
  export let cover = "";
  export let coverPreview = "";
  export let pendingCover = false;
  export let draft = true;

  const dispatch = createEventDispatcher<{
    close: void;
    descriptionChange: string;
    categoryChange: string;
    publishedChange: string;
    tagsChange: string;
    coverChange: string;
    coverImageSelected: PendingImage;
    clearCover: void;
    toggleDraft: void;
  }>();
</script>

<button class="metadata-modal-backdrop" type="button" aria-label="Close metadata editor" on:click={() => dispatch("close")}></button>
<div class="metadata-modal" role="dialog" aria-modal="true" aria-label="Edit post metadata">
  <header>
    <strong>Edit post details</strong>
    <button type="button" aria-label="Close metadata editor" on:click={() => dispatch("close")}>×</button>
  </header>
  <div class="metadata-modal__body">
    <label>
      <span>Description</span>
      <input value={description} placeholder="首页卡片和文章标题下方的摘要" on:input={(event) => dispatch("descriptionChange", event.currentTarget.value)} />
    </label>
    <div class="metadata-modal__grid">
      <label>
        <span>Category</span>
        <input value={category} on:input={(event) => dispatch("categoryChange", event.currentTarget.value)} />
      </label>
      <label>
        <span>Date</span>
        <input value={published} type="date" on:input={(event) => dispatch("publishedChange", event.currentTarget.value)} />
      </label>
    </div>
    <label>
      <span>Tags</span>
      <input value={tags} placeholder="Astro, UI" on:input={(event) => dispatch("tagsChange", event.currentTarget.value)} />
    </label>
    <CoverImagePicker {cover} {coverPreview} {pendingCover} on:coverChange={(event) => dispatch("coverChange", event.detail)} on:coverImageSelected={(event) => dispatch("coverImageSelected", event.detail)} on:clearCover={() => dispatch("clearCover")} />
    <button class:draft-active={draft} type="button" on:click={() => dispatch("toggleDraft")}>{draft ? "Draft" : "Live"}</button>
  </div>
  <footer>
    <button type="button" on:click={() => dispatch("close")}>Done</button>
  </footer>
</div>

<style>
  .metadata-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.48);
    backdrop-filter: blur(12px);
    padding: 1rem;
  }
  .metadata-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 81;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    width: min(30rem, calc(100vw - 3rem));
    max-height: min(34rem, calc(100vh - 4rem));
    transform: translate(-50%, -50%);
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 1rem;
    background: color-mix(in oklch, var(--card-bg) 96%, black 4%);
    box-shadow: 0 26px 80px rgb(0 0 0 / 0.42);
    overflow: hidden;
    animation: metadata-enter 150ms ease-out;
  }
  .metadata-modal header,
  .metadata-modal footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgb(255 255 255 / 0.08);
    padding: 0.64rem 0.78rem;
  }
  .metadata-modal footer {
    justify-content: flex-end;
    border-top: 1px solid rgb(255 255 255 / 0.08);
    border-bottom: 0;
  }
  .metadata-modal header strong {
    color: rgb(255 255 255 / 0.9);
    font-size: 0.98rem;
    font-weight: 900;
  }
  .metadata-modal button {
    border-radius: 0.72rem;
    background: rgb(255 255 255 / 0.06);
    padding: 0.5rem 0.75rem;
    color: rgb(255 255 255 / 0.76);
    font-weight: 850;
    transition: transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease;
  }
  .metadata-modal button:hover {
    background: rgb(255 255 255 / 0.095);
    color: rgb(255 255 255 / 0.9);
    transform: translateY(-1px);
  }
  .metadata-modal button:active {
    transform: translateY(0) scale(0.98);
  }
  .metadata-modal header button {
    width: 2rem;
    height: 2rem;
    padding: 0;
    color: rgb(255 255 255 / 0.5);
  }
  .metadata-modal__body {
    display: grid;
    gap: 0.62rem;
    min-height: 0;
    padding: 0.72rem 0.78rem;
    overflow: auto;
    scrollbar-width: thin;
  }
  .metadata-modal__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.62rem;
  }
  .metadata-modal label {
    display: grid;
    gap: 0.4rem;
  }
  .metadata-modal label span {
    color: rgb(255 255 255 / 0.8);
    font-size: 0.76rem;
    font-weight: 850;
  }
  .metadata-modal input {
    width: 100%;
    border: 1px solid rgb(255 255 255 / 0.1);
    border-radius: 0.72rem;
    background: rgb(0 0 0 / 0.16);
    padding: 0.48rem 0.6rem;
    color: rgb(255 255 255 / 0.8);
    outline: none;
  }
  .metadata-modal .draft-active {
    color: var(--primary);
    background: color-mix(in oklch, var(--primary) 12%, transparent);
  }
  @keyframes metadata-enter {
    from { opacity: 0; transform: translate(-50%, calc(-50% + 0.35rem)) scale(0.985); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  @media (max-width: 760px) {
    .metadata-modal {
      width: min(22rem, calc(100vw - 1.6rem));
      max-height: min(38rem, calc(100vh - 1.8rem));
    }
    .metadata-modal__grid { grid-template-columns: 1fr; }
  }
</style>
