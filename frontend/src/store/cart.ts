import { create } from "zustand";
import { persist } from "zustand/middleware";

import { products } from "../data/catalog";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;

export interface CartLine {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
  isOpen: boolean;
  addItem: (productId: string, variantId: string, quantity?: number) => void;
  updateQuantity: (
    productId: string,
    variantId: string,
    quantity: number,
  ) => void;
  removeItem: (productId: string, variantId: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

function lineKey(line: Pick<CartLine, "productId" | "variantId">): string {
  return `${line.productId}:${line.variantId}`;
}

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return MIN_QUANTITY;
  }

  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(quantity)));
}

function isPurchasableCatalogVariant(
  productId: string,
  variantId: string,
): boolean {
  const product = products.find((candidate) => candidate.id === productId);
  return (
    product?.purchasable === true &&
    product.available &&
    product.variants.some(
      (variant) => variant.id === variantId && variant.available,
    )
  );
}

function sanitiseLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const lines = new Map<string, CartLine>();

  for (const candidate of value) {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("productId" in candidate) ||
      !("variantId" in candidate) ||
      !("quantity" in candidate) ||
      typeof candidate.productId !== "string" ||
      typeof candidate.variantId !== "string" ||
      typeof candidate.quantity !== "number" ||
      !isPurchasableCatalogVariant(candidate.productId, candidate.variantId)
    ) {
      continue;
    }

    const line: CartLine = {
      productId: candidate.productId,
      variantId: candidate.variantId,
      quantity: clampQuantity(candidate.quantity),
    };
    const key = lineKey(line);
    const existing = lines.get(key);
    lines.set(key, {
      ...line,
      quantity: clampQuantity((existing?.quantity ?? 0) + line.quantity),
    });
  }

  return Array.from(lines.values());
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      addItem: (productId, variantId, quantity = 1) => {
        if (!isPurchasableCatalogVariant(productId, variantId)) {
          return;
        }

        set((state) => {
          const key = lineKey({ productId, variantId });
          const existing = state.lines.find((line) => lineKey(line) === key);

          if (!existing) {
            return {
              lines: [
                ...state.lines,
                { productId, variantId, quantity: clampQuantity(quantity) },
              ],
              isOpen: true,
            };
          }

          return {
            lines: state.lines.map((line) =>
              lineKey(line) === key
                ? {
                    ...line,
                    quantity: clampQuantity(line.quantity + quantity),
                  }
                : line,
            ),
            isOpen: true,
          };
        });
      },
      updateQuantity: (productId, variantId, quantity) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.productId === productId && line.variantId === variantId
              ? { ...line, quantity: clampQuantity(quantity) }
              : line,
          ),
        })),
      removeItem: (productId, variantId) =>
        set((state) => ({
          lines: state.lines.filter(
            (line) =>
              line.productId !== productId || line.variantId !== variantId,
          ),
        })),
      clearCart: () => set({ lines: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
    }),
    {
      name: "astar-customs-cart",
      partialize: (state) => ({ lines: state.lines }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { lines?: unknown } | undefined;
        return {
          ...currentState,
          lines: sanitiseLines(persisted?.lines),
        };
      },
    },
  ),
);

export function cartSubtotal(state: Pick<CartState, "lines">): number {
  return state.lines.reduce((total, line) => {
    const product = products.find((candidate) => candidate.id === line.productId);
    const variant = product?.variants.find(
      (candidate) => candidate.id === line.variantId,
    );
    return total + (variant?.price ?? 0) * line.quantity;
  }, 0);
}

export function cartItemCount(state: Pick<CartState, "lines">): number {
  return state.lines.reduce((total, line) => total + line.quantity, 0);
}
