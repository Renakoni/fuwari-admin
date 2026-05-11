# Handoff for next Claude Code session

Working directory: `E:\blog\fuwari-admin`

This repository is mid-migration from a Vite/React starter into an Astro + Svelte admin UI for the Fuwari blog. Do not assume the old deleted Vite files should be restored; the new Astro/Svelte structure is intentional.

## Product direction

`fuwari-admin` should be a focused personal publishing console for the existing Fuwari/Astro blog, not a generic CMS dashboard.

Important preferences:

- Match the main Fuwari site's visual language; avoid generic brown/admin styling.
- Prioritize final experience over MVP shortcuts.
- Keep UI copy minimal. Toolbars should be functional, not explanatory.
- Do not put AI controls in the top editor toolbar. If AI returns later, keep it as a separate bottom/chat-style assistant.
- Main flow first: write, edit metadata, preview, commit/publish later.

## Current architecture state

The app is now Astro + Svelte. Key files for the editor work:

- `src/pages/editor.astro`
- `src/components/admin/AdminEditor.svelte`
- `src/components/admin/MilkdownSurface.svelte`
- `src/lib/storage.ts`
- `src/types.ts`

There is a large uncommitted migration in progress:

- old files deleted: `index.html`, `src/App.tsx`, `src/main.tsx`, `src/styles.css`, old Vite tsconfigs, `vite.config.ts`
- new files untracked: `astro.config.mjs`, `svelte.config.js`, `tailwind.config.cjs`, `src/components/`, `src/pages/`, `src/layouts/`, `src/content/`, etc.

Do not commit unless the user explicitly asks.

## Editor status

The `/editor/` page has an editor shell with:

- title/frontmatter metadata area
- write/source/preview modes
- Milkdown/Crepe editor in write mode
- source textarea fallback
- lightweight top toolbar

Top toolbar currently contains:

- formatting: Bold, Italic, H2, Quote, Bullet, Ordered, Code, Link
- insert group: Note, Warn, Fig, Grid, Video, Proof

The old bulky bottom `Fuwari Blocks` dock was removed.

## Milkdown fixes already done

In `MilkdownSurface.svelte`:

- Crepe built-in cursor feature disabled.
- `Ctrl+2` uses ProseMirror block transform to create real headings, not raw `##` text.
- `Ctrl+0` converts current block to paragraph.
- `Ctrl+B`, `Ctrl+I`, `Ctrl+K` use real marks/link when possible.
- `Ctrl+Shift+K` creates a real code block.
- Code block styling was softened.

## Current Fuwari block insertion state

The user noticed Note/Warn/Fig/Grid/Video/Proof were still inserting visible Markdown/directive source. This was partially fixed.

Current approach:

- `AdminEditor.svelte` calls `milkdownSurface.insertFuwariBlock(block.kind)` in write mode.
- source mode still falls back to Markdown strings.
- `MilkdownSurface.svelte` has `insertFuwariBlock(kind)` that creates ProseMirror nodes directly:
  - Note/Warn/Proof -> `blockquote` nodes
  - Fig/Grid -> real image nodes + caption paragraph
  - Video -> real link node

Validation already done before the final insertion-position tweak:

- Note rendered as `<blockquote>`.
- Grid rendered as `<img>` nodes.
- No visible `:::` directive text.
- No visible `![...]` image Markdown source.

Then insertion was changed to insert after the current block instead of replacing the current selection, to avoid placing blocks inside headings/paragraphs. This final insertion-position change has only been build-tested, not browser-tested yet.

Next session should first verify this in the browser.

## Immediate next steps

1. Run `pnpm build`.
2. Start dev server, e.g. `pnpm dev --host 127.0.0.1 --port 5173`.
3. Open `/editor/` with Playwright.
4. Clear `localStorage.removeItem('fuwari-admin:editor')` before testing if stale drafts interfere.
5. In write mode, test toolbar buttons:
   - Note/Warn/Proof should insert blockquotes after the current block.
   - Fig/Grid should insert real image nodes and captions after the current block.
   - Video should insert a link node after the current block.
   - No `:::`, `![...]`, or raw Markdown syntax should appear in write mode for these buttons.
6. Check cursor position and page jump behavior after insertion.
7. If visual UI changed, use frontend visual check: desktop and mobile screenshots.

## Known build warnings

`pnpm build` passes, but warnings remain:

- Svelte sourcemap / `/* @__PURE__ */` comment warning in `AdminEditor.svelte`.
- `gray-matter` uses eval warning.
- AdminEditor/Milkdown client chunk exceeds 500 kB.

These are not currently blocking.

## Longer-term editor direction

The current `insertFuwariBlock` is an intermediate UX fix using native Milkdown/ProseMirror nodes. It is not yet a true custom Fuwari directive editor.

For final quality, consider custom Milkdown schema/node views for Fuwari blocks:

- callout
- figure
- gallery
- video
- evidence

These should look like editable Fuwari cards in write mode and serialize back to the correct Fuwari Markdown/directive format for storage.

Do not jump to that larger custom schema work without first stabilizing the current main writing flow.
