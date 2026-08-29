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
  await expect(main.getByText('400+', { exact: true })).toBeVisible();
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

  await page.getByRole('searchbox', { name: 'Search products' }).fill('Wireless Carplay');

  await expect(page.getByRole('heading', { name: '1 product' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wireless Carplay Adapter' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Product pages' })).toHaveCount(0);
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

test('vehicle-specific discovery never crosses into another make or model', async ({ page }) => {
  await page.goto('/-bmw-f-series-oem-ambient-package');

  const discovery = page.locator('.product-discovery');
  await expect(discovery).toContainText('6 compatible upgrades and services');
  await expect(discovery.getByText(/Golf|Audi|Mercedes|A-Class|CLA|GLA/i)).toHaveCount(0);

  await page.goto('/mercedes-c-class-oem-ambient-lighting');
  const cClassDiscovery = page.locator('.product-discovery');
  for (const incompatibleSlug of [
    '-bmw-f-series-oem-ambient-package',
    'car-interior-ambient-light-kit-golf-mk7-mk75-2012-2019',
    'car-interior-ambient-led-light-kit-audi-q3-2018-current',
    'full-oem-ambient-lighting-upgrade-a-class',
    'full-oem-ambient-lighting-upgrade-a-class1',
  ]) {
    await expect(cClassDiscovery.locator(`a[href="/${incompatibleSlug}"]`)).toHaveCount(0);
  }
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

test('vehicle-specific catalogue media and gallery groups match their labels', async ({ page }) => {
  await page.goto('/mercedes-c-class-oem-ambient-lighting');

  await expect(page.getByRole('heading', { name: 'Mercedes C-Class W205/C205 OEM Ambient Lighting' })).toBeVisible();
  await expect(page.getByText(/W205 saloon or C205 coupé/)).toBeVisible();
  const cClassImages = page.locator('.product-gallery img');
  await expect(cClassImages).toHaveCount(5);
  for (const image of await cClassImages.all()) {
    await expect(image).toHaveAttribute('src', /mercedes-c-class-w205-c205-oem-ambient-lighting-/);
  }

  await page.goto('/gallery');
  for (const [group, prefix] of [
    ['Ambient lighting', 'gallery-ambient-'],
    ['Starlights', 'gallery-stars-'],
    ['Custom steering wheels', 'gallery-steering-'],
    ['Rims & calipers', 'gallery-rims-'],
    ['Screen upgrades', 'gallery-screen-'],
    ['Dashcams', 'gallery-dashcam-'],
  ] as const) {
    const section = page.locator('.gallery-group').filter({ has: page.getByRole('heading', { name: group, exact: true }) });
    for (const image of await section.locator('img').all()) {
      await expect(image).toHaveAttribute('src', new RegExp(prefix));
    }
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
      'gallery-stars-01',
      'gallery-stars-02',
      'gallery-stars-07',
      'gallery-stars-03',
      'gallery-stars-04',
      'gallery-stars-05',
      'gallery-stars-06',
    ],
    'Custom steering wheels': [
      'gallery-steering-01',
      'gallery-steering-02',
      'gallery-steering-03',
    ],
    'Rims & calipers': [
      'gallery-rims-01',
      'gallery-rims-02',
    ],
    'Screen upgrades': [
      'gallery-screen-01',
      'gallery-screen-02',
      'gallery-screen-03',
    ],
    Dashcams: [
      'gallery-dashcam-01',
      'gallery-dashcam-02',
      'gallery-dashcam-03',
      'gallery-dashcam-04',
      'gallery-dashcam-05',
      'gallery-dashcam-06',
      'gallery-dashcam-07',
      'gallery-dashcam-08',
    ],
  } as const;

  for (const [heading, imageNames] of Object.entries(expectedImages)) {
    const group = page.locator('.gallery-group').filter({
      has: page.getByRole('heading', { name: heading, exact: true }),
    });

    await expect(group.locator('img')).toHaveCount(imageNames.length);
    await expect
      .poll(() => group.locator('img').evaluateAll((images) => images.map((image) => image.getAttribute('src'))))
      .toEqual(imageNames.map((imageName) => expect.stringContaining(imageName)));
  }
});

test('third-party embeds remain blocked without marketing consent', async ({ page }) => {
  await page.goto('/featured-collabs');

  await expect(page.getByRole('heading', { name: 'TikTok build videos' })).toBeVisible();
  await expect(page.locator('.tiktok-grid iframe')).toHaveCount(0);
});

test('allowing map content stores marketing consent and loads the embed', async ({ page }) => {
  await page.goto('/contact-us');
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
