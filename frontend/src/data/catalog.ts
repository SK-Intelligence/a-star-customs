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
  /**
   * When set, only these base products offer the add-on. A base product offers the union of
   * every add-on scoped to it plus any family-wide (unscoped) add-on of its family.
   */
  appliesToProducts?: string[] | null;
  /** At most one add-on per exclusive group may be attached to a single build. */
  exclusiveGroup?: string | null;
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

export const productFamilyLabels: Readonly<Record<ProductFamily, string>> = {
  "ambient-lighting": "Ambient lighting",
  starlights: "Starlights",
  "screen-upgrades": "Screens & CarPlay",
  dashcams: "Dashcams",
  "steering-wheels": "Steering wheels",
  "rims-calipers": "Wheels & calipers",
  general: "A Star Customs",
};

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

export function getProductFamilyLabel(product: Product): string {
  return productFamilyLabels[product.family];
}

export function productMinimumPrice(product: Product): number {
  const positivePrices = product.variants
    .map((variant) => variant.price)
    .filter((price) => price > 0);
  return positivePrices.length > 0 ? Math.min(...positivePrices) : 0;
}

/**
 * Add-ons a main or upgrade listing offers: every definition of its family that is either
 * scoped to it (`appliesToProducts`) or family-wide. Add-on products offer none.
 */
export function getProductAddOnOptions(product: Product): readonly ProductAddOnOption[] {
  if (product.kind === "addon") return [];

  return addOnDefinitions
    .filter(
      (definition) =>
        definition.appliesToFamilies.includes(product.family) &&
        (definition.appliesToProducts == null ||
          definition.appliesToProducts.includes(product.id)),
    )
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

/** Options that cannot share a build with `definition` because they belong to its exclusive group. */
export function exclusiveSiblingDefinitions(
  options: readonly ProductAddOnOption[],
  definition: AddOnDefinition,
): readonly AddOnDefinition[] {
  if (definition.exclusiveGroup == null) return [];
  return options
    .map((option) => option.definition)
    .filter(
      (candidate) =>
        candidate.id !== definition.id && candidate.exclusiveGroup === definition.exclusiveGroup,
    );
}

function normalizedFitmentValues(values: readonly string[]): Set<string> {
  return new Set(values.map((value) => value.trim().toLocaleLowerCase("en-GB")));
}

function isSubset(values: ReadonlySet<string>, superset: ReadonlySet<string>): boolean {
  return [...values].every((value) => superset.has(value));
}

/**
 * True when `candidate` is known to fit every vehicle `source` is sold for.
 *
 * A universal candidate, or a confirm-first candidate that names no make, is allowed
 * everywhere. Otherwise the candidate must cover every make and every model of the
 * source and, when it lists chassis codes, every chassis code of the source. A
 * make-only candidate is too vague for a model-specific page, and a single shared
 * model is not enough: a CLA/GLA overlap does not make an A-Class kit fit a C-Class.
 *
 * Model years are not compared: the catalogue has no year field yet, so two listings for the
 * same make/model/chassis count as compatible whatever years their titles mention. Add a years
 * check here (and in `covers` in scripts/check_catalog_sync.py and the parity copy in
 * e2e/fitment.spec.ts) once the client supplies year ranges.
 */
export function productFitmentsAreCompatible(source: Product, candidate: Product): boolean {
  if (candidate.fitment.mode === "universal") return true;

  const candidateMakes = normalizedFitmentValues(candidate.fitment.makes);
  if (candidateMakes.size === 0 && candidate.fitment.mode === "confirm") return true;

  // When the current product does not identify a vehicle, do not infer one for the customer.
  const sourceMakes = normalizedFitmentValues(source.fitment.makes);
  if (sourceMakes.size === 0 || !isSubset(sourceMakes, candidateMakes)) return false;

  const sourceModels = normalizedFitmentValues(source.fitment.models);
  const candidateModels = normalizedFitmentValues(candidate.fitment.models);
  if (candidateModels.size === 0) return sourceModels.size === 0;
  if (sourceModels.size === 0 || !isSubset(sourceModels, candidateModels)) return false;

  const candidateChassis = normalizedFitmentValues(candidate.fitment.chassisCodes);
  if (candidateChassis.size === 0) return true;
  const sourceChassis = normalizedFitmentValues(source.fitment.chassisCodes);
  return sourceChassis.size > 0 && isSubset(sourceChassis, candidateChassis);
}

/**
 * Standalone offers for the inline discovery area. Every offer passes
 * `productFitmentsAreCompatible`, so it must fit every vehicle the page is sold for.
 */
export function getDiscoveryProducts(product: Product): readonly Product[] {
  if (product.kind !== "main") return [];

  const sellable = products.filter(
    (candidate) =>
      candidate.id !== product.id &&
      candidate.kind !== "addon" &&
      candidate.available &&
      candidate.purchasable &&
      productFitmentsAreCompatible(product, candidate),
  );
  const upgrades = sellable.filter((candidate) => candidate.kind === "upgrade");
  const mainCandidates = sellable.filter((candidate) => candidate.kind === "main");
  // One slot per family, except starlights: the first-listed DIY kit (currently the cheapest) and one fitted package.
  const seenSlots = new Set<string>();
  const diverseMainProducts = mainCandidates.filter((candidate) => {
    const slot =
      candidate.family === "starlights" && candidate.collections.includes("DIY")
        ? "starlights-diy"
        : candidate.family;
    if (seenSlots.has(slot)) return false;
    seenSlots.add(slot);
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
