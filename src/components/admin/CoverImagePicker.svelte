<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ImageUpload } from "../../types";

  type PendingImage = ImageUpload & {
    objectUrl: string;
  };

  export let cover = "";
  export let coverPreview = "";
  export let pendingCover = false;

  const dispatch = createEventDispatcher<{
    coverChange: string;
    coverImageSelected: PendingImage;
    clearCover: void;
  }>();

  let fileInput: HTMLInputElement;
  let status = "";
  let previewFailed = false;

  $: displayPreview = !previewFailed && (coverPreview || cover);
  $: if (coverPreview || cover) previewFailed = false;

  function safeCoverSrc(name: string) {
    const trimmed = name.trim().toLowerCase();
    const lastDot = trimmed.lastIndexOf(".");
    const base = (lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed)
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cover";
    const ext = lastDot > 0 ? trimmed.slice(lastDot + 1).replace(/[^a-z0-9]/g, "") : "jpg";
    return `./cover-${base}-${Date.now()}.${ext || "jpg"}`;
  }

  async function selectCover() {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      status = "请选择图片文件";
      fileInput.value = "";
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const data = await fileToBase64(file);
    const src = safeCoverSrc(file.name);
    status = "本地预览，Save/Commit 后上传";
    dispatch("coverImageSelected", { src, objectUrl, name: file.name, size: file.size, type: file.type, data });
    fileInput.value = "";
  }

  async function fileToBase64(file: File) {
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }

  function updateCover(value: string) {
    status = "";
    dispatch("coverChange", value);
  }

  function clearCover() {
    status = "";
    dispatch("clearCover");
  }
</script>

<section class="cover-picker" aria-label="Cover image">
  <div class="cover-picker__head">
    <span>Cover</span>
    <div class="cover-picker__actions">
      <input bind:this={fileInput} class="cover-picker__file" type="file" accept="image/*" on:change={selectCover} />
      <button type="button" on:click={() => fileInput.click()}>{cover ? "Replace" : "Choose"}</button>
      {#if cover}<button type="button" on:click={clearCover}>Remove</button>{/if}
    </div>
  </div>

  <div class="cover-picker__row">
    <div class="cover-picker__preview" class:cover-picker__preview--empty={!displayPreview}>
      {#if displayPreview}
        <img src={displayPreview} alt="Cover preview" on:error={() => (previewFailed = true)} />
      {:else}
        <span>No cover</span>
      {/if}
    </div>
    <p>{pendingCover ? "本地预览，Save/Commit 后上传" : "Optional cover image for the post card."}</p>
  </div>

  <label class="cover-picker__input">
    <span>Path or URL</span>
    <input value={cover} placeholder="Optional remote URL or ./assets/cover.jpg" on:input={(event) => updateCover(event.currentTarget.value)} />
  </label>

  {#if pendingCover || status}
    <p class="cover-picker__status">{status || "本地预览，Save/Commit 后上传"}</p>
  {/if}
</section>

<style>
  .cover-picker {
    display: grid;
    gap: 0.45rem;
  }
  .cover-picker__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .cover-picker__head > span,
  .cover-picker__input > span {
    color: rgb(255 255 255 / 0.8);
    font-size: 0.76rem;
    font-weight: 850;
  }
  .cover-picker__actions {
    display: flex;
    align-items: center;
    gap: 0.38rem;
  }
  .cover-picker__file {
    display: none;
  }
  .cover-picker__actions button {
    border-radius: 999px;
    padding: 0.36rem 0.62rem;
    color: var(--primary);
    background: color-mix(in oklch, var(--primary) 12%, transparent);
    font-size: 0.7rem;
    transition: transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease;
  }
  .cover-picker__actions button:hover {
    background: color-mix(in oklch, var(--primary) 18%, transparent);
    color: color-mix(in oklch, var(--primary) 78%, white 22%);
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgb(0 0 0 / 0.16);
  }
  .cover-picker__actions button:active {
    transform: translateY(0) scale(0.98);
  }
  .cover-picker__actions button:last-child:not(:first-child) {
    color: rgb(255 255 255 / 0.54);
    background: rgb(255 255 255 / 0.045);
  }
  .cover-picker__row {
    display: grid;
    grid-template-columns: 8rem minmax(0, 1fr);
    align-items: center;
    gap: 0.62rem;
  }
  .cover-picker__row p {
    margin: 0;
    color: rgb(255 255 255 / 0.42);
    font-size: 0.72rem;
    line-height: 1.45;
  }
  .cover-picker__preview {
    display: grid;
    place-items: center;
    width: 8rem;
    aspect-ratio: 16 / 9;
    border: 1px solid rgb(255 255 255 / 0.09);
    border-radius: 0.62rem;
    background: rgb(0 0 0 / 0.18);
    overflow: hidden;
  }
  .cover-picker__preview img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cover-picker__preview--empty {
    border-style: dashed;
  }
  .cover-picker__preview--empty span {
    color: rgb(255 255 255 / 0.34);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.66rem;
    font-weight: 850;
  }
  .cover-picker__input {
    display: grid;
    gap: 0.4rem;
  }
  .cover-picker__input input {
    width: 100%;
    border: 1px solid rgb(255 255 255 / 0.1);
    border-radius: 0.72rem;
    background: rgb(0 0 0 / 0.16);
    padding: 0.48rem 0.6rem;
    color: rgb(255 255 255 / 0.8);
    outline: none;
  }
  .cover-picker__status {
    margin: 0;
    color: color-mix(in oklch, var(--primary) 52%, rgb(255 255 255 / 0.42));
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.66rem;
  }
  @media (max-width: 560px) {
    .cover-picker__head {
      align-items: flex-start;
      flex-direction: column;
    }
    .cover-picker__row {
      grid-template-columns: 1fr;
    }
    .cover-picker__preview {
      width: min(100%, 9rem);
    }
  }
</style>
