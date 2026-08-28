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
  kind: ProductKind;
  family: ProductFamily;
  fitment: ProductFitment;
  comparisonGroup: string | null;
  specTier: number | null;
  mediaKey: string;
}

export type ProductKind = "main" | "addon" | "upgrade";

export interface ProductFitment {
  mode: "universal" | "specific" | "confirm";
  label: string;
  makes: string[];
  models: string[];
  chassisCodes: string[];
}

export interface AddOnDefinition {
  id: string;
  status: "active" | "disabled";
  label: string;
  description: string;
  appliesToFamilies: ProductFamily[];
  productId: string | null;
  variantId: string | null;
}

export type ProductFamily =
  | "ambient-lighting"
  | "starlights"
  | "screen-upgrades"
  | "dashcams"
  | "steering-wheels"
  | "rims-calipers"
  | "general";

export interface ShopCategory {
  label: string;
  matches: (product: Product) => boolean;
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

export const products: readonly Product[] = catalogData as Product[];

export const productBySlug: ReadonlyMap<string, Product> = new Map(
  products.map((product) => [product.slug, product]),
);

export const addOnDefinitions: readonly AddOnDefinition[] = addOnData as AddOnDefinition[];

export function isAddOnProduct(product: Product): boolean {
  return product.kind === "addon";
}

export function getProductFamily(product: Product): ProductFamily {
  return product.family;
}

export function productMinimumPrice(product: Product): number {
  const positivePrices = product.variants
    .map((variant) => variant.price)
    .filter((price) => price > 0);
  return positivePrices.length > 0 ? Math.min(...positivePrices) : 0;
}

export function getProductAddOnOptions(product: Product): readonly ProductAddOnOption[] {
  if (product.kind !== "main") return [];

  return addOnDefinitions
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

/** Standalone offers for the inline discovery area; never used as fitment claims. */
export function getDiscoveryProducts(product: Product): readonly Product[] {
  if (product.kind !== "main") return [];

  const sellable = products.filter(
    (candidate) =>
      candidate.id !== product.id &&
      candidate.kind !== "addon" &&
      candidate.available &&
      candidate.purchasable,
  );
  const upgrades = sellable.filter((candidate) => candidate.kind === "upgrade");
  const mainCandidates = sellable.filter((candidate) => candidate.kind === "main");
  const seenFamilies = new Set<ProductFamily>();
  const diverseMainProducts = mainCandidates.filter((candidate) => {
    if (seenFamilies.has(candidate.family)) return false;
    seenFamilies.add(candidate.family);
    return true;
  });

  return [...upgrades, ...diverseMainProducts].slice(0, 6);
}

/** Returns only catalog-backed, currently purchasable extras for a base product. */
export function getProductAddOns(product: Product): readonly Product[] {
  return getProductAddOnOptions(product).flatMap((option) =>
    option.isAvailable ? [option.product] : [],
  );
}

export const shopCategories: readonly ShopCategory[] = [
  { label: "Ambient lighting", matches: (product) => getProductFamily(product) === "ambient-lighting" },
  { label: "Starlights", matches: (product) => getProductFamily(product) === "starlights" },
  { label: "Screens & CarPlay", matches: (product) => getProductFamily(product) === "screen-upgrades" },
  { label: "Dashcams", matches: (product) => getProductFamily(product) === "dashcams" },
  { label: "Steering wheels", matches: (product) => getProductFamily(product) === "steering-wheels" },
  { label: "Wheels & calipers", matches: (product) => getProductFamily(product) === "rims-calipers" },
  { label: "DIY kits", matches: (product) => product.collections.includes("DIY") },
] as const;

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

/** Formats an integer price stored in pence as GBP. */
export function formatPrice(priceInPence: number): string {
  return gbpFormatter.format(priceInPence / 100);
}
