import { expect, test, type Page } from '@playwright/test';

const cartStorageKey = 'astar-customs-cart';
const productId = 'prod_01KFVHY3MK70RA36DKE21WFPNM';
const firstVariantId = 'variant_01KFVHY3PGHQ09EW3812HRKBBZ';
const premiumAddOnProductId = 'prod_01KCFRCKR5NV5VGCM7ZTKCZ5DE';
const premiumAddOnVariantId = 'variant_01KCFRCKV84EMEE32KZB4QF9MK';
const paidOrderReference = `asc_${'a'.repeat(32)}`;

type SeedCartLine = {
  productId: string;
  variantId: string;
  quantity: number;
  buildId?: string;
  lineType?: 'standalone' | 'base' | 'addon';
};

type SeedCheckoutSnapshot = {
  orderReference: string;
  lines: SeedCartLine[];
};

async function seedCartState(
  page: Page,
  lines: SeedCartLine[],
  checkoutSnapshots: SeedCheckoutSnapshot[] = [],
) {
  await page.addInitScript(
    ({ key, cartLines, snapshots }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          state: { lines: cartLines, checkoutSnapshots: snapshots },
          version: 0,
        }),
      );
    },
    { key: cartStorageKey, cartLines: lines, snapshots: checkoutSnapshots },
  );
}

async function seedCart(
  page: Page,
  quantity = 1,
  checkoutSnapshots: SeedCheckoutSnapshot[] = [],
  extraLines: SeedCartLine[] = [],
) {
  await seedCartState(
    page,
    [{ productId, variantId: firstVariantId, quantity }, ...extraLines],
    checkoutSnapshots,
  );
}

const primaryRoutes = [
  ['/', /Car Upgrades & Customisation/],
  ['/services', /Automotive Customisation Services/],
  ['/gallery', /Automotive Customisation Gallery/],
  ['/shop', /Shop Automotive Upgrades/],
  ['/custom-kits', /Custom Automotive Kits/],
  ['/featured-collabs', /Featured Collaborations/],
  ['/refund-policy', /Returns, Refunds & Workmanship Warranty/],
  ['/privacy', /Privacy Notice/],
  ['/contact-us', /Contact the Workshop/],
] as const;

for (const [route, title] of primaryRoutes) {
  test(`${route} renders its primary page`, async ({ page }) => {
    await page.goto(route);

    await expect(page).toHaveTitle(title);
    await expect(page.locator('main h1').first()).toBeVisible();
  });
}

test('homepage uses a direct service headline and clear supporting copy', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Car needs an upgrade?',
  );
  await expect(
    page.getByText(
      'Explore professionally fitted upgrades backed by a five-star service from first idea to final handover.',
      { exact: true },
    ),
  ).toBeVisible();
});

test('homepage keeps the original service, gallery and shop routes prominent', async ({ page }) => {
  await page.goto('/');

  const main = page.locator('main');
  await expect(main.getByRole('link', { name: /shop/i }).first()).toHaveAttribute(
    'href',
    '/shop',
  );
  await expect(main.getByRole('link', { name: /services/i }).first()).toHaveAttribute(
    'href',
    '/services',
  );
  await expect(main.getByRole('link', { name: /work|gallery/i }).first()).toHaveAttribute(
    'href',
    '/gallery',
  );
  await expect(main.getByText('1000+', { exact: true })).toBeVisible();
  await expect(main.getByText('Vehicles transformed', { exact: true })).toBeVisible();
  await expect(main.getByText('5', { exact: true })).toBeVisible();
});

test('tablet navigation keeps every destination reachable', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: /^menu$/i }).click();

  const menu = page.getByRole('dialog', { name: 'Mobile navigation menu' });
  const contact = menu.getByRole('link', { name: 'Contact' });
  await contact.scrollIntoViewIfNeeded();
  await expect(contact).toBeInViewport();
  await contact.click();
  await expect(page).toHaveURL(/\/contact-us$/);
});

test('unknown routes render the not-found page', async ({ page }) => {
  await page.goto('/not-a-real-route');

  await expect(page).toHaveTitle(/Page Not Found/);
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page.' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');

  await page.getByRole('link', { name: 'Back home' }).click();
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('catalog category query filters the product count', async ({ page }) => {
  await page.goto('/shop?category=DIY%20kits');

  await expect(page.getByRole('heading', { name: '11 products' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^DIY kits 11$/ })).toHaveClass(/is-active/);
});

test('catalog search resets pagination and narrows results', async ({ page }) => {
  await page.goto('/shop');
  await page.getByRole('button', { name: '2', exact: true }).click();
  await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page).toHaveURL(/page=2/);

  await page.getByRole('searchbox', { name: 'Search products' }).fill('Wireless Carplay');

  await expect(page).toHaveURL(/q=Wireless(?:\+|%20)Carplay/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.getByRole('heading', { name: '1 product' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wireless Carplay Adapter' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Product pages' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Wireless Carplay Adapter', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Back to shop' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to shop' }).click();
  await expect(page).toHaveURL(/q=Wireless(?:\+|%20)Carplay/);
  await expect(page.getByRole('heading', { name: '1 product' })).toBeVisible();
});

test('custom kits contains only DIY products and uses kit-specific hero media', async ({ page }) => {
  await page.goto('/custom-kits');

  await expect(page.getByRole('heading', { name: '11 products' })).toBeVisible();
  await expect(page.locator('.page-hero')).toHaveCSS(
    'background-image',
    /starlight-fiber-optic-kit-01\.jpg/,
  );

  await page.getByRole('heading', { name: 'Universal Starlight Fiber Optic Kit (Standard)', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Back to custom kits' })).toBeVisible();
});

test('multi-variant selection and quantity create distinct trusted cart lines', async ({ page }) => {
  await page.goto('/starlight-fiber-optic-kit');
  await page.getByRole('button', { name: '600 Lights £94.99' }).click();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.locator('.product-buybox .buy-actions').getByRole('button', { name: 'Add to bag' }).click();

  const drawer = page.getByRole('dialog', { name: 'Shopping bag' });
  await expect(drawer.getByText('600 Lights')).toBeVisible();
  await expect(drawer.getByText('3', { exact: true })).toBeVisible();
  await expect(drawer.getByText('£284.97')).toBeVisible();

  await drawer.getByRole('button', { name: 'Close shopping bag' }).click();
  await page.getByRole('button', { name: '500 Lights £89.99' }).click();
  await page.getByRole('button', { name: 'Decrease quantity' }).click();
  await page.getByRole('button', { name: 'Decrease quantity' }).click();
  await page.locator('.product-buybox .buy-actions').getByRole('button', { name: 'Add to bag' }).click();

  await expect(drawer.locator('.cart-line')).toHaveCount(2);
  await expect(drawer.getByText('500 Lights')).toBeVisible();
  await expect(drawer.getByText('£374.96', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open shopping bag with 4 items' })).toBeVisible();
});

test('optional extras update the build total and remain removable cart lines', async ({ page }) => {
  await page.goto('/luxury-car-interior');

  await expect(page.locator('.whatsapp-button')).toBeHidden();
  const speakerLights = page.getByRole('button', { name: /4x Speaker Lights.*£39\.99/ });
  const premiumPack = page.getByRole('button', { name: /Premium Pack.*£49\.99/ });
  await expect(speakerLights).toHaveAttribute('aria-pressed', 'false');
  await speakerLights.click();
  await premiumPack.click();

  await expect(speakerLights).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('£464.97', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add build to bag · £464.97' }).click();

  const drawer = page.getByRole('dialog', { name: 'Shopping bag' });
  await expect(drawer.locator('.cart-line')).toHaveCount(3);
  await expect(drawer.getByText('£464.97', { exact: true })).toBeVisible();
  await drawer
    .getByRole('button', { name: /Remove Premium Pack.*from bag/ })
    .click();
  await expect(drawer.locator('.cart-line')).toHaveCount(2);
  await expect(drawer.getByText('£414.98', { exact: true })).toBeVisible();

  await drawer.getByRole('button', { name: 'Close shopping bag' }).click();
  // On a phone the bubble stays hidden behind the unanswered cookie banner; answer it first.
  await page.getByRole('button', { name: 'Essentials only' }).click();
  await page.locator('.review-panel').scrollIntoViewIfNeeded();
  await expect(page.locator('.whatsapp-button')).toBeVisible();
});

test('optional extras appear only on compatible product families', async ({ page }) => {
  await page.goto('/standard-starlight-500-pieces');

  await expect(page.getByRole('heading', { name: 'Personalise your package' })).toHaveCount(0);
  await expect(page.getByText('Higher-spec option')).toHaveCount(0);

  await page.goto('/dashcams-');
  await expect(page.getByRole('heading', { name: 'Personalise your package' })).toHaveCount(0);

  await page.goto('/luxury-car-interior');
  await expect(page.getByRole('heading', { name: 'Optional add-ons' })).toBeVisible();
  await expect(page.getByRole('button', { name: /4x Speaker Lights.*£39\.99/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add build to bag/ })).toBeVisible();
});

const cClassAddOnPrices = [
  ['Dashboard', '£179.99'],
  ['AMG Dashboard', '£219.99'],
  ['Front vents', '£199.99'],
  ['Front and rear vents', '£219.99'],
  ['3D speakers (front)', '£199.99'],
  ['Speaker light covers (all doors)', '£99.99'],
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cClassExtra(page: Page, label: string) {
  return page
    .locator('.build-extras')
    .getByRole('button', { name: new RegExp(`^Optional extra ${escapeRegExp(label)} `) });
}

test('C-Class builder offers its own price list with one choice per exclusive pair', async ({ page }) => {
  await page.goto('/mercedes-c-class-oem-ambient-lighting');

  const extras = page.locator('.build-extras');
  await expect(page.locator('.product-buybox__price')).toHaveText('£399.99');
  await expect(extras.getByText('6 options')).toBeVisible();
  await expect(extras.locator('.build-extra')).toHaveCount(6);
  for (const [label, price] of cClassAddOnPrices) {
    await expect(cClassExtra(page, label)).toContainText(`+${price} per build`);
  }
  await expect(extras.getByRole('button', { name: /4x Speaker Lights|Premium Pack/ })).toHaveCount(0);

  await cClassExtra(page, 'Dashboard').click();
  await cClassExtra(page, 'AMG Dashboard').click();
  await expect(cClassExtra(page, 'AMG Dashboard')).toHaveAttribute('aria-pressed', 'true');
  await expect(cClassExtra(page, 'Dashboard')).toHaveAttribute('aria-pressed', 'false');

  await cClassExtra(page, 'Front vents').click();
  await cClassExtra(page, 'Front and rear vents').click();
  await expect(cClassExtra(page, 'Front and rear vents')).toHaveAttribute('aria-pressed', 'true');
  await expect(cClassExtra(page, 'Front vents')).toHaveAttribute('aria-pressed', 'false');

  await cClassExtra(page, '3D speakers (front)').click();
  await cClassExtra(page, 'Speaker light covers (all doors)').click();
  await expect(page.locator('.build-total')).toContainText('Extras (4)');
  await page.getByRole('button', { name: 'Add build to bag · £1,139.95' }).click();

  const drawer = page.getByRole('dialog', { name: 'Shopping bag' });
  await expect(drawer.locator('.cart-line')).toHaveCount(5);
});

test('checkout swaps exclusive C-Class add-ons instead of stacking both', async ({ page }) => {
  await page.goto('/mercedes-c-class-oem-ambient-lighting');
  await cClassExtra(page, 'Dashboard').click();
  await page.getByRole('button', { name: /Add build to bag/ }).click();
  await page.getByRole('dialog', { name: 'Shopping bag' }).getByRole('link', { name: /Review & checkout/ }).click();

  const extras = page.getByRole('region', { name: /Add-ons for Mercedes C-Class/ });
  const dashboard = extras.getByRole('button', { name: /^Dashboard / });
  const amgDashboard = extras.getByRole('button', { name: /^AMG Dashboard / });
  await expect(extras.getByRole('button')).toHaveCount(6);
  await expect(dashboard).toHaveAttribute('aria-pressed', 'true');
  await amgDashboard.click();
  await expect(amgDashboard).toHaveAttribute('aria-pressed', 'true');
  await expect(dashboard).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.checkout-build-line--addon')).toHaveCount(1);
  await expect(page.locator('.checkout-build-line--addon')).toContainText('AMG Dashboard');
});

test('a saved bag drops add-ons that no longer apply and checks out without a build review', async ({ page }) => {
  const buildId = 'saved-c-class-build';
  await seedCartState(page, [
    {
      productId: 'prod_01KS68E0X8NM8FT2FXN6S0YXCF',
      variantId: 'variant_01KS68E0Z7ZWA7WJVATE0RXWHR',
      quantity: 1,
      buildId,
      lineType: 'base',
    },
    // Family-wide add-on the C-Class used to offer.
    {
      productId: 'prod_01KCFR1PBNK4HHMX64NN0BPCCK',
      variantId: 'variant_01KCFR1PF6SSFRX0GSDM2FDNDH',
      quantity: 1,
      buildId,
      lineType: 'addon',
    },
    // Dashboard and AMG Dashboard share an exclusive group; the first one stays.
    {
      productId: 'prod_01M43GJ28Z7ED1SAW9MYAME13D',
      variantId: 'variant_01M43GJ28ZTRKDR1ANEY1KMZCA',
      quantity: 1,
      buildId,
      lineType: 'addon',
    },
    {
      productId: 'prod_01M43GJ290B3KS8X3C92SV2CMZ',
      variantId: 'variant_01M43GJ2908X81YFQ7VCZDN349',
      quantity: 1,
      buildId,
      lineType: 'addon',
    },
    // Add-on whose base line is gone.
    {
      productId: premiumAddOnProductId,
      variantId: premiumAddOnVariantId,
      quantity: 1,
      buildId: 'missing-base-build',
      lineType: 'addon',
    },
  ]);
  await page.goto('/checkout');

  const notice = page.locator('.checkout-page').getByRole('status').filter({ hasText: /no longer apply/ });
  await expect(notice).toBeVisible();
  await expect(page.locator('.checkout-build-line--base')).toHaveCount(1);
  await expect(page.locator('.checkout-build-line--addon')).toHaveCount(1);
  await expect(page.locator('.checkout-build-line--addon')).toContainText('Mercedes C-Class Dashboard Lighting');
  await expect(page.locator('.order-summary dl')).toContainText('£579.98');
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.lines?.length, cartStorageKey))
    .toBe(2);

  await page.getByRole('checkbox').check();
  const checkoutResponse = page.waitForResponse('**/api/checkout/session');
  await page.getByRole('button', { name: /Continue to secure payment/ }).click();
  const response = await checkoutResponse;
  expect(response.status()).not.toBe(409);
  expect(response.request().postDataJSON().items).toHaveLength(2);
  await expect(page.getByText(/This build needs a quick review/)).toHaveCount(0);

  await notice.getByRole('button', { name: 'Dismiss' }).click();
  await expect(notice).toHaveCount(0);
});

test('product discovery is a collapsed buybox disclosure beside optional add-ons', async ({ page }) => {
  await page.goto('/luxury-car-interior');

  const buybox = page.locator('.product-buybox');
  const extras = buybox.locator('.build-extras');
  const discovery = buybox.locator('.product-discovery');
  const disclosure = discovery.locator('details');
  const purchaseActions = buybox.locator('.buy-actions');

  await expect(extras.getByRole('heading', { name: 'Optional add-ons' })).toBeVisible();
  await expect(discovery.getByText('If you’re interested')).toBeVisible();
  await expect(disclosure).not.toHaveAttribute('open', '');

  const readingOrder = await buybox.evaluate((element) =>
    Array.from(element.children).map((child) => child.className),
  );
  const extrasIndex = readingOrder.indexOf('build-extras');
  const discoveryIndex = readingOrder.indexOf('product-discovery product-discovery--buybox');
  const purchaseIndex = readingOrder.indexOf('buy-actions');
  expect(extrasIndex).toBeGreaterThanOrEqual(0);
  expect(discoveryIndex).toBeGreaterThan(extrasIndex);
  expect(discoveryIndex).toBeLessThan(purchaseIndex);

  await discovery.locator('summary').click();
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(discovery.locator('.discovery-offer').first()).toBeVisible();
  await expect(purchaseActions.getByRole('button', { name: /Add build to bag/ })).toBeVisible();
});

test('products labelled add-on can only be bought through a base package', async ({ page }) => {
  await page.goto('/-4x-speaker-lights-optional-add-on');

  await expect(
    page.getByRole('heading', { name: 'Add this to a base package.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Add to bag/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Browse base packages' })).toBeVisible();
  await expect(page.getByText('If you’re interested')).toHaveCount(0);

  await page.goto('/shop');
  await page.getByRole('searchbox', { name: 'Search products' }).fill('4x Speaker Lights');
  const productCard = page.getByRole('article').filter({ hasText: '4x Speaker Lights' });
  await expect(productCard.getByRole('button', { name: /Add .* to bag/ })).toHaveCount(0);
  await expect(productCard.getByRole('link', { name: /View add-on details/ })).toBeVisible();
});

test('panoramic lights do not offer ambient-lighting-only extras', async ({ page }) => {
  await page.goto('/panoramic-lights-');

  await expect(page.getByRole('heading', { name: 'Personalise your package' })).toHaveCount(0);
  await expect(page.locator('.product-buybox .buy-actions').getByRole('button', { name: 'Add to bag' })).toBeVisible();
});

test('upgrade listings are directly purchasable and contain no nested upsells', async ({ page }) => {
  await page.goto('/ambient-lighting-upgrade');

  await expect(page.getByRole('heading', { name: 'Ambient Lighting Upgrade Audi 2020+' })).toBeVisible();
  await expect(page.getByText(/Audi models from 2020/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to bag' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Personalise your package' })).toHaveCount(0);
  await expect(page.getByText('If you’re interested')).toHaveCount(0);
  await expect(page.getByText(/GLA is the higher spec/i)).toHaveCount(0);
});

test('vehicle-specific catalogue media matches its label', async ({ page }) => {
  await page.goto('/mercedes-c-class-oem-ambient-lighting');

  await expect(page.getByRole('heading', { name: 'Mercedes C-Class W205/C205 OEM Ambient Lighting' })).toBeVisible();
  await expect(page.getByText(/W205 saloon or C205 coupé/)).toBeVisible();
  const cClassImages = page.locator('.product-gallery img');
  await expect(cClassImages).toHaveCount(5);
  for (const image of await cClassImages.all()) {
    await expect(image).toHaveAttribute('src', /mercedes-c-class-w205-c205-oem-ambient-lighting-/);
  }
});

test('mobile product discovery is collapsed, touch-safe and overflow-free', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/luxury-car-interior');

  const discovery = page.locator('.product-discovery details');
  await expect(discovery).not.toHaveAttribute('open', '');
  await discovery.locator('summary').click();
  await expect(discovery).toHaveAttribute('open', '');
  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  const extraBox = await page.getByRole('button', { name: /4x Speaker Lights.*£39\.99/ }).boundingBox();
  expect(extraBox?.height).toBeGreaterThanOrEqual(44);
});

test('a build keeps add-on quantity synced and supports child or whole-build removal', async ({ page }) => {
  await page.goto('/luxury-car-interior');
  await page.getByRole('button', { name: /4x Speaker Lights.*£39\.99/ }).click();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: /Add build to bag/ }).click();

  const drawer = page.getByRole('dialog', { name: 'Shopping bag' });
  await expect(drawer.getByText('Qty 2 · matches build')).toBeVisible();
  await drawer.getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(drawer.getByText('Qty 1 · matches build')).toBeVisible();

  await drawer.getByRole('button', { name: /Remove.*Speaker Lights.*from bag/ }).click();
  await expect(drawer.locator('.cart-line')).toHaveCount(1);
  await drawer.getByRole('button', { name: 'Close shopping bag' }).click();
  await page.getByRole('button', { name: /Add build to bag/ }).click();
  await expect(drawer.locator('.cart-line--base')).toHaveCount(2);

  await drawer.getByRole('button', { name: /Remove Ambient Lighting.*build from bag/ }).first().click();
  await expect(drawer.locator('.cart-line--base')).toHaveCount(1);
});

test('checkout can add and remove a compatible add-on for one build', async ({ page }) => {
  await page.goto('/luxury-car-interior');
  await page.getByRole('button', { name: /Add build to bag/ }).click();
  await page.getByRole('dialog', { name: 'Shopping bag' }).getByRole('link', { name: /Review & checkout/ }).click();

  const extras = page.getByRole('region', { name: /Add-ons for Ambient Lighting/ });
  const speakerLights = extras.getByRole('button', { name: /4x Speaker Lights/ });
  await expect(speakerLights).toHaveAttribute('aria-pressed', 'false');
  await speakerLights.click();
  await expect(page.locator('.checkout-build-line--addon')).toHaveCount(1);
  await expect(speakerLights).toHaveAttribute('aria-pressed', 'true');
  await speakerLights.click();
  await expect(page.locator('.checkout-build-line--addon')).toHaveCount(0);
  await expect(page.getByLabel('Payment method availability')).toContainText(
    'Stripe shows the methods available for each order.',
  );
});

test('checkout inserts an add-on beside the selected build when identical builds are stacked', async ({ page }) => {
  await page.goto('/luxury-car-interior');
  await page.getByRole('button', { name: /Add build to bag/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Shopping bag' });
  await drawer.getByRole('button', { name: 'Close shopping bag' }).click();
  await page.getByRole('button', { name: /Add build to bag/ }).click();
  await drawer.getByRole('link', { name: /Review & checkout/ }).click();

  const firstBuildExtras = page
    .getByRole('region', { name: /Add-ons for Ambient Lighting/ })
    .first();
  await firstBuildExtras.getByRole('button', { name: /4x Speaker Lights/ }).click();

  await expect
    .poll(() =>
      page.locator('.checkout-build-line').evaluateAll((lines) =>
        lines.map((line) =>
          line.classList.contains('checkout-build-line--addon') ? 'addon' : 'base',
        ),
      ),
    )
    .toEqual(['base', 'addon', 'base']);
});

test('invalid build checkout keeps the cart and asks for review', async ({ page }) => {
  let requestItems: unknown = null;
  await page.route('**/api/checkout/session', async (route) => {
    requestItems = route.request().postDataJSON().items;
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ detail: { code: 'BUILD_INVALID' } }),
    });
  });
  await page.goto('/luxury-car-interior');
  await page.getByRole('button', { name: /4x Speaker Lights.*£39\.99/ }).click();
  await page.getByRole('button', { name: /Add build to bag/ }).click();
  await page.getByRole('dialog', { name: 'Shopping bag' }).getByRole('link', { name: /Review & checkout/ }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Continue to secure payment/ }).click();

  await expect(page.getByText(/This build needs a quick review/)).toBeVisible();
  await expect.poll(() => requestItems).toEqual([
    expect.objectContaining({ lineType: 'base', buildId: expect.any(String) }),
    expect.objectContaining({ lineType: 'addon', buildId: expect.any(String) }),
  ]);
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.lines?.length, cartStorageKey))
    .toBe(2);
});

test('grouped builder actions remain reachable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/luxury-car-interior');

  const speakerLights = page.getByRole('button', { name: /4x Speaker Lights.*£39\.99/ });
  await speakerLights.scrollIntoViewIfNeeded();
  await expect(speakerLights).toBeInViewport();
  await speakerLights.click();
  const addBuild = page.getByRole('button', { name: /Add build to bag/ });
  await addBuild.scrollIntoViewIfNeeded();
  await addBuild.click();

  const drawer = page.getByRole('dialog', { name: 'Shopping bag' });
  const checkout = drawer.getByRole('link', { name: /Review & checkout/ });
  await checkout.scrollIntoViewIfNeeded();
  await expect(checkout).toBeInViewport();
});

test('opening the success route directly does not clear the cart', async ({ page }) => {
  await seedCart(page, 2);
  await page.goto('/checkout/success');

  await expect(page.getByRole('heading', { name: /can.t confirm an order/ })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.lines?.[0]?.quantity, cartStorageKey),
    )
    .toBe(2);
});

test('a verified paid checkout removes only its purchased cart snapshot', async ({ page }) => {
  await seedCart(
    page,
    3,
    [
      {
        orderReference: paidOrderReference,
        lines: [{ productId, variantId: firstVariantId, quantity: 2 }],
      },
    ],
    [
      {
        productId: premiumAddOnProductId,
        variantId: premiumAddOnVariantId,
        quantity: 1,
      },
    ],
  );
  await page.route('**/api/checkout/session/cs_test_paid', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orderReference: paidOrderReference, status: 'paid' }),
    });
  });

  await page.goto('/checkout/success?session_id=cs_test_paid');

  await expect(page.getByRole('heading', { name: 'Thank you — your order is in.' })).toBeVisible();
  await expect(
    page.getByText(
      'We will email you your receipt shortly. Get ready for a 5 star service. The workshop will contact you if compatibility or fitting details need to be confirmed.',
    ),
  ).toBeVisible();
  await expect(page.getByText(`Order reference: ${paidOrderReference}`)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.lines, cartStorageKey),
    )
    .toEqual([
      { productId, variantId: firstVariantId, quantity: 1, lineType: 'standalone' },
      {
        productId: premiumAddOnProductId,
        variantId: premiumAddOnVariantId,
        quantity: 1,
        lineType: 'standalone',
      },
    ]);
});

test('a paid grouped build does not remove an identical product from another build', async ({ page }) => {
  const base = {
    productId: 'prod_01K6GY7W0PTTBFMH5DHF9Z75EN',
    variantId: 'variant_01K6GY7W48DGBZ4D4D9JTD3E54',
  };
  const paidBuildLines: SeedCartLine[] = [
    { ...base, quantity: 1, buildId: 'paid-build', lineType: 'base' },
    {
      productId: premiumAddOnProductId,
      variantId: premiumAddOnVariantId,
      quantity: 1,
      buildId: 'paid-build',
      lineType: 'addon',
    },
  ];
  const retainedBuild: SeedCartLine = {
    ...base,
    quantity: 1,
    buildId: 'retained-build',
    lineType: 'base',
  };
  await seedCartState(
    page,
    [...paidBuildLines, retainedBuild],
    [{ orderReference: paidOrderReference, lines: paidBuildLines }],
  );
  await page.route('**/api/checkout/session/cs_test_grouped_paid', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orderReference: paidOrderReference, status: 'paid' }),
    });
  });

  await page.goto('/checkout/success?session_id=cs_test_grouped_paid');

  await expect(page.getByRole('heading', { name: 'Thank you — your order is in.' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.lines, cartStorageKey),
    )
    .toEqual([retainedBuild]);
});

test('route navigation moves focus to the new page heading', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'astar-cookie-preferences',
      JSON.stringify({ analytics: false, marketing: false }),
    );
  });
  await page.goto('/');
  await page.locator('header').getByRole('link', { name: 'Services' }).click();

  await expect(page.locator('main h1').first()).toBeFocused();
});

test('gallery lightbox supports arrow navigation and Escape', async ({ page }) => {
  await page.goto('/gallery');
  await page.getByRole('button', { name: 'Open Ambient lighting image 1' }).click();

  const dialog = page.getByRole('dialog', { name: /Ambient lighting example 1 image viewer/ });
  await expect(dialog.getByRole('img')).toHaveAttribute('src', /gallery-ambient-01/);
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('img')).toHaveAttribute('src', /gallery-ambient-02/);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('gallery headings only show images from the matching service', async ({ page }) => {
  await page.goto('/gallery');

  const expectedImages = {
    'Ambient lighting': [
      'gallery-ambient-01',
      'gallery-ambient-02',
      'gallery-ambient-03',
    ],
    Starlights: [
      'gallery-stars-03',
      'gallery-stars-04',
      'gallery-stars-05',
      'gallery-stars-06',
      'gallery-stars-07',
    ],
    'Custom steering wheels': [
      'custom-steering-wheels-please-contact-first-01',
      'custom-steering-wheels-please-contact-first-02',
      'custom-steering-wheels-please-contact-first-03',
    ],
    'Rims & calipers': [
      'rims-01',
      'rims-02',
      'rims-04',
      'calipers-01',
      'calipers-02',
      'calipers-04',
    ],
    'Screen upgrades': [
      'screeen-upgrade-01',
      'screeen-upgrade-02',
      'gallery-screen-03',
    ],
    Dashcams: [
      'dashcams-01',
      'dashcams-02',
      'dashcams-03',
      'gallery-dashcam-07',
      'gallery-dashcam-08',
    ],
  } as const;

  for (const [heading, imageNames] of Object.entries(expectedImages)) {
    const group = page.locator('.gallery-group').filter({
      has: page.getByRole('heading', { name: heading, exact: true }),
    });

    await group.scrollIntoViewIfNeeded();
    await expect(group.locator('img')).toHaveCount(imageNames.length);
    await expect
      .poll(() => group.locator('img').evaluateAll((images) => images.map((image) => image.getAttribute('src'))))
      .toEqual(imageNames.map((imageName) => expect.stringContaining(imageName)));
    await expect
      .poll(() => group.locator('img').evaluateAll((images) => images.every((image) => image.naturalWidth > 0)))
      .toBe(true);
  }
});

test('service cards use visually verified images for each service', async ({ page }) => {
  await page.goto('/services');

  const expectedImages = {
    'Ambient lighting': '/images/site/service-ambient.jpg',
    Starlights: '/images/site/gallery-stars-04.webp',
    'Custom steering wheels': '/images/site/service-steering.jpeg',
    'Rims & calipers': '/images/products/rims-01.jpg',
    'Screen upgrades': '/images/site/service-screen.webp',
    Dashcams: '/images/site/service-dashcam.jpg',
  } as const;

  for (const [heading, imagePath] of Object.entries(expectedImages)) {
    const card = page.locator('.service-card').filter({
      has: page.getByRole('heading', { name: heading, exact: true }),
    });
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('img')).toHaveAttribute('src', imagePath);
    await expect.poll(() => card.locator('img').evaluate((image) => image.naturalWidth > 0)).toBe(true);
  }
});

test('TikTok builds appear inside Cars we have worked on before the car cards', async ({ page }) => {
  await page.goto('/featured-collabs');

  const section = page.locator('.collaboration-section');
  await expect(section.getByRole('heading', { name: 'Build videos from the workshop.' })).toBeVisible();
  await expect(page.locator('.social-builds')).toHaveCount(0);
  await expect
    .poll(() =>
      section
        .locator('.collaboration-videos, .collaboration-grid')
        .evaluateAll((elements) => elements.map((element) => element.className)),
    )
    .toEqual(['collaboration-videos', 'collaboration-grid']);

  const expectedCollaborationImages = {
    Avi: '/images/site/gallery-ambient-01.jpeg',
    'Laiba Ali': '/images/site/gallery-stars-06.jpeg',
    MUKS: '/images/site/gallery-ambient-03.jpg',
    'Jad Ajram': '/images/products/screeen-upgrade-01.jpg',
  } as const;

  for (const [name, imagePath] of Object.entries(expectedCollaborationImages)) {
    const card = section.locator('.collaboration-card').filter({
      has: page.getByRole('heading', { name, exact: true }),
    });
    await expect(card.locator('img')).toHaveAttribute('src', imagePath);
  }
});

test('third-party embeds remain blocked without marketing consent', async ({ page }) => {
  await page.goto('/featured-collabs');

  await expect(page.getByRole('heading', { name: 'TikTok build videos' })).toBeVisible();
  await expect(page.locator('.tiktok-grid iframe')).toHaveCount(0);
});

test('allowing TikTok content stores consent and loads all build videos', async ({ page }) => {
  await page.goto('/featured-collabs');
  await page.getByRole('button', { name: 'Allow content' }).click();

  await expect(page.locator('.tiktok-grid iframe')).toHaveCount(3);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('astar-cookie-preferences') ?? '{}').marketing),
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Open cookie preferences' }).click();
  await expect(page.getByRole('checkbox', { name: /Marketing & social media/ })).toBeChecked();
});

test('allowing map content stores marketing consent and loads the embed', async ({ page }) => {
  await page.goto('/contact-us');
  await expect(page.locator('.whatsapp-button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Allow content' }).click();

  await expect(page.getByTitle('A Star Customs workshop map')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('astar-cookie-preferences') ?? '{}').marketing),
    )
    .toBe(true);
});

test('unconfigured contact delivery shows working fallbacks', async ({ page }) => {
  await page.goto('/contact-us');
  await page.getByRole('textbox', { name: 'Name' }).fill('Test Customer');
  await page.getByRole('textbox', { name: 'Email address' }).fill('test@example.com');
  await page
    .getByRole('textbox', { name: 'Car and project details' })
    .fill('BMW 3 Series 2021 ambient lighting installation quote.');
  await page.getByRole('button', { name: 'Send enquiry' }).click();

  await expect(page.getByText(/Online delivery is awaiting its environment key/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'WhatsApp', exact: true })).toBeVisible();
});

test('submitted reviews receive 202 moderation status and stay non-public', async ({ request }) => {
  const response = await request.post(
    `http://127.0.0.1:8001/api/reviews/${productId}`,
    {
      data: {
        name: 'E2E Pending Reviewer',
        rating: 5,
        comment: 'This review should remain pending moderation.',
      },
    },
  );
  expect(response.status()).toBe(202);
  expect(await response.json()).toEqual({ status: 'submitted' });

  const publicResponse = await request.get(
    `http://127.0.0.1:8001/api/reviews/${productId}`,
  );
  expect(publicResponse.status()).toBe(200);
  expect(await publicResponse.json()).not.toEqual(
    expect.objectContaining({
      reviews: expect.arrayContaining([
        expect.objectContaining({ name: 'E2E Pending Reviewer' }),
      ]),
    }),
  );
});

test('mobile navigation opens and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();

  const menu = page.getByRole('dialog', { name: 'Mobile navigation menu' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Home', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused();
});

for (const width of [320, 360, 390, 430]) {
  test(`shop remains usable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/shop');

    await expect
      .poll(() =>
        page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        })),
      )
      .toEqual({ clientWidth: width, scrollWidth: width });
    const firstProductAction = page.locator('.product-card__action').first();
    await firstProductAction.scrollIntoViewIfNeeded();
    await expect(firstProductAction).toBeInViewport();
    const actionBox = await firstProductAction.boundingBox();
    expect(actionBox?.width).toBeGreaterThanOrEqual(44);
    expect(actionBox?.height).toBeGreaterThanOrEqual(44);
  });
}

test('landscape phone navigation keeps every route visible without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'astar-cookie-preferences',
      JSON.stringify({ analytics: false, marketing: false }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();

  const menu = page.getByRole('dialog', { name: 'Mobile navigation menu' });
  for (const name of [
    'Home',
    'Services',
    'Gallery',
    'Shop',
    'Custom kits',
    'Featured collabs',
    'Contact',
  ]) {
    await expect(menu.getByRole('link', { name, exact: true })).toBeInViewport();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
});

test('mobile cart focuses its close control and keeps primary controls touch sized', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/starlight-fiber-optic-kit');

  const increaseQuantity = page.getByRole('button', { name: 'Increase quantity' });
  const productQuantityBox = await increaseQuantity.boundingBox();
  expect(productQuantityBox?.width).toBeGreaterThanOrEqual(44);
  expect(productQuantityBox?.height).toBeGreaterThanOrEqual(44);
  await page.locator('.product-buybox .buy-actions').getByRole('button', { name: 'Add to bag' }).click();

  const drawer = page.getByRole('dialog', { name: 'Shopping bag' });
  const close = drawer.getByRole('button', { name: 'Close shopping bag' });
  await expect(close).toBeFocused();

  for (const control of [
    drawer.getByRole('button', { name: 'Increase quantity' }),
    drawer.getByRole('button', { name: /Remove .* from bag/ }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('mobile checkout opens at the top after leaving a deep product page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'astar-cookie-preferences',
      JSON.stringify({ analytics: false, marketing: false }),
    );
  });
  await page.goto('/luxury-car-interior');
  await page.getByRole('button', { name: /Add build to bag/ }).click();
  await page
    .getByRole('dialog', { name: 'Shopping bag' })
    .getByRole('link', { name: /Review & checkout/ })
    .click();

  await expect(page).toHaveURL(/\/checkout$/);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('heading', { name: 'Review your build.' })).toBeInViewport();
});

test('cookie choices remain fully reachable in short phone landscape', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto('/');

  const banner = page.getByRole('region', { name: 'We use cookies' });
  const box = await banner.boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(320);
  await expect(banner.getByRole('button', { name: 'Essentials only' })).toBeVisible();
});

test('first-visit phone: the bag is usable over the cookie banner, which returns afterwards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/luxury-car-interior');

  const banner = page.getByRole('region', { name: 'We use cookies' });
  await expect(banner).toBeVisible();
  // Compact on a phone: well under a quarter of the screen, with Accept all and Essentials only
  // side by side at the same size and with 44px touch targets.
  const bannerBox = await banner.boundingBox();
  expect(bannerBox?.height ?? Infinity).toBeLessThan(844 * 0.3);
  const acceptBox = await banner.getByRole('button', { name: 'Accept all' }).boundingBox();
  const essentialsBox = await banner.getByRole('button', { name: 'Essentials only' }).boundingBox();
  expect(acceptBox?.y).toBe(essentialsBox?.y);
  expect(acceptBox?.height).toBeGreaterThanOrEqual(44);
  expect(essentialsBox?.height).toBeGreaterThanOrEqual(44);
  expect(acceptBox?.width).toBeCloseTo(essentialsBox?.width ?? 0, 0);

  await page.getByRole("button", { name: /Add (build )?to bag/ }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Shopping bag' });
  const checkout = drawer.getByRole('link', { name: /Review & checkout/ });
  await expect(checkout).toBeVisible();

  // The banner yields while the dialog is open: hidden, inert and not focusable.
  await expect(banner).toBeHidden();
  await expect(drawer.getByRole('button', { name: 'Close shopping bag' })).toBeFocused();

  // The link is genuinely hit-testable: nothing sits above it.
  const topmostIsCheckout = await checkout.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return element.contains(hit);
  });
  expect(topmostIsCheckout).toBe(true);

  // Escape closes the drawer; the banner is back, nothing was stored, and consent is not implied.
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Essentials only' })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('astar-cookie-preferences'))).toBeNull();

  // Reopen and go to checkout without ever dismissing the banner.
  await page.getByRole('button', { name: /Open shopping bag/ }).click();
  await checkout.click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(banner).toBeVisible();
});

test('first-visit phone: choosing Essentials only leaves no skip link or floating control over the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mercedes-c-class-oem-ambient-lighting');

  await page.getByRole('region', { name: 'We use cookies' }).getByRole('button', { name: 'Essentials only' }).click();
  await expect(page.getByRole('region', { name: 'We use cookies' })).toBeHidden();

  // Focus moves to the page content, not the skip link, and the skip link stays off-screen.
  await expect(page.locator('#main-content')).toBeFocused();
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).not.toBeInViewport();

  // No fixed cookie control floats over the page; preferences stay reachable from the footer.
  await expect(page.locator('.cookie-settings-button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open cookie preferences' }).click();
  await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toBeHidden();

  // The skip link still appears for keyboard users.
  await page.reload();
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`cookie banner gives Accept all and Essentials only equal prominence at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const banner = page.getByRole('region', { name: 'We use cookies' });
    const styleOf = (name: string) =>
      banner.getByRole('button', { name }).evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          className: element.className,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          borderWidth: style.borderWidth,
          color: style.color,
          boxShadow: style.boxShadow,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          height: element.getBoundingClientRect().height,
        };
      });

    expect(await styleOf('Essentials only')).toEqual(await styleOf('Accept all'));
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`footer cookie preferences control is really clickable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'astar-cookie-preferences',
        JSON.stringify({ analytics: false, marketing: false }),
      );
    });
    await page.setViewportSize(viewport);
    await page.goto('/');

    const control = page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('button', {
      name: 'Open cookie preferences',
    });
    await control.scrollIntoViewIfNeeded();
    await control.click(); // a real click: fails if the WhatsApp bubble or anything else covers it
    await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toBeVisible();
  });
}

test('cookie banner is compact in short landscape and does not exceed 45% of the height', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');

  const banner = page.getByRole('region', { name: 'We use cookies' });
  const box = await banner.boundingBox();
  expect(box?.height ?? Infinity).toBeLessThan(390 * 0.45);
  for (const name of ['Accept all', 'Essentials only', 'Manage preferences']) {
    const target = await banner.getByRole('button', { name }).boundingBox();
    expect(target?.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('.whatsapp-button')).toBeHidden();
});

test('phone cookie banner is centred and hides the WhatsApp bubble until a choice is made', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const banner = page.getByRole('region', { name: 'We use cookies' });
  const box = await banner.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x ?? 0).toBeCloseTo(390 - ((box?.x ?? 0) + (box?.width ?? 0)), 0);
  await expect(page.locator('.whatsapp-button')).toBeHidden();

  await banner.getByRole('button', { name: 'Essentials only' }).click();
  await expect(page.locator('.whatsapp-button')).toBeVisible();
});

test('the cookie banner is early in the tab order, right after the skip link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Tab');
  // Next stop is inside the banner (its privacy notice link), well before the header and page.
  await expect(page.getByRole('region', { name: 'We use cookies' }).locator(':focus')).toHaveCount(1);
});

async function tabToManagePreferences(page: Page) {
  const manage = page.getByRole('button', { name: 'Manage preferences' });
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Tab');
    if (await manage.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('Manage preferences never received keyboard focus');
}

test('first-visit Manage preferences: Save choices hands focus to the page content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await tabToManagePreferences(page);
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Cookie preferences' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save choices' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#main-content')).toBeFocused();
});

test('first-visit Manage preferences: Escape returns focus to the still-unanswered banner', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await tabToManagePreferences(page);
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Cookie preferences' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const banner = page.getByRole('region', { name: 'We use cookies' });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Manage preferences' })).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('astar-cookie-preferences'))).toBeNull();
});

test('clicking empty space in main focuses it without a ring or scroll jump', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('astar-cookie-preferences', JSON.stringify({ analytics: false, marketing: false }));
  });
  await page.goto('/privacy');
  await page.evaluate(() => window.scrollTo(0, 400));
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.click(8, 500);
  const after = await page.evaluate(() => ({
    scrollY: window.scrollY,
    outline: getComputedStyle(document.getElementById('main-content') as HTMLElement).outlineStyle,
  }));
  expect(after.scrollY).toBe(before);
  expect(after.outline).toBe('none');
});
