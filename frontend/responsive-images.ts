// Responsive WebP variants of every raster image under public/images, made at build time.
//
// The catalogue keeps its canonical JPEG/PNG/WebP paths (and their reviewed SHA-256s in
// scripts/media-review.json). This plugin writes `<name>.<ext>.<width>w.webp` beside each original in
// dist (never in public/), and serves the same files on demand from the dev server.
// src/components/ResponsiveImage.tsx turns a canonical path into a <picture> whose WebP srcset
// uses these names, with the original as the fallback <img>. Both sides derive the widths from
// `variantWidths` and the original's width, which the `virtual:responsive-images` module exports.
//
// Encoded files are cached in node_modules/.cache/responsive-images, keyed by the source bytes
// and the encoder settings, so only new or changed images are re-encoded on later builds.
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { Plugin, ResolvedConfig } from 'vite';

const VARIANT_WIDTHS = [160, 320, 480, 640, 768, 960, 1280];
const WEBP_OPTIONS = { quality: 80, effort: 5 } as const;
const SOURCE_PATTERN = /\.(jpe?g|png|webp)$/i;
const VARIANT_PATTERN = /^(\/images\/.+)\.(\d+)w\.webp$/;
const VIRTUAL_ID = 'virtual:responsive-images';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

interface SourceImage {
  /** Absolute file path under public/. */
  file: string;
  width: number;
  height: number;
}

/** Widths encoded for one image: every standard width below its own, then its own width. */
function widthsFor(width: number): number[] {
  return [...VARIANT_WIDTHS.filter((candidate) => candidate < width), width];
}

/** `/images/a/b.jpg` -> `/images/a/b.jpg.640w.webp`: the original's extension keeps names unique. */
function variantUrl(src: string, width: number): string {
  return `${src}.${width}w.webp`;
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

async function scanImages(publicDir: string): Promise<Map<string, SourceImage>> {
  const files = (await listFiles(path.join(publicDir, 'images'))).filter((file) => SOURCE_PATTERN.test(file));
  const images = new Map<string, SourceImage>();
  for (const file of files.sort()) {
    const metadata = await sharp(file).metadata();
    const { width, height } = metadata.autoOrient;
    const src = `/${path.relative(publicDir, file).split(path.sep).join('/')}`;
    images.set(src, { file, width, height });
  }
  return images;
}

async function encodeVariant(source: SourceImage, width: number, cacheDir: string): Promise<Buffer> {
  const input = await readFile(source.file);
  // A WebP original at its own width is already the best full-size candidate: no re-encode.
  if (width === source.width && source.file.toLowerCase().endsWith('.webp')) return input;
  const key = createHash('sha256')
    .update(input)
    .update(JSON.stringify({ width, WEBP_OPTIONS, sharp: sharp.versions.sharp }))
    .digest('hex');
  const cached = path.join(cacheDir, `${key}.webp`);
  try {
    return await readFile(cached);
  } catch {
    // Not encoded yet.
  }
  const output = await sharp(input, { autoOrient: true })
    .resize({ width, withoutEnlargement: true })
    .keepIccProfile()
    .webp(WEBP_OPTIONS)
    .toBuffer();
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cached, output);
  return output;
}

async function runPool<T>(items: readonly T[], worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const lanes = Array.from({ length: Math.max(1, os.availableParallelism()) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await worker(item);
  });
  await Promise.all(lanes);
}

export function responsiveImages(): Plugin {
  let config: ResolvedConfig;
  let imagesPromise: Promise<Map<string, SourceImage>> | undefined;
  const cacheDir = () => path.join(config.root, 'node_modules', '.cache', 'responsive-images');
  const images = () => (imagesPromise ??= scanImages(config.publicDir));

  return {
    name: 'astar-responsive-images',
    configResolved(resolved) {
      config = resolved;
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return undefined;
      const sizes = Object.fromEntries(
        [...(await images())].map(([src, image]) => [src, [image.width, image.height]]),
      );
      return [
        `export const variantWidths = ${JSON.stringify(VARIANT_WIDTHS)};`,
        `export const imageSizes = ${JSON.stringify(sizes)};`,
      ].join('\n');
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const match = VARIANT_PATTERN.exec(request.url?.split('?')[0] ?? '');
        if (!match) return next();
        const [, source = '', widthText] = match;
        const width = Number(widthText);
        images()
          .then(async (all) => {
            const image = all.get(source);
            if (!image || !widthsFor(image.width).includes(width)) return next();
            const body = await encodeVariant(image, width, cacheDir());
            response.setHeader('Content-Type', 'image/webp');
            response.setHeader('Cache-Control', 'no-cache');
            response.end(body);
          })
          .catch(next);
      });
    },
    async writeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir);
      const jobs = [...(await images())].flatMap(([src, image]) =>
        widthsFor(image.width).map((width) => ({ src, image, width })),
      );
      const started = Date.now();
      await runPool(jobs, async ({ src, image, width }) => {
        const target = path.join(outDir, ...variantUrl(src, width).split('/'));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, await encodeVariant(image, width, cacheDir()));
      });
      config.logger.info(
        `responsive images: ${jobs.length} WebP variants of ${(await images()).size} images in ${Date.now() - started} ms`,
      );
    },
  };
}
