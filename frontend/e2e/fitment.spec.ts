import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createServer } from 'vite';

// Parity between the storefront's fitment logic and a parity copy of the rule kept here, and
// between those functions and what a product page actually renders. The parity copy only
// proves catalog.ts still implements the stated rule; the hard-coded intent cases below
// ("the audited cross-model suggestions stay gone") pin what the rule must mean. The catalogue
// check (scripts/check_catalog_sync.py) holds the same rule for the build; see its `covers`.
//
// Model years are not compared anywhere: the catalogue has no year field yet (it waits for the
// client's fitment data), so a 2012-2020 kit and a 2021+ kit for the same model/chassis count
// as fitting each other.

type Fitment = {
  mode: 'universal' | 'specific' | 'confirm';
  makes: string[];
  models: string[];
  chassisCodes: string[];
};
type Variant = { id: string; price: number; available: boolean };
type Product = {
  id: string;
  slug: string;
  kind: 'main' | 'addon' | 'upgrade';
  family: string;
  purchasable: boolean;
  available: boolean;
  variants: Variant[];
  fitment: Fitment;
};
type AddOnOption = {
  definition: { id: string; label: string };
  product: Product | null;
  isAvailable: boolean;
};
type CatalogModule = {
  products: readonly Product[];
  getDiscoveryProducts: (product: Product) => readonly Product[];
  getProductAddOnOptions: (product: Product) => readonly AddOnOption[];
};

const frontendRoot = path.resolve(import.meta.dirname, '..');
const catalogJson = JSON.parse(
  readFileSync(path.join(frontendRoot, 'src/data/catalog.json'), 'utf-8'),
) as Product[];
const approvedGenericAddOns = new Set(
  (
    JSON.parse(
      readFileSync(path.join(frontendRoot, '../scripts/generic-add-on-approvals.json'), 'utf-8'),
    ) as { addOnId: string; baseSlug: string }[]
  ).map((entry) => `${entry.addOnId} on ${entry.baseSlug}`),
);
const purchasableSlugs = catalogJson
  .filter((product) => product.purchasable && product.available)
  .map((product) => product.slug);

/** The real frontend/src/data/catalog.ts, JSON imports included, compiled by Vite. */
async function loadCatalogModule(): Promise<CatalogModule> {
  const server = await createServer({
    root: frontendRoot,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    return (await server.ssrLoadModule('/src/data/catalog.ts')) as unknown as CatalogModule;
  } finally {
    await server.close();
  }
}

// The parity copy: written from the rule, not from catalog.ts. A candidate fits a page when it is
// universal, or confirm-first with no make, or it lists every make and model of the page and,
// if it lists chassis codes, every chassis code of the page.
const lower = (values: string[]) => values.map((value) => value.trim().toLowerCase());
const includesAll = (outer: string[], inner: string[]) =>
  lower(inner).every((value) => lower(outer).includes(value));

function parityCovers(page: Product, candidate: Product): boolean {
  const pageFit = page.fitment;
  const fit = candidate.fitment;
  if (fit.mode === 'universal') return true;
  if (fit.mode === 'confirm' && fit.makes.length === 0) return true;
  if (pageFit.makes.length === 0 || !includesAll(fit.makes, pageFit.makes)) return false;
  if (fit.models.length === 0) return pageFit.models.length === 0;
  if (pageFit.models.length === 0 || !includesAll(fit.models, pageFit.models)) return false;
  if (fit.chassisCodes.length === 0) return true;
  return pageFit.chassisCodes.length > 0 && includesAll(fit.chassisCodes, pageFit.chassisCodes);
}

function parityDiscovery(page: Product, catalog: readonly Product[]): string[] {
  if (page.kind !== 'main') return [];
  const eligible = catalog.filter(
    (candidate) =>
      candidate.id !== page.id &&
      candidate.kind !== 'addon' &&
      candidate.purchasable &&
      candidate.available &&
      parityCovers(page, candidate),
  );
  const families = new Set<string>();
  const onePerFamily = eligible.filter(
    (candidate) =>
      candidate.kind === 'main' && !families.has(candidate.family) && families.add(candidate.family),
  );
  return [...eligible.filter((candidate) => candidate.kind === 'upgrade'), ...onePerFamily]
    .slice(0, 6)
    .map((candidate) => candidate.slug);
}

test.describe('fitment parity', () => {
  let catalog: CatalogModule;

  test.beforeAll(async () => {
    catalog = await loadCatalogModule();
  });

  test('discovery and add-ons fit every vehicle of their page', async () => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'No browser involved; once is enough.');
    expect(catalog.products.length).toBe(catalogJson.length);

    for (const page of catalog.products) {
      const discovery = catalog.getDiscoveryProducts(page);
      for (const offer of discovery) {
        expect(parityCovers(page, offer), `${offer.slug} offered on ${page.slug}`).toBe(true);
      }
      expect(
        discovery.map((offer) => offer.slug),
        `discovery list for ${page.slug}`,
      ).toEqual(parityDiscovery(page, catalog.products));

      for (const option of catalog.getProductAddOnOptions(page)) {
        if (!option.isAvailable || !option.product) continue;
        const addOn = option.product;
        const pair = `${option.definition.id} on ${page.slug}`;
        if (addOn.fitment.makes.length > 0) {
          expect(parityCovers(page, addOn), pair).toBe(true);
        } else if (addOn.fitment.mode === 'confirm' && page.fitment.makes.length > 0) {
          expect(approvedGenericAddOns.has(pair), `${pair} needs an approval`).toBe(true);
        } else {
          expect(parityCovers(page, addOn), pair).toBe(true);
        }
      }
    }
  });

  test('the audited cross-model suggestions stay gone', async () => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'No browser involved; once is enough.');
    const bySlug = new Map(catalog.products.map((product) => [product.slug, product]));
    const discoverySlugs = (slug: string) =>
      catalog.getDiscoveryProducts(bySlug.get(slug)!).map((offer) => offer.slug);
    const leaks: [string, string][] = [
      ['dual-car-air-vent-ambient-light-kit', 'full-oem-ambient-lighting-upgrade-a-class1'],
      ['dual-car-air-vent-ambient-light-kit', 'car-speaker-cover-set-tweeters-cla-a-gla'],
      ['mercedes-benz-led-air-vent-kit-vents-for-c-classclagla-2012-2026-front', 'full-oem-ambient-lighting-upgrade-a-class1'],
      ['mercedes-benz-led-air-vent-kit-vents-for-c-classclagla-2012-2026-front', 'car-speaker-cover-set-tweeters-cla-a-gla'],
      ['car-speaker-cover-set-tweeters-cla-a-gla', 'dual-car-air-vent-ambient-light-kit'],
      ['car-ambient-interior-led-light-kit-aclagla-2018-2026', 'dual-car-air-vent-ambient-light-kit'],
      ['car-interior-ambient-led-light-kit-audi-q3-2018-current', 'ambient-lighting-upgrade'],
      ['car-interior-ambient-led-lighting-kit-audi-8y-2012-2020', 'ambient-lighting-upgrade'],
      ['multi-color-ambient-car-interior-led-kit-audi-8y-2012-2020', 'ambient-lighting-upgrade'],
    ];
    for (const [page, offer] of leaks) {
      expect(discoverySlugs(page), `${offer} on ${page}`).not.toContain(offer);
    }
    // A wider listing that covers every vehicle of the page is still offered.
    expect(discoverySlugs('car-led-ambient-light-kit-cla-gla-2018-2026')).toContain(
      'full-oem-ambient-lighting-upgrade-a-class1',
    );
  });

  for (const slug of purchasableSlugs) {
    test(`product page renders exactly the fitment-checked offers: ${slug}`, async ({ page }) => {
      const product = catalog.products.find((candidate) => candidate.slug === slug)!;
      const expectedOffers = catalog
        .getDiscoveryProducts(product)
        .map((offer) => `/${offer.slug}`);
      const canBuy = product.kind !== 'addon' && product.variants[0].available;
      const expectedExtras = canBuy
        ? catalog
            .getProductAddOnOptions(product)
            .filter((option) => option.isAvailable)
            .map((option) => option.definition.label)
        : [];

      await page.goto(`/${slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const renderedOffers = await page
        .locator('.discovery-offer')
        .evaluateAll((offers) =>
          offers.map((offer) => offer.querySelector('a[href]')?.getAttribute('href') ?? ''),
        );
      expect(renderedOffers).toEqual(expectedOffers);
      expect(await page.locator('.build-extra strong').allTextContents()).toEqual(expectedExtras);
    });
  }
});
