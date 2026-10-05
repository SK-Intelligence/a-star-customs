import { useCartStore } from '../store/cart';

/** One-time notice shown after the saved bag dropped products or add-ons that are no longer available. */
export function RemovedItemsNotice() {
  const visible = useCartStore((state) => state.removedItemsNotice);
  const dismiss = useCartStore((state) => state.dismissRemovedItemsNotice);
  if (!visible) return null;

  return (
    <div className="cart-notice" role="status">
      <p>Some items in your bag are no longer available, so we removed them. Your total has been updated.</p>
      <button type="button" className="text-button" onClick={dismiss}>Dismiss</button>
    </div>
  );
}
