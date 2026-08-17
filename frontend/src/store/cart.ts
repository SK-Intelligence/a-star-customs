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

export interface CheckoutSnapshot {
  orderReference: string;
  lines: CartLine[];
}

export interface CartState {
  lines: CartLine[];
  checkoutSnapshots: CheckoutSnapshot[];
  isOpen: boolean;
  addItem: (productId: string, variantId: string, quantity?: number) => void;
  addItems: (lines: CartLine[]) => void;
  updateQuantity: (
    productId: string,
    variantId: string,
    quantity: number,
  ) => void;
  removeItem: (productId: string, variantId: string) => void;
  recordCheckout: (orderReference: string, lines: CartLine[]) => void;
  completeCheckout: (orderReference: string) => void;
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

function mergeLines(currentLines: CartLine[], additions: CartLine[]): CartLine[] {
  return sanitiseLines([...currentLines, ...additions]);
}

function sanitiseCheckoutSnapshots(value: unknown): CheckoutSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((candidate): CheckoutSnapshot[] => {
      if (
        typeof candidate !== "object" ||
        candidate === null ||
        !("orderReference" in candidate) ||
        !("lines" in candidate) ||
        typeof candidate.orderReference !== "string" ||
        !/^asc_[a-f0-9]{32}$/.test(candidate.orderReference)
      ) {
        return [];
      }

      const lines = sanitiseLines(candidate.lines);
      return lines.length > 0
        ? [{ orderReference: candidate.orderReference, lines }]
        : [];
    })
    .slice(-10);
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      checkoutSnapshots: [],
      isOpen: false,
      addItem: (productId, variantId, quantity = 1) => {
        set((state) => ({
          lines: mergeLines(state.lines, [{ productId, variantId, quantity }]),
          isOpen: true,
        }));
      },
      addItems: (lines) =>
        set((state) => ({
          lines: mergeLines(state.lines, lines),
          isOpen: true,
        })),
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
      recordCheckout: (orderReference, lines) => {
        if (!/^asc_[a-f0-9]{32}$/.test(orderReference)) {
          return;
        }

        const snapshotLines = sanitiseLines(lines);
        if (snapshotLines.length === 0) {
          return;
        }

        set((state) => ({
          checkoutSnapshots: [
            ...state.checkoutSnapshots.filter(
              (snapshot) => snapshot.orderReference !== orderReference,
            ),
            { orderReference, lines: snapshotLines },
          ].slice(-10),
        }));
      },
      completeCheckout: (orderReference) =>
        set((state) => {
          const snapshot = state.checkoutSnapshots.find(
            (candidate) => candidate.orderReference === orderReference,
          );
          if (!snapshot) {
            return state;
          }

          const purchasedQuantities = new Map(
            snapshot.lines.map((line) => [lineKey(line), line.quantity]),
          );
          const lines = state.lines.flatMap((line): CartLine[] => {
            const remaining = line.quantity - (purchasedQuantities.get(lineKey(line)) ?? 0);
            return remaining > 0 ? [{ ...line, quantity: remaining }] : [];
          });

          return {
            lines,
            checkoutSnapshots: state.checkoutSnapshots.filter(
              (candidate) => candidate.orderReference !== orderReference,
            ),
          };
        }),
      clearCart: () => set({ lines: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
    }),
    {
      name: "astar-customs-cart",
      partialize: (state) => ({
        lines: state.lines,
        checkoutSnapshots: state.checkoutSnapshots,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          lines?: unknown;
          checkoutSnapshots?: unknown;
        } | undefined;
        return {
          ...currentState,
          lines: sanitiseLines(persisted?.lines),
          checkoutSnapshots: sanitiseCheckoutSnapshots(
            persisted?.checkoutSnapshots,
          ),
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
