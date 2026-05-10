# fuwari-admin handoff

## Project goal

Build `fuwari-admin` as an independent, statically deployable admin panel for managing the existing `fuwari` Astro blog.

The goal is not to replace the current static-site architecture. The admin should make writing, previewing, and publishing content easier while keeping `fuwari` as the source-of-truth repository and GitHub Actions as the deployment path.

## Current main-site architecture

`E:\blog\fuwari` is the public Astro/Fuwari site.

Current deployment flow:

```text
fuwari repository
  -> GitHub push / scheduled workflow
  -> GitHub Actions builds the Astro site
  -> GitHub Actions uploads dist.zip to VPS
  -> VPS deploy-blog script extracts into /var/www/blog.secpan.me
  -> Caddy serves blog.secpan.me as static files
```

Important implications:

- The blog is static.
- Content should remain Git-backed.
- GitHub history is the audit trail.
- The VPS should preferably remain a static host for the public site.
- Do not introduce MySQL or a traditional backend unless there is a clear later need.

## Recommended admin architecture

First version should be:

```text
fuwari-admin static frontend
  -> GitHub OAuth / fine-grained token
  -> GitHub Contents API / Git Data API
  -> commits Markdown changes to fuwari repo
  -> existing GitHub Actions deploys blog
```

Do not make the first version a VPS file manager or shell executor.

The admin should read/write the `fuwari` repo through GitHub, not directly through the VPS filesystem.

## Why separate from fuwari

Keep `fuwari-admin` separate from `fuwari` because:

- `fuwari` is the public presentation site.
- `fuwari-admin` is an editing/publishing tool.
- Admin dependencies, auth, GitHub API code, editors, preview UI, and future deployment-status tools should not pollute the public site.
- Combining them does not solve the core write problem; a static `/admin` route would still need GitHub API or a backend.

Recommended local layout:

```text
E:\blog\fuwari\        # public Astro site
E:\blog\fuwari-admin\  # admin panel project
```

## First-version scope

Keep v1 small and useful:

1. GitHub authentication/token setup.
2. Configure target repo/branch/path.
3. List content entries from `fuwari`.
4. Create new Blog / Notes / Projects entry.
5. Edit frontmatter fields.
6. Edit Markdown body.
7. Show live Markdown preview.
8. Commit changes back to the `fuwari` repo.
9. Optionally show latest GitHub Actions deployment status.

Avoid in v1:

- Database.
- VPS write API.
- Arbitrary shell commands.
- Full image optimization pipeline.
- Complex role/permission system.
- WYSIWYG editor if Markdown editor is enough.

## Content targets to investigate in fuwari

The new session should inspect the current `fuwari` repo before implementing. Likely areas:

```text
E:\blog\fuwari\src\content\
E:\blog\fuwari\src\content.config.ts or equivalent Astro content config
E:\blog\fuwari\src\pages\
E:\blog\fuwari\public\optimized\covers\
E:\blog\fuwari\raw_cover\              # local-only ignored source covers
```

Do not assume exact schemas. Read the current files.

## Image/cover strategy

Current direction for the main site:

- Manual original cover images live locally in `raw_cover/` and are ignored by Git.
- Optimized generated covers live in `public/optimized/covers/` and are committed.
- `pnpm optimize-covers` generates responsive AVIF/WebP cover assets using sharp.
- The public site prefers AVIF/WebP rendered assets.

For admin v1, do not solve full cover upload/optimization yet unless explicitly requested.

Suggested staged approach:

1. v1: choose from existing committed optimized covers.
2. v2: upload image to a simple committed uploads directory.
3. v3: integrate cover optimization workflow.

## Ops learning path

The user is interested in learning ops/devops skills for future job value, but wants to avoid unsafe overreach.

Suggested progression:

1. Static GitHub-based CMS.
2. Add read-only deployment/status panel.
3. Later add very limited, authenticated operations such as triggering deploy or rollback.

If adding a VPS API later, apply strict safety:

- Run as low-privilege systemd user.
- Use Caddy reverse proxy with authentication.
- Store secrets server-side only.
- Whitelist operations.
- Never accept arbitrary shell commands.
- Restrict writable paths.
- Log every operation.
- Add backups before destructive writes.

## Product direction

The admin should feel like a focused personal publishing console, not a generic CMS clone.

Prioritize:

- Fast article creation.
- Clear Blog / Notes / Projects separation.
- Frontmatter editing without manual YAML mistakes.
- Markdown writing comfort.
- Preview close to final article rendering where feasible.
- One-click commit/publish.
- Minimal explanatory UI copy.

Avoid:

- Overly generic dashboard clutter.
- Heavy enterprise CMS patterns.
- Premature backend/database architecture.

## Suggested prompt for new Claude Code session

Use this in a new session with working directory `E:\blog\fuwari-admin`:

```text
We are starting fuwari-admin from scratch. It should be an independent, statically deployable GitHub-based CMS for managing the existing Astro/Fuwari site at E:\blog\fuwari.

The admin should not use a database and should not write directly to the VPS filesystem. First version should use GitHub API to read/write Markdown content in the fuwari repo, then rely on the existing GitHub Actions deployment flow.

Please first inspect E:\blog\fuwari to understand its content schema and publishing structure, then propose an implementation plan. Do not start coding until the architecture is approved.

V1 target: GitHub auth/token, list Blog/Notes/Projects content, create/edit Markdown with frontmatter form, live preview, and commit changes to the fuwari repository.
```

## Current recommendation

Start in a new Claude Code session rooted at:

```text
E:\blog\fuwari-admin
```

Keep the current `fuwari` session for main-site fixes and deployment issues.
