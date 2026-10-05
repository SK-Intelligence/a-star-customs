import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The Quality gate's accessibility job (@a11y): axe on the key pages at a phone (390) and a
 * computer (1440) width, as a first-time visitor sees them (cookie banner open). Serious and
 * critical violations fail the build.
 */
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];
const PAGES = ['/', '/mercedes-c-class-oem-ambient-lighting', '/shop', '/contact-us'];

async function expectNoSeriousViolations(
  page: Page,
  path: string,
  prepare?: (page: Page) => Promise<void>,
) {
  for (const size of WIDTHS) {
    await page.setViewportSize(size);
    await page.goto(path);
    await expect(page.locator('main h1').first()).toBeVisible();
    if (prepare) await prepare(page);
    // Measure settled colours, not an element halfway through a transition.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document
                .getAnimations()
                .filter(
                  (animation) =>
                    animation.playState === 'running' &&
                    Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)),
                ).length,
          ),
        { timeout: 10_000 },
      )
      .toBe(0);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = result.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.nodes
            .slice(0, 3)
            .map((node) => `${node.target.join(' ')} ${node.failureSummary ?? ''} ${node.html.slice(0, 120)}`)
            .join(' | ')}`,
      );
    expect(serious, `${path}${prepare ? ' (prepared state)' : ''} at ${size.width}px`).toEqual([]);
  }
}

test.beforeEach(() => {
  test.setTimeout(120_000);
});

test('@a11y storefront pages', async ({ page }) => {
  for (const path of PAGES) await expectNoSeriousViolations(page, path);
});

test('@a11y checkout with an item in the bag', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'astar-customs-cart',
      JSON.stringify({
        state: {
          lines: [
            {
              productId: 'prod_01KFVHY3MK70RA36DKE21WFPNM',
              variantId: 'variant_01KFVHY3PGHQ09EW3812HRKBBZ',
              quantity: 1,
            },
          ],
          checkoutSnapshots: [],
        },
        version: 0,
      }),
    );
  });
  await expectNoSeriousViolations(page, '/checkout');
});

test('@a11y bag drawer showing the removed items notice', async ({ page }) => {
  // The stale saved bag from storefront.spec.ts ("a saved bag drops add-ons that no longer
  // apply"): loading it drops the add-ons and shows RemovedItemsNotice in the drawer.
  const buildId = 'saved-c-class-build';
  await page.addInitScript((lines) => {
    window.localStorage.setItem(
      'astar-customs-cart',
      JSON.stringify({ state: { lines, checkoutSnapshots: [] }, version: 0 }),
    );
  }, [
    { productId: 'prod_01KS68E0X8NM8FT2FXN6S0YXCF', variantId: 'variant_01KS68E0Z7ZWA7WJVATE0RXWHR', quantity: 1, buildId, lineType: 'base' },
    { productId: 'prod_01KCFR1PBNK4HHMX64NN0BPCCK', variantId: 'variant_01KCFR1PF6SSFRX0GSDM2FDNDH', quantity: 1, buildId, lineType: 'addon' },
    { productId: 'prod_01M43GJ28Z7ED1SAW9MYAME13D', variantId: 'variant_01M43GJ28ZTRKDR1ANEY1KMZCA', quantity: 1, buildId, lineType: 'addon' },
    { productId: 'prod_01M43GJ290B3KS8X3C92SV2CMZ', variantId: 'variant_01M43GJ2908X81YFQ7VCZDN349', quantity: 1, buildId, lineType: 'addon' },
    { productId: 'prod_01KCFRCKR5NV5VGCM7ZTKCZ5DE', variantId: 'variant_01KCFRCKV84EMEE32KZB4QF9MK', quantity: 1, buildId: 'missing-base-build', lineType: 'addon' },
  ]);
  await expectNoSeriousViolations(page, '/', async (current) => {
    await current.getByRole('button', { name: /Open shopping bag/ }).click();
    const drawer = current.getByRole('dialog', { name: 'Shopping bag' });
    await expect(drawer.getByRole('status').filter({ hasText: /no longer available/ })).toBeVisible();
  });
});
