import { expect, test, type Page } from '@playwright/test';

const cartStorageKey = 'astar-customs-cart';
const productId = 'prod_01KFVHY3MK70RA36DKE21WFPNM';
const firstVariantId = 'variant_01KFVHY3PGHQ09EW3812HRKBBZ';
const premiumAddOnProductId = 'prod_01KCFRCKR5NV5VGCM7ZTKCZ5DE';
const premiumAddOnVariantId = 'variant_01KCFRCKV84EMEE32KZB4QF9MK';
const paidOrderReference = `asc_${'a'.repeat(32)}`;

async function seedCart(
  page: Page,
  quantity = 1,
  checkoutSnapshots: Array<{
    orderReference: string;
    lines: Array<{ productId: string; variantId: string; quantity: number }>;
  }> = [],
  extraLines: Array<{ productId: string; variantId: string; quantity: number }> = [],
) {
  await page.addInitScript(
    ({ key, product, variant, count, checkoutSnapshots: snapshots, extraLines: additions }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            lines: [
              { productId: product, variantId: variant, quantity: count },
              ...additions,
            ],
            checkoutSnapshots: snapshots,
          },
          version: 0,
        }),
      );
    },
    {
      key: cartStorageKey,
      product: productId,
      variant: firstVariantId,
      count: quantity,
      checkoutSnapshots,
      extraLines,
    },
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

test('homepage uses the original direct service headline', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Car needs an upgrade?',
  );
  await expect(
    page.getByText(
      'Here at A Star Customs, we always provide a 5-star service. Come take a look at what we can do for your car.',
      { exact: true },
    ),
  ).toBeVisible();
});

test('unknown routes render the not-found page', async ({ page }) => {
  await page.goto('/not-a-real-route');

  await expect(page).toHaveTitle(/Page Not Found/);
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page.' })).toBeVisible();
});

test('catalog category query filters the product count', async ({ page }) => {
  await page.goto('/shop?category=DIY');

  await expect(page.getByRole('heading', { name: '11 products' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^DIY 11$/ })).toHaveClass(/is-active/);
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
  await page.getByRole('button', { name: 'Add to bag' }).click();

  const drawer = page.getByRole('dialog', { name: 'Shopping bag' });
  await expect(drawer.getByText('600 Lights')).toBeVisible();
  await expect(drawer.getByText('3', { exact: true })).toBeVisible();
  await expect(drawer.getByText('£284.97')).toBeVisible();

  await drawer.getByRole('button', { name: 'Close shopping bag' }).click();
  await page.getByRole('button', { name: '500 Lights £89.99' }).click();
  await page.getByRole('button', { name: 'Decrease quantity' }).click();
  await page.getByRole('button', { name: 'Decrease quantity' }).click();
  await page.getByRole('button', { name: 'Add to bag' }).click();

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
  await expect(page.getByText(`Order reference: ${paidOrderReference}`)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.lines, cartStorageKey),
    )
    .toEqual([
      { productId, variantId: firstVariantId, quantity: 1 },
      {
        productId: premiumAddOnProductId,
        variantId: premiumAddOnVariantId,
        quantity: 1,
      },
    ]);
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

  await expect(page.getByRole('dialog', { name: 'Mobile navigation menu' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Mobile navigation menu' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused();
});
