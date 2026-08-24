import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();
  const previousPathname = useRef<string | null>(null);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    if (previousPathname.current === null) {
      previousPathname.current = pathname;
      return;
    }
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('#main-content h1');
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
