import sharp from "sharp";
import type { ServerConfig } from "./config.js";
import { listDirectory, readBase64File, readFileOrNull, writeBase64File, type MultiFileCommitOperation } from "./github.js";
import type { EditorState, ImageUpload, ImageUploadRole, PostFrontmatter } from "./types.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 20;
const IMAGE_TYPES = {
  "image/png": { ext: "png", magic: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { ext: "jpg", magic: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
} satisfies Record<string, { ext: string; magic: (bytes: Buffer) => boolean }>;

type OutputImageType = keyof typeof IMAGE_TYPES | "image/webp";

type ImagePayload = {
  src: string;
  name: string;
  size: number;
  type: OutputImageType;
  data: string;
  filename: string;
  role: ImageUploadRole;
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

function outputExtension(type: OutputImageType): string {
  return type === "image/webp" ? "webp" : IMAGE_TYPES[type].ext;
}

function safeFilename(name: string, type: OutputImageType): string {
  const trimmed = name.trim().toLowerCase();
  const baseName = trimmed.replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
  return `${baseName}.${outputExtension(type)}`;
}

function withExtension(filename: string, type: OutputImageType): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  return `${base}.${outputExtension(type)}`;
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
      role: record.role === "cover" ? "cover" : "content",
    };
  });

  return dedupeFilenames(images);
}

async function optimizeImage(image: ImagePayload): Promise<ImagePayload> {
  const input = Buffer.from(image.data, "base64");
  return image.role === "cover" ? optimizeCoverImage(image, input) : optimizeContentImage(image, input);
}

async function optimizeCoverImage(image: ImagePayload, input: Buffer): Promise<ImagePayload> {
  const output = await sharp(input, { animated: false })
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 84, effort: 6 })
    .toBuffer();
  return {
    ...image,
    type: "image/webp",
    data: output.toString("base64"),
    size: output.length,
    filename: withExtension(image.filename, "image/webp"),
  };
}

async function optimizeContentImage(image: ImagePayload, input: Buffer): Promise<ImagePayload> {
  if (image.type === "image/png") {
    const lossless = await sharp(input, { animated: false })
      .rotate()
      .webp({ lossless: true, effort: 6 })
      .toBuffer();
    if (lossless.length < input.length) {
      return {
        ...image,
        type: "image/webp",
        data: lossless.toString("base64"),
        size: lossless.length,
        filename: withExtension(image.filename, "image/webp"),
      };
    }

    const highQuality = await sharp(input, { animated: false })
      .rotate()
      .resize({ width: 2560, withoutEnlargement: true })
      .webp({ quality: 95, effort: 6 })
      .toBuffer();
    if (highQuality.length < input.length * 0.9) {
      return {
        ...image,
        type: "image/webp",
        data: highQuality.toString("base64"),
        size: highQuality.length,
        filename: withExtension(image.filename, "image/webp"),
      };
    }
    return image;
  }

  const output = await sharp(input, { animated: false })
    .rotate()
    .resize({ width: 2560, withoutEnlargement: true })
    .webp({ quality: 94, effort: 6 })
    .toBuffer();
  if (output.length >= input.length * 0.98) return image;
  return {
    ...image,
    type: "image/webp",
    data: output.toString("base64"),
    size: output.length,
    filename: withExtension(image.filename, "image/webp"),
  };
}

export async function prepareImages(value: unknown): Promise<ImagePayload[]> {
  return Promise.all(parseImages(value).map(optimizeImage));
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

export function imageCommitOperations(assetRoot: string, images: ImagePayload[]): MultiFileCommitOperation[] {
  return images.map((image) => ({
    path: `${assetRoot}/${image.filename}`,
    content: image.data,
    encoding: "base64",
  }));
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

export async function draftAssetCommitOperations(config: ServerConfig, editor: EditorState, body: string, frontmatterImage: string, postAssetRoot: string, pendingAssets: string[]): Promise<MultiFileCommitOperation[]> {
  const pending = new Set(pendingAssets);
  const draftAssetRoot = `.admin/drafts/${draftIdForEditor(editor)}/assets`;
  const operations: MultiFileCommitOperation[] = [];
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
    operations.push({ path: targetPath, content: source.content, encoding: "base64" });
  }
  return operations;
}

export async function deleteDraftAssetOperations(config: ServerConfig, editor: EditorState): Promise<MultiFileCommitOperation[]> {
  const draftAssetRoot = `.admin/drafts/${draftIdForEditor(editor)}/assets`;
  const entries = await listDirectory(config, draftAssetRoot).catch((caught) => {
    if (caught instanceof Error && caught.message.startsWith("GitHub 404:")) return [];
    throw caught;
  });
  return entries
    .filter((entry) => entry.type === "file")
    .map((entry) => ({ path: entry.path, delete: true }));
}
