import { useEffect, useState } from 'react';
import { ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDialogFocus } from '../hooks/useDialogFocus';

const STORAGE_KEY = 'astar-cookie-preferences';
const EVENT_NAME = 'astar-cookie-preferences-changed';

export interface CookiePreferences {
  analytics: boolean;
  marketing: boolean;
}

function isCookiePreferences(value: unknown): value is CookiePreferences {
  return (
    typeof value === 'object' &&
    value !== null &&
    'analytics' in value &&
    typeof value.analytics === 'boolean' &&
    'marketing' in value &&
    typeof value.marketing === 'boolean'
  );
}

function readPreferences(): CookiePreferences | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    return isCookiePreferences(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function savePreferences(preferences: CookiePreferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Consent still applies for this tab when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: preferences }));
}

export function useMarketingConsent() {
  const [allowed, setAllowed] = useState(
    () => readPreferences()?.marketing ?? false,
  );

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      if (isCookiePreferences(detail)) setAllowed(detail.marketing);
    };

    window.addEventListener(EVENT_NAME, handleChange);
    return () => window.removeEventListener(EVENT_NAME, handleChange);
  }, []);

  return allowed;
}

interface ConsentGateProps {
  title: string;
  children: React.ReactNode;
}

export function ConsentGate({ title, children }: ConsentGateProps) {
  const marketingAllowed = useMarketingConsent();

  if (marketingAllowed) {
    return children;
  }

  return (
    <div className="consent-gate">
      <ShieldCheck aria-hidden="true" />
      <h3>{title}</h3>
      <p>Allow marketing cookies to load this third-party content.</p>
      <button
        className="button button--ghost"
        type="button"
        onClick={() => {
          savePreferences({ analytics: false, marketing: true });
        }}
      >
        Allow content
      </button>
    </div>
  );
}

export function CookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(() =>
    readPreferences(),
  );
  const [isManaging, setIsManaging] = useState(false);
  const [draft, setDraft] = useState<CookiePreferences>({
    analytics: false,
    marketing: false,
  });
  const closePreferences = () => setIsManaging(false);
  const preferencesRef = useDialogFocus<HTMLElement>({
    isOpen: isManaging,
    onClose: closePreferences,
    initialFocusSelector: '.cookie-modal__close, .cookie-options input:not([disabled])',
  });

  if (preferences && !isManaging) {
    return (
      <button
        className="cookie-settings-button"
        type="button"
        aria-label="Open cookie preferences"
        onClick={() => {
          setDraft(preferences);
          setIsManaging(true);
        }}
      >
        <SlidersHorizontal aria-hidden="true" />
      </button>
    );
  }

  const accept = (next: CookiePreferences) => {
    savePreferences(next);
    setPreferences(next);
    setIsManaging(false);
  };

  return (
    <div className={isManaging ? 'cookie-modal-backdrop' : 'cookie-banner-wrap'}>
      <section
        ref={preferencesRef}
        className={isManaging ? 'cookie-modal' : 'cookie-banner'}
        role={isManaging ? 'dialog' : 'region'}
        aria-modal={isManaging ? 'true' : undefined}
        aria-labelledby="cookie-preferences-title"
        tabIndex={isManaging ? -1 : undefined}
      >
        {isManaging && preferences ? (
          <button
            type="button"
            className="icon-button cookie-modal__close"
            aria-label="Close cookie preferences"
            onClick={() => setIsManaging(false)}
          >
            <X aria-hidden="true" />
          </button>
        ) : null}
        <div>
          {isManaging ? <p className="eyebrow">Your privacy, your choice</p> : null}
          <h2 id="cookie-preferences-title">{isManaging ? 'Cookie preferences' : 'We use cookies'}</h2>
          <p>
            Essential cookies keep the site and shopping bag working. Optional
            analytics and social media cookies only load with your permission.
            {' '}Read our <Link to="/privacy">privacy notice</Link>.
          </p>
        </div>

        {isManaging ? (
          <div className="cookie-options">
            <label>
              <span>
                <strong>Strictly necessary</strong>
                <small>Cart, navigation and saved preferences</small>
              </span>
              <input type="checkbox" checked disabled />
            </label>
            <label>
              <span>
                <strong>Analytics</strong>
                <small>Anonymous performance measurement</small>
              </span>
              <input
                type="checkbox"
                checked={draft.analytics}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    analytics: event.target.checked,
                  }))
                }
              />
            </label>
            <label>
              <span>
                <strong>Marketing & social media</strong>
                <small>TikTok and other third-party embeds</small>
              </span>
              <input
                type="checkbox"
                checked={draft.marketing}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    marketing: event.target.checked,
                  }))
                }
              />
            </label>
          </div>
        ) : null}

        <div className="cookie-actions">
          {isManaging ? (
            <button type="button" className="button button--primary" onClick={() => accept(draft)}>
              Save choices
            </button>
          ) : (
            <>
              <button
                type="button"
                className="button button--primary"
                onClick={() => accept({ analytics: true, marketing: true })}
              >
                Accept all
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => accept({ analytics: false, marketing: false })}
              >
                Essentials only
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setDraft({ analytics: false, marketing: false });
                  setIsManaging(true);
                }}
              >
                Manage preferences
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
