<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let description = "";
  export let tagList: string[] = [];
  export let category = "";
  export let published = "";
  export let cover = "";
  export let coverPreview = "";

  let coverFailed = false;

  $: if (coverPreview || cover) coverFailed = false;

  const dispatch = createEventDispatcher<{ editMetadata: void }>();
</script>

<aside class="metadata-rail" aria-label="Post metadata summary">
  <div class="metadata-rail__head">
    <strong>Metadata</strong>
    <button type="button" aria-label="Edit metadata" on:click={() => dispatch("editMetadata")}>⚙</button>
  </div>
  {#if cover && !coverFailed}
    <div class="metadata-cover">
      <img src={coverPreview || cover} alt="Cover preview" on:error={() => (coverFailed = true)} />
    </div>
  {/if}
  <p>{description || "给这篇文章写一句会出现在首页卡片和标题下方的摘要。"}</p>
  {#if tagList.length}
    <div class="metadata-tags">
      {#each tagList as tag}<span>{tag}</span>{/each}
    </div>
  {/if}
  <dl>
    <div><dt>Category</dt><dd>{category || "None"}</dd></div>
    <div><dt>Date</dt><dd>{published}</dd></div>
    {#if cover}<div><dt>Cover</dt><dd>{cover}</dd></div>{/if}
  </dl>
</aside>

<style>
  .metadata-rail {
    border-left: 1px solid rgb(255 255 255 / 0.065);
    padding-left: 1rem;
    color: rgb(255 255 255 / 0.55);
  }
  .metadata-rail__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.72rem;
  }
  .metadata-rail__head strong {
    color: rgb(255 255 255 / 0.84);
    font-size: 0.98rem;
    font-weight: 900;
    letter-spacing: -0.025em;
  }
  .metadata-rail__head button {
    border-radius: 999px;
    width: 1.8rem;
    height: 1.8rem;
    color: rgb(255 255 255 / 0.42);
    background: rgb(255 255 255 / 0.035);
    transition: transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease;
  }
  .metadata-rail__head button:hover {
    color: var(--primary);
    background: color-mix(in oklch, var(--primary) 13%, transparent);
    transform: rotate(14deg) scale(1.04);
    box-shadow: 0 10px 24px rgb(0 0 0 / 0.18);
  }
  .metadata-rail__head button:active {
    transform: rotate(8deg) scale(0.96);
  }
  .metadata-cover {
    aspect-ratio: 16 / 9;
    margin-bottom: 0.72rem;
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 0.82rem;
    background: rgb(0 0 0 / 0.16);
    overflow: hidden;
  }
  .metadata-cover img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .metadata-rail p {
    margin: 0;
    color: rgb(255 255 255 / 0.58);
    font-size: 0.88rem;
    line-height: 1.55;
  }
  .metadata-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.32rem;
    margin-top: 0.75rem;
  }
  .metadata-tags span {
    border-radius: 999px;
    background: color-mix(in oklch, var(--primary) 12%, transparent);
    padding: 0.22rem 0.5rem;
    color: var(--primary);
    font-size: 0.68rem;
    font-weight: 850;
  }
  .metadata-rail dl {
    display: grid;
    gap: 0.42rem;
    margin: 0.82rem 0 0;
  }
  .metadata-rail dl div {
    display: flex;
    justify-content: space-between;
    gap: 0.7rem;
    color: rgb(255 255 255 / 0.42);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: 0.62rem;
  }
  .metadata-rail dt {
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .metadata-rail dd {
    margin: 0;
    max-width: 11rem;
    color: rgb(255 255 255 / 0.58);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 1100px) {
    .metadata-rail {
      border-left: 0;
      border-top: 1px solid rgb(255 255 255 / 0.065);
      padding: 0.85rem 0 0;
    }
  }
</style>
