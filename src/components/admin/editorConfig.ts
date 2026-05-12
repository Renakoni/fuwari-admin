import { imageBlockMarkdown } from "./imageBlock";

export type ToolAction = "h2" | "bold" | "italic" | "link" | "code" | "quote" | "bullet" | "ordered";
export type FuwariBlockKind = "note" | "warning" | "figure" | "video" | "evidence";

export type EditorTool = { label: string; icon: string; hint: string; action: ToolAction };
export type EditorBlock = { label: string; icon: string; description: string; kind: FuwariBlockKind; syntax: string };
export type SlashItem = { label: string; hint: string; syntax: string };

export const tools: EditorTool[] = [
  { label: "加粗", icon: "B", hint: "Ctrl+B", action: "bold" },
  { label: "斜体", icon: "I", hint: "Ctrl+I", action: "italic" },
  { label: "标题", icon: "H2", hint: "Ctrl+2", action: "h2" },
  { label: "引用", icon: "❝", hint: "Blockquote", action: "quote" },
  { label: "无序", icon: "•", hint: "List", action: "bullet" },
  { label: "有序", icon: "1.", hint: "List", action: "ordered" },
  { label: "代码块", icon: "</>", hint: "Ctrl+Shift+K", action: "code" },
  { label: "超链接", icon: "↗", hint: "Ctrl+K", action: "link" },
];

export const blocks: EditorBlock[] = [
  { label: "Note", icon: "!", description: "提示块", kind: "note", syntax: "\n```note\ntitle: 提示标题\n写下关键提示或补充说明。\n```\n" },
  { label: "Warn", icon: "△", description: "警告块", kind: "warning", syntax: "\n```warning\ntitle: 注意事项\n说明风险、限制或需要读者特别留意的地方。\n```\n" },
  { label: "Fig", icon: "▧", description: "单图", kind: "figure", syntax: imageBlockMarkdown() },
  { label: "Video", icon: "▶", description: "视频", kind: "video", syntax: "\n```video\nsrc: https://www.youtube.com/embed/VIDEO_ID\nnote: 视频注记\n```\n" },
  { label: "Proof", icon: "※", description: "证据", kind: "evidence", syntax: "\n```proof\ntitle: 证据\n来源、观察或支撑结论的材料。\n```\n" },
];

export const slashItems: SlashItem[] = [
  { label: "Heading 2", hint: "小节标题", syntax: "\n## 小节标题\n\n" },
  { label: "Note", hint: "提示块", syntax: "\n```note\ntitle: 提示标题\n写下关键提示或补充说明。\n```\n" },
  { label: "Warning", hint: "警告块", syntax: "\n```warning\ntitle: 注意事项\n说明风险、限制或需要读者特别留意的地方。\n```\n" },
  { label: "Figure", hint: "单图", syntax: imageBlockMarkdown() },
  { label: "Video", hint: "视频", syntax: "\n```video\nsrc: https://www.youtube.com/embed/VIDEO_ID\nnote: 视频注记\n```\n" },
  { label: "Proof", hint: "证据材料", syntax: "\n```proof\ntitle: 证据\n来源、观察或支撑结论的材料。\n```\n" },
];
