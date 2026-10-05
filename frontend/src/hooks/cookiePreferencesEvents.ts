import { useSyncExternalStore } from 'react';

export const OPEN_COOKIE_PREFERENCES_EVENT = 'astar-cookie-preferences-open';

/** Opens the cookie preferences dialog from anywhere, such as the footer's always-present link. */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT));
}

let bannerPending = false;
const bannerListeners = new Set<() => void>();

/** Called by the cookie banner while it is on screen awaiting a choice. */
export function setCookieBannerPending(pending: boolean) {
  if (bannerPending === pending) return;
  bannerPending = pending;
  bannerListeners.forEach((listener) => listener());
}

/** True while the unanswered cookie banner is showing. */
export function useCookieBannerPending(): boolean {
  return useSyncExternalStore(
    (listener) => {
      bannerListeners.add(listener);
      return () => {
        bannerListeners.delete(listener);
      };
    },
    () => bannerPending,
    () => false,
  );
}
