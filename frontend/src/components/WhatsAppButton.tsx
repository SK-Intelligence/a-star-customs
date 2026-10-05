import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useCookieBannerPending } from '../hooks/cookiePreferencesEvents';
import { whatsappUrl } from '../data/site';

export function WhatsAppButton() {
  const { pathname } = useLocation();
  const [isObscured, setIsObscured] = useState(false);
  const bannerPending = useCookieBannerPending();

  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>('[data-floating-action-zone]'),
    );
    if (targets.length === 0) {
      setIsObscured(false);
      return undefined;
    }

    const visibleTargets = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleTargets.add(entry.target);
        else visibleTargets.delete(entry.target);
      });
      setIsObscured(visibleTargets.size > 0);
    });
    targets.forEach((target) => observer.observe(target));

    return () => observer.disconnect();
  }, [pathname]);

  if (pathname === '/contact-us') return null;

  return (
    <a
      className={[
        'whatsapp-button',
        isObscured ? 'is-obscured' : '',
        // Hidden by CSS only where the banner would overlap it (phones, short landscape).
        bannerPending ? 'is-behind-banner' : '',
      ].filter(Boolean).join(' ')}
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Open WhatsApp enquiry"
      aria-hidden={isObscured || undefined}
      tabIndex={isObscured ? -1 : undefined}
    >
      <MessageCircle aria-hidden="true" />
      <span>Message us</span>
    </a>
  );
}
