import type { ServerConfig } from "./config.js";
import { readBase64File, readFileOrNull, writeBase64File } from "./github.js";
import type { EditorState, ImageUpload, PostFrontmatter } from "./types.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 20;
const IMAGE_TYPES = {
  "image/png": { ext: "png", magic: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { ext: "jpg", magic: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/webp": { ext: "webp", magic: (bytes: Buffer) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" },
  "image/gif": { ext: "gif", magic: (bytes: Buffer) => ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii")) },
} satisfies Record<string, { ext: string; magic: (bytes: Buffer) => boolean }>;

type ImagePayload = {
  src: string;
  name: string;
  size: number;
  type: keyof typeof IMAGE_TYPES;
  data: string;
  filename: string;
};

function cleanSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^-+|-+$/g, "") || "untitled";
}

export function draftIdForEditor(editor: EditorState): string {
  return `${editor.kind}-${cleanSlug(editor.slug).replace(/\//g, "~")}`;
}

function safeFilename(name: string, type: keyof typeof IMAGE_TYPES): string {
  const trimmed = name.trim().toLowerCase();
  const baseName = trimmed.replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
  return `${baseName}.${IMAGE_TYPES[type].ext}`;
}

function dedupeFilenames(images: ImagePayload[]): ImagePayload[] {
  const counts = new Map<string, number>();
  return images.map((image) => {
    const dot = image.filename.lastIndexOf(".");
    const base = dot > 0 ? image.filename.slice(0, dot) : image.filename;
    const ext = dot > 0 ? image.filename.slice(dot) : "";
    const count = counts.get(image.filename) ?? 0;
    counts.set(image.filename, count + 1);
    return count === 0 ? image : { ...image, filename: `${base}-${count + 1}${ext}` };
  });
}

export function parseImages(value: unknown): ImagePayload[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Invalid image payload.");
  if (value.length > MAX_IMAGES) throw new Error(`Image upload is limited to ${MAX_IMAGES} files.`);

  const images = value.map((item): ImagePayload => {
    if (!item || typeof item !== "object") throw new Error("Invalid image payload.");
    const record = item as Partial<ImageUpload>;
    if (typeof record.src !== "string" || typeof record.name !== "string" || typeof record.type !== "string" || typeof record.data !== "string" || typeof record.size !== "number") {
      throw new Error("Invalid image payload.");
    }
    if (!(record.type in IMAGE_TYPES)) throw new Error(`Unsupported image type: ${record.type}`);
    if (record.size <= 0 || record.size > MAX_IMAGE_BYTES) throw new Error("Image file is too large.");
    if (!/^\.\/[A-Za-z0-9._-]+$/.test(record.src)) throw new Error("Invalid image source.");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(record.data)) throw new Error("Invalid image data.");

    const bytes = Buffer.from(record.data, "base64");
    const type = record.type as keyof typeof IMAGE_TYPES;
    if (bytes.length !== record.size || !IMAGE_TYPES[type].magic(bytes)) throw new Error("Image data does not match its declared type.");

    return {
      src: record.src,
      name: record.name,
      size: record.size,
      type,
      data: record.data,
      filename: safeFilename(record.name, type),
    };
  });

  return dedupeFilenames(images);
}

export function rewriteImageSources(body: string, images: ImagePayload[]): { body: string; assets: string[] } {
  let nextBody = body;
  const assets: string[] = [];
  for (const image of images) {
    const assetSrc = `./assets/${image.filename}`;
    assets.push(assetSrc);
    const escaped = image.src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    nextBody = nextBody.replace(new RegExp(`(^src:\\s*)${escaped}(\\s*$)`, "gim"), `$1${assetSrc}$2`);
  }
  return { body: nextBody, assets };
}

export function rewriteFrontmatterImage(frontmatter: PostFrontmatter, images: ImagePayload[]): { frontmatter: PostFrontmatter; assets: string[] } {
  const matched = images.find((image) => image.src === frontmatter.image.trim());
  if (!matched) return { frontmatter, assets: [] };
  const image = `./assets/${matched.filename}`;
  return { frontmatter: { ...frontmatter, image }, assets: [image] };
}

export function imageAssetFilenames(body: string): string[] {
  const filenames = new Set<string>();
  const pattern = /^src:\s*\.\/assets\/([^\s]+)\s*$/gim;
  let match;
  while ((match = pattern.exec(body))) {
    if (/^[A-Za-z0-9._-]+$/.test(match[1])) filenames.add(match[1]);
  }
  return [...filenames];
}

function referencedAssetFilenames(body: string, frontmatterImage = ""): string[] {
  const filenames = new Set(imageAssetFilenames(body));
  const cover = frontmatterImage.match(/^\.\/assets\/([A-Za-z0-9._-]+)$/);
  if (cover) filenames.add(cover[1]);
  return [...filenames];
}

export async function uploadImages(config: ServerConfig, assetRoot: string, images: ImagePayload[], message: string): Promise<void> {
  for (const image of images) {
    const path = `${assetRoot}/${image.filename}`;
    const existing = await readFileOrNull(config, path);
    await writeBase64File(config, path, image.data, message, existing?.sha);
  }
}

export async function copyDraftAssets(config: ServerConfig, editor: EditorState, body: string, frontmatterImage: string, postAssetRoot: string, pendingAssets: string[], message: string): Promise<void> {
  const pending = new Set(pendingAssets);
  const draftAssetRoot = `.admin/drafts/${draftIdForEditor(editor)}/assets`;
  for (const filename of referencedAssetFilenames(body, frontmatterImage)) {
    if (pending.has(`./assets/${filename}`)) continue;
    const sourcePath = `${draftAssetRoot}/${filename}`;
    const targetPath = `${postAssetRoot}/${filename}`;
    const existing = await readFileOrNull(config, targetPath);
    if (existing) continue;
    const source = await readBase64File(config, sourcePath).catch((caught) => {
      if (caught instanceof Error && caught.message.startsWith("GitHub 404:")) return null;
      throw caught;
    });
    if (!source) throw new Error(`Missing draft image asset: ${filename}`);
    await writeBase64File(config, targetPath, source.content, message);
  }
}
