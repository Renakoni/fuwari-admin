# 项目现状

工作目录：`E:\blog\fuwari-admin`

`fuwari-admin` 当前是 Astro + Svelte 实现的 Fuwari 风格个人发布控制台。它的目标不是通用 CMS dashboard，而是贴近主站 Fuwari 体验的后台写作与内容管理界面。

## 产品方向

- 视觉语言要贴近主站 Fuwari：卡片、导航、动效、暗色质感、主色调和文章阅读体验应保持一致。
- 不做传统后台的大量表格、统计面板和拥挤工具区。
- Blog / Notes / Projects 是高层页面；进入编辑后应专注于文章写作、元数据和预览。
- UI copy 保持克制，工具栏优先功能性，不写长说明。
- AI 功能暂不放进顶部编辑工具栏；如果后续恢复，宜作为底部或聊天式助手独立出现。
- 当前主流程优先级：列表进入内容 → 新建/编辑草稿 → 写作 → 元数据 → 预览 → 后续再接 commit/publish。

## 技术栈与入口

- 框架：Astro 5 + Svelte 5。
- 包管理：pnpm。
- Markdown/内容能力：Astro markdown pipeline、remark/rehype、Expressive Code、Fuwari 风格自定义 directive 处理。
- 编辑器：Milkdown Crepe，封装在 `src/components/admin/MilkdownSurface.svelte`。
- 主要脚本：
  - `pnpm dev`
  - `pnpm build`
  - `pnpm type-check`

关键配置：

- `astro.config.mjs`：Astro integrations、Svelte、Swup、icons、Expressive Code、remark/rehype pipeline。
- `src/config.ts`：站点标题、导航、主题 hue、banner、profile 等 Fuwari 配置。
- `src/styles/main.css` 与 `src/styles/variables.styl`：全局视觉基底、卡片、导航、首页、文章/项目样式。

## 页面结构

- `src/pages/index.astro`
  - 首页入口，使用 `HomeHero` 和启动卡片进入 Blog / Notes / Projects。
- `src/pages/blog.astro`
  - Blog 管理列表页，挂载 `AdminArchive kind="blog"`。
- `src/pages/notes.astro`
  - Notes 管理列表页，挂载 `AdminArchive kind="note"`。
- `src/pages/projects.astro`
  - Projects 当前只读说明页；项目数据仍由主站式 TypeScript 数据驱动，后续可再迁移到可编辑内容源。
- `src/pages/editor.astro`
  - 专注编辑页，挂载 `AdminEditor`，关闭侧栏。

布局：

- `src/layouts/Layout.astro`
  - 全局 HTML、Navbar、Swup、OverlayScrollbars、主题初始化、PhotoSwipe 等。
- `src/layouts/MainGridLayout.astro`
  - Fuwari 主内容网格、可选 sidebar、footer、TOC/back-to-top。

## Admin 内容流

### Archive → Editor

`src/components/admin/AdminArchive.svelte` 负责 Blog/Notes 列表：

- 从 `localStorage` 读取 GitHub settings。
- 通过 `loadContentEntries(settings)` 拉取内容列表。
- 新建时调用 `editorForNewPost(...)`，把 `EditorState` 写入 `localStorage`，再跳转 `/editor/`。
- 打开已有内容时调用 `editorForEntry(entry)`，同样写入 `localStorage` 后跳转 `/editor/`。

### 内容读取

- `src/lib/github.ts`
  - GitHub Contents API 封装：目录列表、文件读取、文件写入。
  - `writeFile(...)` 已存在，但当前编辑器 UI 的 commit/publish 流程还未真正接好。
- `src/lib/content.ts`
  - 根据 GitHub 文件树读取 Markdown 内容。
  - 支持 `index.md` 形式的文章目录。
  - 通过 category 判断 blog/note。
  - 提供 slug/path/editor state 转换。
- `src/lib/frontmatter.ts`
  - frontmatter 默认值、解析、序列化。
  - cover/image 默认空字符串，只有用户填写时才写入。
- `src/lib/storage.ts`
  - `fuwari-admin:settings`
  - `fuwari-admin:editor`

## 编辑器现状

关键文件：

- `src/components/admin/AdminEditor.svelte`
- `src/components/admin/MilkdownSurface.svelte`

`AdminEditor.svelte` 当前提供：

- 标题与元数据区域。
- write / preview 模式切换。
- 轻量顶部工具栏：Bold、Italic、H2、Quote、Bullet、Ordered、Code、Link。
- Fuwari block 按钮：Note、Warn、Fig、Grid、Video、Proof。
- metadata modal：description、category、date、tags、cover、draft/live。
- preview 模式的轻量 Markdown/Fuwari block 展示。

`MilkdownSurface.svelte` 当前提供：

- Crepe 编辑器封装。
- 禁用部分 Crepe 内置 UI，避免和自定义 toolbar 冲突。
- 快捷键：
  - `Ctrl+B` / `Ctrl+I` 使用真实 mark。
  - `Ctrl+K` 使用 link mark。
  - `Ctrl+2` 等标题快捷键使用 ProseMirror block transform。
  - `Ctrl+0` 转回 paragraph。
  - `Ctrl+Shift+K` 转 code block。
- 代码块自定义复制按钮和语言输入。
- `insertFuwariBlock(kind)` 会直接创建 ProseMirror 节点：
  - Note / Warn / Proof：blockquote 节点。
  - Fig / Grid：image 节点 + caption 段落。
  - Video：link mark 文本。
- 当前 block 插入策略是插到当前 block 后面，避免落在标题或段落内部。

注意：slash menu 目前仍走 `insertSyntax(...)`，也就是插入 Markdown 字符串；toolbar 的 Fuwari block 才走 `insertFuwariBlock(...)`。

## 已验证状态

2026-05-11 已验证：

- `pnpm build` 通过。
- `/editor/` write 模式下 toolbar 的 Note / Warn / Proof 会插入 blockquote 节点。
- Fig / Grid 会插入 image 节点与 caption 段落。
- Video 会插入 link mark 文本。
- toolbar 插入后未出现 `:::`, `![...]`, `[!NOTE]` / `[!WARNING]` / `[!IMPORTANT]` 等源码文本泄漏。
- 插入后焦点仍在 ProseMirror，移动端无水平溢出。
- 已用 Playwright 截图检查桌面和移动端布局，当前可用。

验证时观察到：Fig / Grid 使用 `./image.png`, `./a.png`, `./b.png`, `./c.png` 示例路径，因此浏览器会显示破图图标并产生本地 404。这是占位资源问题，不是 Markdown 源码泄漏。

## 当前未完成或待确认

- slash menu 还没有和 toolbar 一样改成节点插入。
- commit/publish 按钮当前只是 UI，占位逻辑尚未完成。
- GitHub settings UI 仍未完善；Archive 读取依赖 localStorage 中已有 settings。
- Projects 当前只读。
- 预览渲染是轻量自写解析，不等同于完整 Astro/Fuwari markdown pipeline。

## 后续优先级建议

1. 处理 Fig / Grid 默认占位图路径的体验，避免新草稿里直接产生破图 404。
2. 把 slash menu 接到和 toolbar 相同的节点插入能力。
3. 稳定 metadata 与 draft localStorage 行为，确保 cover 默认保持空。
4. 设计 settings 与 commit/publish 流程，不要在编辑器顶部堆太多控件。
5. 长期再考虑 Milkdown 自定义 schema/node view，让 callout、figure、gallery、video、evidence 成为真正可编辑的 Fuwari card，并能序列化回目标 Markdown/directive 格式。

## 协作注意

- 不要提交，除非用户明确要求。
- 对 UI/前端改动，完成前应启动 dev server 并用浏览器检查桌面与移动端。
- 保持编辑页专注，不要把 archive、settings、搜索、AI、发布日志等都塞回写作界面。
- 项目质量优先于 MVP 速度；如果长期体验明显更好，可以选择更深入的实现，但不要在主写作流稳定前跳到大规模编辑器 schema 重构。
