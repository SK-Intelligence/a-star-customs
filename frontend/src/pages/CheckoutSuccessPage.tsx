import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MessageCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { whatsappUrl } from '../data/site';
import { useCartStore } from '../store/cart';

type VerificationState = 'loading' | 'paid' | 'pending' | 'unpaid' | 'expired' | 'invalid' | 'error';

interface CheckoutStatus {
  orderReference: string;
  status: 'pending' | 'paid' | 'unpaid' | 'expired';
}

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const clearCart = useCartStore((state) => state.clearCart);
  const [verification, setVerification] = useState<VerificationState>('loading');
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

  const verifyPayment = useCallback(async () => {
    if (!sessionId?.startsWith('cs_')) {
      setVerification('invalid');
      return;
    }

    setVerification('loading');
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/checkout/session/${encodeURIComponent(sessionId)}`,
      );
      if (!response.ok) throw new Error('Payment verification failed');

      const payload = (await response.json()) as CheckoutStatus;
      setOrderReference(payload.orderReference);
      setVerification(payload.status);
      if (payload.status === 'paid') clearCart();
    } catch {
      setVerification('error');
    }
  }, [apiBaseUrl, clearCart, sessionId]);

  useEffect(() => {
    void verifyPayment();
  }, [verifyPayment]);

  const isPaid = verification === 'paid';
  const isWaiting = verification === 'loading' || verification === 'pending';

  return (
    <section className="checkout-success" aria-live="polite">
      <Seo
        title={isPaid ? 'Order Confirmed' : 'Checkout Status'}
        description="Verify the status of your A Star Customs checkout."
      />

      <span className={`checkout-success__icon checkout-success__icon--${verification}`}>
        {isPaid ? <CheckCircle2 aria-hidden="true" /> : null}
        {isWaiting ? verification === 'loading' ? <LoaderCircle aria-hidden="true" /> : <Clock3 aria-hidden="true" /> : null}
        {!isPaid && !isWaiting ? <AlertTriangle aria-hidden="true" /> : null}
      </span>

      {isPaid ? (
        <>
          <p className="eyebrow">Payment confirmed</p>
          <h1>Thank you — your order is in.</h1>
          <p>
            Stripe will email your receipt. The workshop will contact you if
            compatibility or fitting details need to be confirmed.
          </p>
          {orderReference ? <small>Order reference: {orderReference}</small> : null}
        </>
      ) : null}

      {isWaiting ? (
        <>
          <p className="eyebrow">Secure verification</p>
          <h1>{verification === 'loading' ? 'Checking your payment…' : 'Your payment is processing.'}</h1>
          <p>
            Keep this page open while Stripe confirms the result. Your bag will
            only be cleared after payment is verified.
          </p>
          {verification === 'pending' ? (
            <button className="button button--primary" type="button" onClick={() => void verifyPayment()}>
              Check again
            </button>
          ) : null}
        </>
      ) : null}

      {verification === 'unpaid' || verification === 'expired' ? (
        <>
          <p className="eyebrow">Payment not completed</p>
          <h1>Your bag is still safe.</h1>
          <p>
            No confirmed payment was found. Return to checkout when you are ready
            to try again.
          </p>
        </>
      ) : null}

      {verification === 'invalid' || verification === 'error' ? (
        <>
          <p className="eyebrow">Unable to verify</p>
          <h1>We can’t confirm an order from this link.</h1>
          <p>
            Your bag has not been cleared. If you completed payment, message the
            workshop and include your Stripe receipt email.
          </p>
        </>
      ) : null}

      {!isWaiting ? (
        <div className="button-row">
          <Link className="button button--primary" to={isPaid ? '/shop' : '/checkout'}>
            {isPaid ? 'Keep browsing' : 'Return to checkout'} <ArrowRight aria-hidden="true" />
          </Link>
          <a className="button button--ghost" href={whatsappUrl} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden="true" /> Message the workshop
          </a>
        </div>
      ) : null}
    </section>
  );
}
