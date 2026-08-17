import { FormEvent, useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface Review {
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ReviewPanelProps {
  productId: string;
}

export function ReviewPanel({ productId }: ReviewPanelProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const closeReview = () => setOpen(false);
  const reviewDialogRef = useDialogFocus<HTMLFormElement>({
    isOpen: open,
    onClose: closeReview,
    initialFocusSelector: '#reviewer-name',
  });

  useEffect(() => {
    if (!open || status !== 'sent') return;
    const animationFrame = window.requestAnimationFrame(() => {
      reviewDialogRef.current?.querySelector<HTMLElement>('[data-review-done]')?.focus();
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [open, reviewDialogRef, status]);

  useEffect(() => {
    const controller = new AbortController();
    setFetchStatus('loading');
    void fetch(`${apiBaseUrl}/api/reviews/${encodeURIComponent(productId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Reviews unavailable');
        return (await response.json()) as { reviews: Review[] };
      })
      .then((payload) => {
        setReviews(payload.reviews);
        setFetchStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFetchStatus('error');
      });
    return () => controller.abort();
  }, [apiBaseUrl, productId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    try {
      const response = await fetch(`${apiBaseUrl}/api/reviews/${encodeURIComponent(productId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rating, comment }),
      });
      if (!response.ok) throw new Error('Review submission failed');
      setName('');
      setRating(5);
      setComment('');
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="review-panel">
      <div className="review-panel__heading">
        <div>
          <p className="eyebrow">Customer feedback</p>
          <h2>
            {fetchStatus === 'loading'
              ? 'Loading customer reviews…'
              : reviews.length > 0
                ? `${reviews.length} customer reviews`
                : 'Be the first to review'}
          </h2>
        </div>
        <button className="button button--ghost" type="button" onClick={() => setOpen(true)}>
          Leave a review
        </button>
      </div>

      {fetchStatus === 'error' ? (
        <p className="review-panel__empty">
          Customer reviews are temporarily unavailable. You can still submit a new review.
        </p>
      ) : reviews.length > 0 ? (
        <div className="review-grid">
          {reviews.map((review) => (
            <article key={`${review.createdAt}:${review.name}:${review.comment}`}>
              <div aria-label={`${review.rating} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <Star key={index} aria-hidden="true" className={index < review.rating ? 'is-filled' : undefined} />
                ))}
              </div>
              <p>“{review.comment}”</p>
              <span>{review.name} · {new Date(review.createdAt).toLocaleDateString('en-GB')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="review-panel__empty">
          Completed a build or installed this kit? Share your experience with the next customer.
        </p>
      )}

      {open ? (
        <div className="review-modal-backdrop">
          <form
            ref={reviewDialogRef}
            className="review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-dialog-title"
            tabIndex={-1}
            onSubmit={submit}
          >
            <button className="icon-button review-modal__close" type="button" onClick={() => setOpen(false)} aria-label="Close review form">
              <X aria-hidden="true" />
            </button>
            <p className="eyebrow">Your experience</p>
            <h2 id="review-dialog-title">Leave a review</h2>
            {status === 'sent' ? (
              <div className="review-success">
                <Star aria-hidden="true" />
                <h3>Thank you.</h3>
                <p>Your review has been received and will appear after moderation.</p>
                <button data-review-done className="button button--primary" type="button" onClick={() => setOpen(false)}>Done</button>
              </div>
            ) : (
              <>
                <label>
                  <span>Name</span>
                  <input id="reviewer-name" name="reviewer-name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <fieldset>
                  <legend>Rating</legend>
                  <div className="rating-input">
                    {Array.from({ length: 5 }, (_, index) => index + 1).map((value) => (
                      <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} stars`}>
                        <Star aria-hidden="true" className={value <= rating ? 'is-filled' : undefined} />
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  <span>Review</span>
                  <textarea name="review-comment" required minLength={10} maxLength={1200} rows={5} value={comment} onChange={(event) => setComment(event.target.value)} />
                </label>
                <button className="button button--primary" type="submit" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Submitting…' : 'Submit for moderation'}
                </button>
                {status === 'error' ? <p className="form-status">Review submission failed. Please try again.</p> : null}
              </>
            )}
          </form>
        </div>
      ) : null}
    </section>
  );
}
