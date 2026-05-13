import { imageBlockMarkdown } from "./imageBlock";

export type ToolAction = "bold" | "italic" | "underline" | "strike" | "spoiler" | "link" | "code" | "math" | "quote" | "bullet" | "ordered";
export type FuwariBlockKind = "note" | "warning" | "figure" | "video" | "evidence" | "rating" | "stat" | "github" | "tabs";

export type EditorTool = { label: string; icon: string; hint: string; action: ToolAction };
export type EditorBlock = { label: string; icon: string; description: string; kind: FuwariBlockKind; syntax: string };
export const tools: EditorTool[] = [
  { label: "加粗", icon: "B", hint: "Ctrl+B", action: "bold" },
  { label: "斜体", icon: "I", hint: "Ctrl+I", action: "italic" },
  { label: "下划", icon: "U", hint: "Underline", action: "underline" },
  { label: "删除", icon: "S", hint: "Strikethrough", action: "strike" },
  { label: "遮罩", icon: "▉", hint: "Spoiler", action: "spoiler" },
  { label: "引用", icon: "❝", hint: "Blockquote", action: "quote" },
  { label: "无序", icon: "•", hint: "List", action: "bullet" },
  { label: "有序", icon: "1.", hint: "List", action: "ordered" },
  { label: "代码块", icon: "</>", hint: "Ctrl+Shift+K", action: "code" },
  { label: "公式", icon: "∑", hint: "LaTeX", action: "math" },
  { label: "超链接", icon: "↗", hint: "Ctrl+K", action: "link" },
];

export const blocks: EditorBlock[] = [
  { label: "Note", icon: "!", description: "提示块", kind: "note", syntax: "\n```note\ntitle: 提示标题\n写下关键提示或补充说明。\n```\n" },
  { label: "Warn", icon: "△", description: "警告块", kind: "warning", syntax: "\n```warning\ntitle: 注意事项\n说明风险、限制或需要读者特别留意的地方。\n```\n" },
  { label: "Fig", icon: "▧", description: "单图", kind: "figure", syntax: imageBlockMarkdown() },
  { label: "Video", icon: "▶", description: "视频", kind: "video", syntax: "\n```video\nsrc: https://www.youtube.com/embed/VIDEO_ID\nnote: 视频注记\n```\n" },
  { label: "Proof", icon: "※", description: "证据", kind: "evidence", syntax: "\n```proof\ntitle: 证据\n来源、观察或支撑结论的材料。\n```\n" },
  { label: "Rate", icon: "★", description: "评分", kind: "rating", syntax: "\n```rating\nlabel: 推荐度\nvalue: 4.5\nmax: 5\nnote: 值得一试\n```\n" },
  { label: "Stat", icon: "▰", description: "指标", kind: "stat", syntax: "\n```stat\nlabel: 完成度\nvalue: 72\nmax: 100\nnote: 当前阶段\n```\n" },
  { label: "GitHub", icon: "GH", description: "仓库卡片", kind: "github", syntax: "\n```github\nhttps://github.com/saicaca/fuwari\n```\n" },
  { label: "Tabs", icon: "⇄", description: "分栏内容", kind: "tabs", syntax: "\n```tabs\npnpm = pnpm install\nnpm = npm install\nbun = bun install\n```\n" },
];

