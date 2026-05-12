export type ImageBlockFields = {
  src: string;
  alt: string;
  caption: string;
};

export const defaultImageNote = "图片说明";

export const defaultImageBlock: ImageBlockFields = {
  src: "./image.png",
  alt: defaultImageNote,
  caption: defaultImageNote,
};

function readField(body: string, name: keyof ImageBlockFields): string {
  return body.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() || "";
}

export function parseImageBlock(body: string): ImageBlockFields {
  const src = readField(body, "src");
  const alt = readField(body, "alt") || defaultImageBlock.alt;
  const caption = readField(body, "caption") || alt || defaultImageBlock.caption;
  return { src, alt, caption };
}

export function imageNote(fields: Partial<ImageBlockFields> = {}): string {
  return fields.caption || fields.alt || defaultImageNote;
}

export function serializeImageBlock(fields: Partial<ImageBlockFields>): string {
  const note = imageNote(fields);
  const image = { ...defaultImageBlock, ...fields, alt: note, caption: note };
  return `src: ${image.src}\nalt: ${image.alt}\ncaption: ${image.caption}`;
}

export function imageBlockMarkdown(fields: Partial<ImageBlockFields> = {}): string {
  return `\n\`\`\`image\n${serializeImageBlock(fields)}\n\`\`\`\n`;
}

export function isImagePlaceholder(src: string): boolean {
  const value = src.trim();
  return !value || value.startsWith("./");
}
