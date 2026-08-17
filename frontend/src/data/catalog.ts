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
