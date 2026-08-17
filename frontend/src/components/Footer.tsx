import { Facebook, Instagram, Mail, MapPin, Music2, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

const footerLinks = [
  ['Services', '/services'],
  ['Gallery', '/gallery'],
  ['Shop', '/shop'],
  ['Custom kits', '/custom-kits'],
  ['Featured collabs', '/featured-collabs'],
  ['Refund policy', '/refund-policy'],
  ['Privacy notice', '/privacy'],
] as const;

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <img src="/images/site/logo.png" alt="A Star Customs" />
          <p>
            Bespoke automotive upgrades, installed with precision in Hounslow,
            London.
          </p>
          <div className="social-links" aria-label="Social media">
            <a href="https://www.facebook.com/AStrCustoms" target="_blank" rel="noreferrer" aria-label="Facebook">
              <Facebook aria-hidden="true" />
            </a>
            <a href="https://www.instagram.com/A_Starcustoms" target="_blank" rel="noreferrer" aria-label="Instagram">
              <Instagram aria-hidden="true" />
            </a>
            <a href="https://www.tiktok.com/@a.starcustoms" target="_blank" rel="noreferrer" aria-label="TikTok">
              <Music2 aria-hidden="true" />
            </a>
          </div>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          <p className="eyebrow">Explore</p>
          {footerLinks.map(([label, href]) => (
            <Link key={href} to={href}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="footer-contact">
          <p className="eyebrow">Visit the workshop</p>
          <a
            href="https://www.google.com/maps/search/?api=1&query=160-164+Brabazon+Road+Hounslow"
            target="_blank"
            rel="noreferrer"
          >
            <MapPin aria-hidden="true" />
            <span>160–164 Brabazon Road, Hounslow, London</span>
          </a>
          <a href="tel:+447960405187">
            <Phone aria-hidden="true" />
            <span>07960 405187</span>
          </a>
          <a href="mailto:astarenquires@gmail.com">
            <Mail aria-hidden="true" />
            <span>astarenquires@gmail.com</span>
          </a>
        </div>
      </div>
      <div className="container footer-base">
        <span>© {new Date().getFullYear()} A Star Customs</span>
        <span>Bespoke automotive customisation · Hounslow, London</span>
      </div>
    </footer>
  );
}
