import { useCartStore } from '../store/cart';

/** One-time notice shown after the saved bag dropped add-ons that no longer apply. */
export function RemovedAddOnNotice() {
  const visible = useCartStore((state) => state.removedAddOnNotice);
  const dismiss = useCartStore((state) => state.dismissRemovedAddOnNotice);
  if (!visible) return null;

  return (
    <div className="cart-notice" role="status">
      <p>Some add-ons in your bag no longer apply to their package, so we removed them. Your total has been updated.</p>
      <button type="button" className="text-button" onClick={dismiss}>Dismiss</button>
    </div>
  );
}
