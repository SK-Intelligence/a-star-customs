import { ArrowRight, ShieldCheck, ShoppingBag, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice, products } from '../data/catalog';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { cartSubtotal, useCartStore } from '../store/cart';
import { QuantityControl } from './QuantityControl';

export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const lines = useCartStore((state) => state.lines);
  const closeCart = useCartStore((state) => state.closeCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const subtotal = useCartStore(cartSubtotal);
  const drawerRef = useDialogFocus<HTMLElement>({
    isOpen,
    onClose: closeCart,
    initialFocusSelector: '.cart-drawer__header button',
    inertWhenClosed: true,
  });

  const resolvedLines = lines.flatMap((line) => {
    const product = products.find((candidate) => candidate.id === line.productId);
    const variant = product?.variants.find((candidate) => candidate.id === line.variantId);
    return product && variant ? [{ line, product, variant }] : [];
  });

  return (
    <>
      <button
        type="button"
        className={isOpen ? 'drawer-backdrop is-open' : 'drawer-backdrop'}
        aria-label="Close shopping bag"
        tabIndex={isOpen ? 0 : -1}
        onClick={closeCart}
      />
      <aside
        ref={drawerRef}
        className={isOpen ? 'cart-drawer is-open' : 'cart-drawer'}
        role="dialog"
        aria-modal={isOpen ? 'true' : undefined}
        aria-hidden={!isOpen}
        aria-labelledby="shopping-bag-title"
        tabIndex={-1}
      >
        <div className="cart-drawer__header">
          <div>
            <p className="eyebrow">Your selection</p>
            <h2 id="shopping-bag-title">Shopping bag</h2>
          </div>
          <button className="icon-button" type="button" onClick={closeCart} aria-label="Close shopping bag">
            <X aria-hidden="true" />
          </button>
        </div>

        {resolvedLines.length === 0 ? (
          <div className="empty-cart">
            <span><ShoppingBag aria-hidden="true" /></span>
            <h3>Your bag is waiting.</h3>
            <p>Browse ready-to-order kits or ask us about a custom job.</p>
            <Link className="button button--primary" to="/shop" onClick={closeCart}>
              Explore the shop <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {resolvedLines.map(({ line, product, variant }) => (
                <article className="cart-line" key={`${line.productId}:${line.variantId}`}>
                  <Link to={`/${product.slug}`} onClick={closeCart}>
                    <img src={product.images[0] ?? '/images/site/hero.jpg'} alt={product.title} />
                  </Link>
                  <div className="cart-line__copy">
                    <Link to={`/${product.slug}`} onClick={closeCart}>{product.title}</Link>
                    {product.variants.length > 1 ? <small>{variant.title}</small> : null}
                    <strong>{formatPrice(variant.price)}</strong>
                    <div className="cart-line__actions">
                      <QuantityControl
                        compact
                        value={line.quantity}
                        onChange={(quantity) => updateQuantity(product.id, variant.id, quantity)}
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${product.title} from bag`}
                        onClick={() => removeItem(product.id, variant.id)}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="cart-drawer__summary">
              <div>
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <p>Shipping is free. Final payment is completed securely with Stripe.</p>
              <Link className="button button--primary button--wide" to="/checkout" onClick={closeCart}>
                Review & checkout <ArrowRight aria-hidden="true" />
              </Link>
              <span className="secure-note"><ShieldCheck aria-hidden="true" /> Secure hosted checkout</span>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
