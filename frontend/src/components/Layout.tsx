import { Outlet } from 'react-router-dom';
import { CartDrawer } from './CartDrawer';
import { CookieConsent } from './CookieConsent';
import { Footer } from './Footer';
import { Header } from './Header';
import { WhatsAppButton } from './WhatsAppButton';

export function Layout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
      <CartDrawer />
      <CookieConsent />
    </div>
  );
}
