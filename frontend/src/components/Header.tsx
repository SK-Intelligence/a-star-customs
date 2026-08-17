import {
  Facebook,
  Instagram,
  Menu,
  Music2,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { cartItemCount, useCartStore } from '../store/cart';

const navigation = [
  ['Home', '/'],
  ['Services', '/services'],
  ['Gallery', '/gallery'],
  ['Shop', '/shop'],
  ['Custom kits', '/custom-kits'],
  ['Featured collabs', '/featured-collabs'],
  ['Refund policy', '/refund-policy'],
  ['Contact', '/contact-us'],
] as const;

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const itemCount = useCartStore(cartItemCount);
  const openCart = useCartStore((state) => state.openCart);
  const closeMenu = () => setMenuOpen(false);
  const mobileMenuRef = useDialogFocus<HTMLDivElement>({
    isOpen: menuOpen,
    onClose: closeMenu,
    initialFocusSelector: 'a[href]',
    inertWhenClosed: true,
  });

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="site-header">
      <div className="announcement-bar">
        <span>Transform your ride with custom services</span>
        <Link to="/contact-us">Book a consultation</Link>
      </div>
      <div className="site-header__main">
        <div className="container site-header__inner">
          <Link className="site-logo" to="/" aria-label="A Star Customs home">
            <img src="/images/site/logo.png" alt="A Star Customs" />
          </Link>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {navigation.map(([label, href]) => (
              <NavLink
                key={href}
                to={href}
                end={href === '/'}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="cart-button"
              aria-label={`Open shopping bag with ${itemCount} items`}
              onClick={openCart}
            >
              <ShoppingBag aria-hidden="true" />
              {itemCount > 0 ? <span>{itemCount}</span> : null}
            </button>
            <button
              type="button"
              className="menu-button"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span>{menuOpen ? 'Close' : 'Menu'}</span>
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      <div
        ref={mobileMenuRef}
        id="mobile-menu"
        className={menuOpen ? 'mobile-menu is-open' : 'mobile-menu'}
        role="dialog"
        aria-modal={menuOpen ? 'true' : undefined}
        aria-label="Mobile navigation menu"
        aria-hidden={!menuOpen}
        tabIndex={-1}
      >
        <nav aria-label="Mobile navigation">
          {navigation.map(([label, href], index) => (
            <NavLink
              key={href}
              to={href}
              end={href === '/'}
              tabIndex={menuOpen ? 0 : -1}
              style={{ '--menu-index': index } as React.CSSProperties}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mobile-menu__footer">
          <p>Follow the latest builds</p>
          <div className="social-links">
            <a href="https://www.facebook.com/AStrCustoms" aria-label="Facebook" tabIndex={menuOpen ? 0 : -1}>
              <Facebook aria-hidden="true" />
            </a>
            <a href="https://www.instagram.com/A_Starcustoms" aria-label="Instagram" tabIndex={menuOpen ? 0 : -1}>
              <Instagram aria-hidden="true" />
            </a>
            <a href="https://www.tiktok.com/@a.starcustoms" aria-label="TikTok" tabIndex={menuOpen ? 0 : -1}>
              <Music2 aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
