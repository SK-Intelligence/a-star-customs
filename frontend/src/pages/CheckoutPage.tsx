import { ArrowLeft, ArrowRight, Check, CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QuantityControl } from '../components/QuantityControl';
import { Seo } from '../components/Seo';
import { formatPrice, products } from '../data/catalog';
import { cartSubtotal, useCartStore } from '../store/cart';

type CheckoutStatus = 'idle' | 'loading' | 'unconfigured' | 'error';

export function CheckoutPage() {
  const lines = useCartStore((state) => state.lines);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const subtotal = useCartStore(cartSubtotal);
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

  const resolvedLines = lines.flatMap((line) => {
    const product = products.find((candidate) => candidate.id === line.productId);
    const variant = product?.variants.find((candidate) => candidate.id === line.variantId);
    return product && variant ? [{ line, product, variant }] : [];
  });

  const startCheckout = async () => {
    setStatus('loading');
    try {
      const response = await fetch(`${apiBaseUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: resolvedLines.map(({ line }) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        }),
      });

      if (response.status === 503) {
        setStatus('unconfigured');
        return;
      }
      if (!response.ok) throw new Error('Checkout request failed');

      const payload = (await response.json()) as { url?: string };
      if (!payload.url) throw new Error('Checkout URL missing');
      window.location.assign(payload.url);
    } catch {
      setStatus('error');
    }
  };

  if (resolvedLines.length === 0) {
    return (
      <section className="checkout-empty">
        <Seo title="Checkout" description="Review your A Star Customs shopping bag." />
        <CreditCard aria-hidden="true" />
        <p className="eyebrow">Checkout</p>
        <h1>Your bag is empty.</h1>
        <p>Add an upgrade before continuing to secure checkout.</p>
        <Link className="button button--primary" to="/shop">Browse the shop <ArrowRight aria-hidden="true" /></Link>
      </section>
    );
  }

  return (
    <section className="checkout-page section--carbon">
      <Seo title="Secure Checkout" description="Review your A Star Customs order before continuing to Stripe Checkout." />
      <div className="container">
        <Link className="back-link" to="/shop"><ArrowLeft aria-hidden="true" /> Continue shopping</Link>
        <div className="checkout-heading">
          <div>
            <p className="eyebrow">Secure checkout</p>
            <h1>Review your build.</h1>
          </div>
          <span><LockKeyhole aria-hidden="true" /> Payment handled by Stripe</span>
        </div>

        <div className="checkout-layout">
          <div className="checkout-items">
            {resolvedLines.map(({ line, product, variant }) => (
              <article key={`${line.productId}:${line.variantId}`}>
                <img src={product.images[0] ?? '/images/site/hero.jpg'} alt={product.title} />
                <div>
                  <Link to={`/${product.slug}`}><h2>{product.title}</h2></Link>
                  {product.variants.length > 1 ? <p>{variant.title}</p> : null}
                  <strong>{formatPrice(variant.price)}</strong>
                  <div>
                    <QuantityControl
                      compact
                      value={line.quantity}
                      onChange={(quantity) => updateQuantity(product.id, variant.id, quantity)}
                    />
                    <button type="button" onClick={() => removeItem(product.id, variant.id)}>Remove</button>
                  </div>
                </div>
                <strong>{formatPrice(variant.price * line.quantity)}</strong>
              </article>
            ))}
          </div>

          <aside className="order-summary">
            <p className="eyebrow">Order summary</p>
            <h2>{resolvedLines.length} {resolvedLines.length === 1 ? 'selection' : 'selections'}</h2>
            <dl>
              <div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
              <div><dt>Shipping</dt><dd>Free</dd></div>
              <div><dt>Total</dt><dd>{formatPrice(subtotal)}</dd></div>
            </dl>
            <label className="policy-checkbox">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
              <span>
                I agree to the <Link to="/refund-policy">returns, refunds and warranty policy</Link>.
              </span>
            </label>
            <button
              className="button button--primary button--wide"
              type="button"
              disabled={!agreed || status === 'loading'}
              onClick={startCheckout}
            >
              {status === 'loading' ? 'Preparing checkout…' : 'Continue to secure payment'}
              <ArrowRight aria-hidden="true" />
            </button>

            <div className="checkout-status" aria-live="polite">
              {status === 'unconfigured' ? (
                <>
                  <strong>Payment setup placeholder is ready.</strong>
                  <p>Add the Stripe environment keys described in the project README to activate hosted checkout.</p>
                </>
              ) : null}
              {status === 'error' ? (
                <p>Checkout could not start. Your bag is safe — please try again.</p>
              ) : null}
            </div>

            <ul className="checkout-assurances">
              <li><ShieldCheck aria-hidden="true" /> Server-validated product pricing</li>
              <li><CreditCard aria-hidden="true" /> Stripe-hosted payment page</li>
              <li><Check aria-hidden="true" /> No payment details stored here</li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
