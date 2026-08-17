import catalogData from "./catalog.json";

export interface ProductVariant {
  id: string;
  title: string;
  /** Price in pence, matching Stripe's integer minor-unit convention. */
  price: number;
  available: boolean;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  ribbonText: string | null;
  descriptionHtml: string;
  images: string[];
  collectionIds: string[];
  collections: string[];
  variants: ProductVariant[];
  purchasable: boolean;
  available: boolean;
  updatedAt: string;
}

export const products: readonly Product[] = catalogData;

export const productBySlug: ReadonlyMap<string, Product> = new Map(
  products.map((product) => [product.slug, product]),
);

const addOnSlugsByProductSlug: Readonly<Record<string, readonly string[]>> = {
  'luxury-car-interior': [
    '-4x-speaker-lights-optional-add-on',
    'premium-pack-add-on-25-animations-and-start-up-effects',
  ],
  'ambient-lighting-package-': [
    '-4x-speaker-lights-optional-add-on',
    'premium-pack-add-on-25-animations-and-start-up-effects',
  ],
};

/** Returns only catalog-backed, currently purchasable extras for a base product. */
export function getProductAddOns(product: Product): readonly Product[] {
  return (addOnSlugsByProductSlug[product.slug] ?? []).flatMap((slug) => {
    const addOn = productBySlug.get(slug);
    return addOn?.purchasable && addOn.available ? [addOn] : [];
  });
}

export const categories: readonly string[] = Array.from(
  new Set(products.flatMap((product) => product.collections)),
).sort((left, right) => left.localeCompare(right));

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

/** Formats an integer price stored in pence as GBP. */
export function formatPrice(priceInPence: number): string {
  return gbpFormatter.format(priceInPence / 100);
}
