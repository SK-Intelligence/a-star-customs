import { ArrowLeft, ArrowRight, Check, CreditCard, LockKeyhole, Plus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QuantityControl } from '../components/QuantityControl';
import { Seo } from '../components/Seo';
import { formatPrice, getProductAddOnOptions, products } from '../data/catalog';
import { cartSubtotal, useCartStore } from '../store/cart';

type CheckoutStatus = 'idle' | 'loading' | 'unconfigured' | 'review' | 'error';

export function CheckoutPage() {
  const lines = useCartStore((state) => state.lines);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const addBuildAddOn = useCartStore((state) => state.addBuildAddOn);
  const recordCheckout = useCartStore((state) => state.recordCheckout);
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
            ...(line.buildId ? { buildId: line.buildId, lineType: line.lineType } : {}),
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        url?: unknown;
        orderReference?: unknown;
        detail?: { code?: unknown };
      } | null;

      if (
        response.status === 503 &&
        payload?.detail?.code === 'CHECKOUT_NOT_CONFIGURED'
      ) {
        setStatus('unconfigured');
        return;
      }
      if (response.status === 409 && payload?.detail?.code === 'BUILD_INVALID') {
        setStatus('review');
        return;
      }
      if (!response.ok) throw new Error('Checkout request failed');

      if (
        typeof payload?.url !== 'string' ||
        typeof payload.orderReference !== 'string'
      ) {
        throw new Error('Checkout response is incomplete');
      }
      recordCheckout(
        payload.orderReference,
        resolvedLines.map(({ line }) => line),
      );
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
            {resolvedLines.map(({ line, product, variant }) => {
              const addOnOptions = line.lineType === 'base' ? getProductAddOnOptions(product) : [];
              const buildId = line.buildId;
              return (
                <div className={`checkout-build-line checkout-build-line--${line.lineType}`} key={`${line.buildId ?? 'standalone'}:${line.lineType}:${line.productId}:${line.variantId}`}>
                  <article>
                    <img
                      src={product.images[0] ?? '/images/site/hero.jpg'}
                      alt={product.title}
                      decoding="async"
                    />
                    <div>
                      {line.lineType === 'addon' ? <p className="eyebrow">Build add-on</p> : null}
                      <Link to={`/${product.slug}`}><h2>{product.title}</h2></Link>
                      {product.variants.length > 1 ? <p>{variant.title}</p> : null}
                      <strong>{formatPrice(variant.price)}</strong>
                      <div>
                        {line.lineType === 'addon' ? (
                          <span>Qty {line.quantity} · matches build</span>
                        ) : (
                          <QuantityControl
                            compact
                            value={line.quantity}
                            onChange={(quantity) => updateQuantity(line, quantity)}
                          />
                        )}
                        <button type="button" onClick={() => removeItem(line)}>
                          {line.lineType === 'base' ? 'Remove build' : 'Remove'}
                        </button>
                      </div>
                    </div>
                    <strong>{formatPrice(variant.price * line.quantity)}</strong>
                  </article>
                  {buildId && addOnOptions.length > 0 ? (
                    <section className="checkout-build-extras" aria-label={`Add-ons for ${product.title}`}>
                      <div>
                        <strong>Complete this build</strong>
                        <span>Add-ons automatically match the base quantity.</span>
                      </div>
                      <div className="checkout-build-extras__options">
                        {addOnOptions.map((option) => {
                          const { definition } = option;
                          const selectedLine = resolvedLines.find(
                            ({ line: candidate }) =>
                              candidate.buildId === buildId &&
                              candidate.lineType === 'addon' &&
                              candidate.productId === definition.productId &&
                              candidate.variantId === definition.variantId,
                          )?.line;
                          let actionLabel = 'Pricing to be confirmed';
                          if (option.isAvailable) {
                            actionLabel = selectedLine
                              ? 'Remove'
                              : `Add ${formatPrice(option.variant.price)} each`;
                          }
                          return (
                            <button
                              type="button"
                              key={definition.id}
                              disabled={!option.isAvailable}
                              aria-pressed={selectedLine ? 'true' : 'false'}
                              onClick={() => {
                                if (selectedLine) removeItem(selectedLine);
                                else if (option.isAvailable) {
                                  addBuildAddOn(buildId, option.product.id, option.variant.id);
                                }
                              }}
                            >
                              <span>
                                <strong>{definition.label}</strong>
                                <small>{definition.description}</small>
                              </span>
                              <em>{actionLabel}</em>
                              {option.isAvailable && !selectedLine ? <Plus aria-hidden="true" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}
                </div>
              );
            })}
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
                  <strong>Secure checkout is temporarily unavailable.</strong>
                  <p>Please try again later or contact the workshop.</p>
                </>
              ) : null}
              {status === 'error' ? (
                <p>Checkout could not start. Your bag is safe — please try again.</p>
              ) : null}
              {status === 'review' ? (
                <p>This build needs a quick review. Your bag is safe — check the package and add-ons before trying again.</p>
              ) : null}
            </div>

            <ul className="checkout-assurances">
              <li><ShieldCheck aria-hidden="true" /> Server-validated product pricing</li>
              <li><CreditCard aria-hidden="true" /> Stripe-hosted payment page</li>
              <li><Check aria-hidden="true" /> No payment details stored here</li>
            </ul>
            <p className="payment-method-note" aria-label="Payment method availability">
              Stripe shows the methods available for each order. Depending on eligibility, these can include
              card, Apple Pay, Google Pay, Link, Klarna, Clearpay, PayPal (including Pay in 3 where offered),
              Amazon Pay, Revolut Pay and Pay by Bank.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
