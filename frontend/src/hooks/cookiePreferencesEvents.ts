export const OPEN_COOKIE_PREFERENCES_EVENT = 'astar-cookie-preferences-open';

/** Opens the cookie preferences dialog from anywhere, such as the footer's always-present link. */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT));
}
