// Unit tests for the responsive image pipeline (responsive-images.ts, responsive-image-names.ts and
// ResponsiveImage.tsx) against three fixture images: a 1000px JPEG, a 200px PNG with alpha and a
// 120px WebP. Run with `npm run test:unit` (node:test; TypeScript through test/ts-loader.mjs).
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const fixtures = path.join(frontend, 'test', 'fixtures');
const publicDir = path.join(fixtures, 'public');
const plugin = await import(pathToFileURL(path.join(frontend, 'responsive-images.ts')).href);
const names = await import(pathToFileURL(path.join(frontend, 'responsive-image-names.ts')).href);

const JPEG = '/images/products/fixture-kit-01.jpg';
const PNG = '/images/site/fixture-logo.png';
const WEBP = '/images/site/fixture-small.webp';

let scratch;
let cacheDir;
let scan;

before(async () => {
  scratch = await mkdtemp(path.join(os.tmpdir(), 'responsive-images-'));
  cacheDir = path.join(scratch, 'cache');
  scan = await plugin.scanImages(publicDir, await plugin.findReferences([path.join(fixtures, 'src')]));
});

after(async () => {
  await rm(scratch, { recursive: true, force: true });
});

async function webpWidth(data) {
  return (await sharp(data).metadata()).width;
}

describe('widthsFor', () => {
  test('lists the standard widths below the original, then the original width', () => {
    assert.deepEqual(names.widthsFor(1000), [160, 320, 480, 640, 768, 960, 1000]);
    assert.deepEqual(names.widthsFor(3000), [...names.VARIANT_WIDTHS, 3000]);
  });

  test('handles originals at, just above and below the smallest width', () => {
    assert.deepEqual(names.widthsFor(160), [160]);
    assert.deepEqual(names.widthsFor(161), [160, 161]);
    assert.deepEqual(names.widthsFor(120), [120]);
    assert.deepEqual(names.widthsFor(1), [1]);
  });

  test('never repeats a width that equals a standard one', () => {
    assert.deepEqual(names.widthsFor(1280), [160, 320, 480, 640, 768, 960, 1280]);
  });
});

describe('scanImages and findReferences', () => {
  test('reads intrinsic sizes of the referenced images', () => {
    assert.deepEqual(
      [...scan.images.values()].map(({ src, width, height }) => [src, width, height]),
      [
        [JPEG, 1000, 750],
        [PNG, 200, 100],
        [WEBP, 120, 90],
      ],
    );
    assert.deepEqual(scan.orphans, []);
  });

  test('lists unreferenced images as orphans and makes no entry for them', async () => {
    const partial = await plugin.scanImages(publicDir, new Set([JPEG]));
    assert.deepEqual([...partial.images.keys()], [JPEG]);
    assert.deepEqual(partial.orphans, [PNG, WEBP]);
  });

  test('rejects a file name that is not URL- and srcset-safe', async () => {
    const unsafePublic = path.join(scratch, 'unsafe-public');
    await mkdir(path.join(unsafePublic, 'images'), { recursive: true });
    await writeFile(
      path.join(unsafePublic, 'images', 'two words, one comma.jpg'),
      await readFile(path.join(publicDir, JPEG)),
    );
    await assert.rejects(plugin.scanImages(unsafePublic, new Set()), /two words, one comma\.jpg: rename it/);
  });
});

describe('encodeVariant cache', () => {
  const image = () => scan.images.get(JPEG);
  const cachedFiles = async () => (await readdir(cacheDir).catch(() => [])).sort();

  test('a miss encodes a WebP at the width and stores it under its key', async () => {
    await rm(cacheDir, { recursive: true, force: true });
    const output = await plugin.encodeVariant(image(), 320, cacheDir);
    assert.ok(plugin.isValidWebp(output));
    assert.equal(await webpWidth(output), 320);
    const key = plugin.cacheKey(await readFile(image().file), plugin.pipelineFor(JPEG, 320));
    assert.deepEqual(await cachedFiles(), [`${key}.webp`]);
  });

  test('a hit returns the stored bytes without encoding', async () => {
    const key = plugin.cacheKey(await readFile(image().file), plugin.pipelineFor(JPEG, 320));
    // A different valid WebP in the slot proves the result came from the cache.
    const planted = await sharp({ create: { width: 90, height: 90, channels: 3, background: '#123456' } })
      .webp()
      .toBuffer();
    await writeFile(path.join(cacheDir, `${key}.webp`), planted);
    assert.deepEqual(await plugin.encodeVariant(image(), 320, cacheDir), planted);
  });

  test('a corrupt or truncated entry is re-encoded and replaced', async () => {
    const key = plugin.cacheKey(await readFile(image().file), plugin.pipelineFor(JPEG, 320));
    const entry = path.join(cacheDir, `${key}.webp`);
    const good = await plugin.encodeVariant(image(), 480, cacheDir);
    for (const corrupt of [Buffer.from('not a webp at all'), good.subarray(0, good.length - 10), Buffer.alloc(0)]) {
      await writeFile(entry, corrupt);
      const output = await plugin.encodeVariant(image(), 320, cacheDir);
      assert.ok(plugin.isValidWebp(output));
      assert.equal(await webpWidth(output), 320);
      assert.deepEqual(await readFile(entry), output);
    }
    assert.ok((await cachedFiles()).every((file) => !file.endsWith('.tmp')), 'no temporary files left');
  });

  test('errors name the source file', async () => {
    const broken = path.join(scratch, 'broken.jpg');
    await writeFile(broken, 'not a jpeg');
    await assert.rejects(
      plugin.encodeVariant({ src: '/images/broken.jpg', file: broken, width: 1000, height: 750 }, 320, cacheDir),
      (error) => error.message.includes(broken),
    );
  });
});

describe('cacheKey', () => {
  test('changes with every part of the pipeline and with the source bytes', () => {
    const input = Buffer.from('source bytes');
    const base = plugin.pipelineFor(JPEG, 640);
    const key = plugin.cacheKey(input, base);
    assert.equal(plugin.cacheKey(input, plugin.pipelineFor(JPEG, 640)), key, 'stable for equal input');
    const variants = [
      { ...base, cacheVersion: base.cacheVersion + 1 },
      { ...base, sharp: '0.0.0' },
      { ...base, vips: '0.0.0' },
      { ...base, autoOrient: false },
      { ...base, icc: 'srgb' },
      { ...base, resize: { ...base.resize, width: 641 } },
      { ...base, resize: { ...base.resize, withoutEnlargement: false } },
      { ...base, webp: { ...base.webp, quality: 81 } },
      { ...base, webp: { ...base.webp, effort: 4 } },
      plugin.pipelineFor(PNG, 640),
    ];
    for (const pipeline of variants) assert.notEqual(plugin.cacheKey(input, pipeline), key, JSON.stringify(pipeline));
    assert.notEqual(plugin.cacheKey(Buffer.from('other bytes'), base), key);
  });

  test('PNG sources encode near-lossless, photos lossy', () => {
    assert.equal(plugin.pipelineFor(PNG, 160).webp.nearLossless, true);
    assert.equal(plugin.pipelineFor(JPEG, 160).webp.nearLossless, undefined);
  });
});

describe('variant middleware', () => {
  async function request(url) {
    const middleware = plugin.createVariantMiddleware(async () => scan.images, cacheDir);
    return new Promise((resolve, reject) => {
      const headers = {};
      const response = {
        setHeader: (name, value) => {
          headers[name.toLowerCase()] = value;
        },
        end: (body) => resolve({ served: true, headers, body }),
      };
      middleware({ url }, response, (error) => (error ? reject(error) : resolve({ served: false })));
    });
  }

  test('serves listed widths of scanned images', async () => {
    const result = await request(`${JPEG}.320w.webp?v=1`);
    assert.equal(result.served, true);
    assert.equal(result.headers['content-type'], 'image/webp');
    assert.equal(await webpWidth(result.body), 320);
  });

  test('passes on unlisted widths, the WebP original width, unknown and unsafe paths', async () => {
    for (const url of [
      `${JPEG}.321w.webp`,
      `${JPEG}.2000w.webp`,
      `${WEBP}.120w.webp`,
      '/images/products/missing.jpg.320w.webp',
      '/images/../../etc/passwd.320w.webp',
      '/images/%2e%2e/%2e%2e/etc/passwd.320w.webp',
      `/images/products/../products/fixture-kit-01.jpg.320w.webp`,
      `/assets${JPEG}.320w.webp`,
      JPEG,
    ]) {
      assert.deepEqual(await request(url), { served: false }, url);
    }
  });
});

describe('build output and the srcset ResponsiveImage emits', () => {
  let outDir;
  let markup;

  before(async () => {
    outDir = path.join(scratch, 'dist');
    await plugin.writeVariants(scan.images.values(), outDir, cacheDir);
    const generated = fileURLToPath(new URL('./.generated/virtual-responsive-images.mjs', import.meta.url));
    await mkdir(path.dirname(generated), { recursive: true });
    await writeFile(
      generated,
      plugin.virtualModuleSource(scan.images.values(), pathToFileURL(path.join(frontend, 'responsive-image-names.ts')).href),
    );
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { ResponsiveImage } = await import(
      pathToFileURL(path.join(frontend, 'src', 'components', 'ResponsiveImage.tsx')).href
    );
    markup = (props) => renderToStaticMarkup(createElement(ResponsiveImage, props));
  });

  test('every srcset candidate exists on disk at its declared width', async () => {
    for (const src of [JPEG, PNG, WEBP]) {
      const html = markup({ src, alt: '', sizes: '100vw' });
      const srcset = /srcSet="([^"]+)"/i.exec(html)?.[1];
      assert.ok(srcset, html);
      for (const candidate of srcset.split(', ')) {
        const [url, descriptor] = candidate.split(' ');
        const file = path.join(existsSync(path.join(outDir, url)) ? outDir : publicDir, url);
        assert.ok(existsSync(file), `${url} is missing`);
        assert.equal(`${await webpWidth(await readFile(file))}w`, descriptor, url);
      }
    }
  });

  test('a WebP original stands in for its own width; no copy is written', () => {
    assert.match(markup({ src: WEBP, alt: '', sizes: '100vw' }), /srcSet="\/images\/site\/fixture-small\.webp 120w"/);
    assert.equal(existsSync(path.join(outDir, `${WEBP}.120w.webp`)), false);
  });

  test('the fallback <img> keeps the original, intrinsic size and lazy loading', () => {
    const html = markup({ src: JPEG, alt: 'Kit', sizes: '50vw' });
    assert.match(html, /<img src="\/images\/products\/fixture-kit-01\.jpg" width="1000" height="750"/);
    assert.match(html, /alt="Kit"/);
    assert.match(html, /loading="lazy"/);
    assert.match(html, /decoding="async"/);
    assert.doesNotMatch(html, /fetchpriority/i);
  });

  test('priority sets lowercase fetchpriority and eager loading', () => {
    const html = markup({ src: JPEG, alt: '', sizes: '100vw', priority: true });
    assert.match(html, /fetchpriority="high"/);
    assert.match(html, /loading="eager"/);
    assert.doesNotMatch(html, /fetchPriority/);
  });

  test('coverAspect scales sizes for photos wider than their box', () => {
    // 4:3 photo in a square box renders 1.34x wider (rounded up to hundredths).
    assert.match(
      markup({ src: JPEG, alt: '', sizes: '(max-width: 520px) 88px, 130px', coverAspect: 1 }),
      /sizes="\(max-width: 520px\) calc\(\(88px\) \* 1.34\), calc\(\(130px\) \* 1.34\)"/,
    );
    assert.match(markup({ src: JPEG, alt: '', sizes: '130px', coverAspect: 2 }), /sizes="130px"/);
  });

  test('an image without variants renders a plain <img>', () => {
    const html = markup({ src: '/images/elsewhere.jpg', alt: 'x', sizes: '10px' });
    assert.doesNotMatch(html, /<picture|<source/);
    assert.match(html, /<img src="\/images\/elsewhere\.jpg"/);
  });
});
