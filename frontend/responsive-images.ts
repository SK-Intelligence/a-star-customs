// Responsive WebP variants of the photos the storefront uses, made at build time.
//
// The catalogue keeps its canonical JPEG/PNG/WebP paths (and their reviewed SHA-256s in
// scripts/media-review.json). For every image under public/images that src/ or index.html
// references, this plugin writes `<name>.<ext>.<width>w.webp` beside the original in dist (never in
// public/) and serves the same files on demand from the dev server. Unreferenced images get no
// variants and are listed at build time. src/components/ResponsiveImage.tsx turns a canonical path
// into a <picture> whose srcset comes from `virtual:responsive-images` (each image's size and
// widths, and srcSetFor from responsive-image-names.ts).
//
// Encoded files are cached in node_modules/.cache/responsive-images, keyed by the source bytes and
// the whole encoding pipeline, so only new or changed images are re-encoded on later builds.
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { Plugin, ResolvedConfig } from 'vite';
import { isOriginalCandidate, variantUrl, widthsFor, type ImageEntry } from './responsive-image-names.ts';

/** Bump when the encoding changes in a way the pipeline description below does not capture. */
export const CACHE_VERSION = 1;
const WEBP_LOSSY = { quality: 80, effort: 5 } as const;
// Logos and other flat PNG artwork: near-lossless keeps edges and alpha clean.
const WEBP_NEAR_LOSSLESS = { nearLossless: true, quality: 80, effort: 5 } as const;
const SOURCE_PATTERN = /\.(jpe?g|png|webp)$/i;
// Path segments of letters, digits, dot, dash and underscore only: nothing that needs escaping in
// a URL or breaks a srcset list (spaces, commas), and no `..` segment.
const SAFE_PATH = /^\/images(\/[A-Za-z0-9][A-Za-z0-9._-]*)+\.(jpe?g|png|webp)$/i;
const REFERENCE_PATTERN = /\/images\/[A-Za-z0-9._/-]+\.(?:jpe?g|png|webp)/gi;
const REFERENCE_SOURCES = /\.(tsx?|json|css|html)$/;
const VARIANT_PATTERN = /^(\/images\/.+)\.(\d+)w\.webp$/;
const VIRTUAL_ID = 'virtual:responsive-images';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

export interface SourceImage {
  /** URL path, e.g. /images/site/hero.jpg. */
  src: string;
  /** Absolute file path under public/. */
  file: string;
  width: number;
  height: number;
}

export interface ImageScan {
  images: Map<string, SourceImage>;
  /** Images under public/images that nothing references. */
  orphans: string[];
}

function withPath(file: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`responsive images: ${file}: ${message}`, { cause: error });
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : Promise.resolve([entryPath]);
    }),
  );
  return nested.flat();
}

/** Every /images/... path written in the given files or directories (recursively). */
export async function findReferences(roots: readonly string[]): Promise<Set<string>> {
  const files = (
    await Promise.all(
      roots.map(async (root) => (REFERENCE_SOURCES.test(root) ? [root] : listFiles(root))),
    )
  ).flat().filter((file) => REFERENCE_SOURCES.test(file));
  const references = new Set<string>();
  for (const file of files) {
    for (const match of (await readFile(file, 'utf8')).matchAll(REFERENCE_PATTERN)) references.add(match[0]);
  }
  return references;
}

export async function scanImages(publicDir: string, references: ReadonlySet<string>): Promise<ImageScan> {
  const files = (await listFiles(path.join(publicDir, 'images'))).filter((file) => SOURCE_PATTERN.test(file));
  const images = new Map<string, SourceImage>();
  const orphans: string[] = [];
  for (const file of files.sort()) {
    const src = `/${path.relative(publicDir, file).split(path.sep).join('/')}`;
    if (!SAFE_PATH.test(src)) {
      throw new Error(`responsive images: ${file}: rename it to letters, digits, '.', '-' and '_' only`);
    }
    if (!references.has(src)) {
      orphans.push(src);
      continue;
    }
    try {
      const { width, height } = (await sharp(file).metadata()).autoOrient;
      images.set(src, { src, file, width, height });
    } catch (error) {
      throw withPath(file, error);
    }
  }
  return { images, orphans };
}

/** Everything that decides the bytes of one variant; hashed into its cache key. */
export function pipelineFor(src: string, width: number) {
  return {
    cacheVersion: CACHE_VERSION,
    sharp: sharp.versions.sharp,
    vips: sharp.versions.vips,
    autoOrient: true,
    icc: 'keep',
    resize: { width, withoutEnlargement: true },
    webp: /\.png$/i.test(src) ? WEBP_NEAR_LOSSLESS : WEBP_LOSSY,
  };
}

export type Pipeline = ReturnType<typeof pipelineFor>;

export function cacheKey(input: Buffer, pipeline: Pipeline): string {
  return createHash('sha256').update(JSON.stringify(pipeline)).update(input).digest('hex');
}

/** A complete WebP file: RIFF header, WEBP form type, and a RIFF size that matches the length. */
export function isValidWebp(data: Buffer): boolean {
  return (
    data.length > 64 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP' &&
    data.readUInt32LE(4) + 8 === data.length
  );
}

export async function encodeVariant(image: SourceImage, width: number, cacheDir: string): Promise<Buffer> {
  try {
    const input = await readFile(image.file);
    const pipeline = pipelineFor(image.src, width);
    const cached = path.join(cacheDir, `${cacheKey(input, pipeline)}.webp`);
    const hit = await readFile(cached).catch(() => undefined);
    if (hit && isValidWebp(hit)) return hit;

    const output = await sharp(input, { autoOrient: pipeline.autoOrient })
      .resize(pipeline.resize)
      .keepIccProfile()
      .webp(pipeline.webp)
      .toBuffer();
    if (!isValidWebp(output)) throw new Error(`encoder returned an invalid WebP at ${width}w`);
    // Write then rename, so a reader never sees half a file and parallel builds cannot interleave.
    await mkdir(cacheDir, { recursive: true });
    const temporary = `${cached}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, output);
    await rename(temporary, cached).catch(async (error: unknown) => {
      await rm(temporary, { force: true });
      throw error;
    });
    return output;
  } catch (error) {
    throw error instanceof Error && error.message.startsWith('responsive images:') ? error : withPath(image.file, error);
  }
}

/** The variant files to write for one image (a WebP original stands in for its own width). */
export function variantWidths(image: SourceImage): number[] {
  return widthsFor(image.width).filter((width) => !isOriginalCandidate(image.src, width, image.width));
}

export async function writeVariants(
  images: Iterable<SourceImage>,
  outDir: string,
  cacheDir: string,
): Promise<number> {
  const queue = [...images].flatMap((image) => variantWidths(image).map((width) => ({ image, width })));
  const total = queue.length;
  // One libvips thread per lane and one lane per core: all cores busy, none oversubscribed.
  const previousConcurrency = sharp.concurrency();
  sharp.concurrency(1);
  try {
    const lanes = Array.from({ length: Math.max(1, os.availableParallelism()) }, async () => {
      for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
        const target = path.join(outDir, ...variantUrl(job.image.src, job.width).split('/'));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, await encodeVariant(job.image, job.width, cacheDir));
      }
    });
    await Promise.all(lanes);
  } finally {
    sharp.concurrency(previousConcurrency);
  }
  return total;
}

type Next = (error?: unknown) => void;

/** Dev server: serves `<original>.<width>w.webp` only for scanned images and their listed widths. */
export function createVariantMiddleware(getImages: () => Promise<Map<string, SourceImage>>, cacheDir: string) {
  return (request: IncomingMessage, response: ServerResponse, next: Next) => {
    const match = VARIANT_PATTERN.exec(request.url?.split(/[?#]/)[0] ?? '');
    if (!match) return next();
    const [, source = '', widthText = ''] = match;
    const width = Number(widthText);
    getImages()
      .then(async (images) => {
        // The map holds only safe, scanned paths, so `..` or encoded tricks never match.
        const image = images.get(source);
        if (!image || !variantWidths(image).includes(width)) return next();
        const body = await encodeVariant(image, width, cacheDir);
        response.setHeader('Content-Type', 'image/webp');
        response.setHeader('Cache-Control', 'no-cache');
        response.end(body);
      })
      .catch(next);
  };
}

/** Source of `virtual:responsive-images`. */
export function virtualModuleSource(images: Iterable<SourceImage>, namesModule: string): string {
  const entries: Record<string, ImageEntry> = {};
  for (const image of images) entries[image.src] = [image.width, image.height, widthsFor(image.width)];
  return [
    `export { srcSetFor } from ${JSON.stringify(namesModule)};`,
    `export const images = ${JSON.stringify(entries)};`,
  ].join('\n');
}

/** Fails unless sharp loaded a native libvips binding (the WebAssembly fallback is far slower). */
export function assertNativeSharp(): void {
  const loaded = Object.keys(createRequire(import.meta.url).cache);
  const native = loaded.find((file) => file.endsWith('.node') && !/wasm/i.test(file));
  if (!native || loaded.some((file) => /sharp-[a-z0-9-]*wasm32/i.test(file))) {
    throw new Error(
      `responsive images: sharp is using its WebAssembly fallback, not a native binding for ${process.platform}-${process.arch}. ` +
        'Reinstall with optional dependencies (npm ci --include=optional).',
    );
  }
}

export function responsiveImages(): Plugin {
  let config: ResolvedConfig;
  let scanPromise: Promise<ImageScan> | undefined;
  let scannedReferences = new Set<string>();
  const cacheDir = () => path.join(config.root, 'node_modules', '.cache', 'responsive-images');
  const referenceRoots = () => [path.join(config.root, 'src'), path.join(config.root, 'index.html')];
  const scan = () =>
    (scanPromise ??= findReferences(referenceRoots()).then((references) => {
      scannedReferences = references;
      return scanImages(config.publicDir, references);
    }));
  const images = async () => (await scan()).images;

  return {
    name: 'astar-responsive-images',
    configResolved(resolved) {
      config = resolved;
    },
    async buildStart() {
      assertNativeSharp();
      config.logger.info(`responsive images: sharp ${JSON.stringify(sharp.versions)}`);
      const { images: found, orphans } = await scan();
      if (config.command === 'build' && orphans.length > 0) {
        config.logger.warn(
          `responsive images: ${orphans.length} of ${found.size + orphans.length} files under public/images ` +
            'are not referenced by src/ or index.html, so they get no variants (they still ship as-is; ' +
            `ask the client before deleting any):\n  ${orphans.join('\n  ')}`,
        );
      }
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return undefined;
      const namesModule = path.join(config.root, 'responsive-image-names.ts').split(path.sep).join('/');
      return virtualModuleSource((await images()).values(), namesModule);
    },
    configureServer(server) {
      const imagesDir = path.join(config.publicDir, 'images') + path.sep;
      const srcDir = path.join(config.root, 'src') + path.sep;
      // A new, renamed or removed image, or a source edit that changes which images are referenced,
      // rebuilds the list; other edits keep their normal hot update.
      const rescan = async (file: string) => {
        if (!file.startsWith(imagesDir)) {
          if (!file.startsWith(srcDir) || !REFERENCE_SOURCES.test(file)) return;
          const references = await findReferences(referenceRoots());
          const same =
            references.size === scannedReferences.size && [...references].every((src) => scannedReferences.has(src));
          if (same) return;
        }
        scanPromise = undefined;
        const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('all', (_event, file) => {
        rescan(file).catch((error: unknown) => config.logger.error(String(error)));
      });
      server.middlewares.use(createVariantMiddleware(images, cacheDir()));
    },
    async writeBundle() {
      const started = Date.now();
      const found = await images();
      const count = await writeVariants(found.values(), path.resolve(config.root, config.build.outDir), cacheDir());
      config.logger.info(
        `responsive images: ${count} WebP variants of ${found.size} images in ${Date.now() - started} ms`,
      );
    },
  };
}
