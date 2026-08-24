import catalogData from "./catalog.json";
import addOnData from "./add-ons.json";

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

export interface AddOnDefinition {
  id: string;
  status: "active" | "disabled";
  label: string;
  description: string;
  compatibleProductIds: string[];
  productId: string | null;
  variantId: string | null;
}

interface UnavailableProductAddOnOption {
  definition: AddOnDefinition;
  product: Product | null;
  variant: ProductVariant | null;
  isAvailable: false;
}

export interface AvailableProductAddOnOption {
  definition: AddOnDefinition;
  product: Product;
  variant: ProductVariant;
  isAvailable: true;
}

export type ProductAddOnOption =
  | AvailableProductAddOnOption
  | UnavailableProductAddOnOption;

export const products: readonly Product[] = catalogData;

export const productBySlug: ReadonlyMap<string, Product> = new Map(
  products.map((product) => [product.slug, product]),
);

export const addOnDefinitions: readonly AddOnDefinition[] = addOnData as AddOnDefinition[];

export function getActiveAddOnDefinition(product: Product): AddOnDefinition | undefined {
  return addOnDefinitions.find(
    (definition) =>
      definition.status === "active" && definition.productId === product.id,
  );
}

export function getProductAddOnOptions(product: Product): readonly ProductAddOnOption[] {
  return addOnDefinitions
    .filter((definition) => definition.compatibleProductIds.includes(product.id))
    .map((definition): ProductAddOnOption => {
      const addOnProduct = definition.productId
        ? products.find((candidate) => candidate.id === definition.productId) ?? null
        : null;
      const variant =
        addOnProduct && definition.variantId
          ? addOnProduct.variants.find((candidate) => candidate.id === definition.variantId) ?? null
          : null;
      if (
        definition.status === "active" &&
        addOnProduct?.purchasable &&
        addOnProduct.available &&
        variant?.available &&
        variant.price > 0
      ) {
        return { definition, product: addOnProduct, variant, isAvailable: true };
      }
      return {
        definition,
        product: addOnProduct,
        variant,
        isAvailable: false,
      };
    });
}

/** Returns only catalog-backed, currently purchasable extras for a base product. */
export function getProductAddOns(product: Product): readonly Product[] {
  return getProductAddOnOptions(product).flatMap((option) =>
    option.isAvailable ? [option.product] : [],
  );
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
