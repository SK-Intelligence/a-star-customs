import { Facebook, Instagram, Mail, MapPin, Music2, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { contactDetails, socialLinks } from '../data/site';

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
          <img src="/images/site/logo.png" alt="A Star Customs" loading="lazy" decoding="async" />
          <p>
            Car lighting, technology and interior upgrades fitted in Hounslow,
            London.
          </p>
          <div className="social-links" aria-label="Social media">
            {socialLinks.map(({ label, href }) => {
              const Icon = label === 'Facebook'
                ? Facebook
                : label === 'Instagram'
                  ? Instagram
                  : Music2;
              return (
                <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}>
                  <Icon aria-hidden="true" />
                </a>
              );
            })}
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
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactDetails.mapQuery)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin aria-hidden="true" />
            <span>{contactDetails.address.slice(0, 2).join(', ')}</span>
          </a>
          <a href={`tel:${contactDetails.phone}`}>
            <Phone aria-hidden="true" />
            <span>{contactDetails.phoneDisplay}</span>
          </a>
          <a href={`mailto:${contactDetails.email}`}>
            <Mail aria-hidden="true" />
            <span>{contactDetails.email}</span>
          </a>
        </div>
      </div>
      <div className="container footer-base">
        <span>© {new Date().getFullYear()} A Star Customs</span>
        <span>Car upgrades and custom fitting · Hounslow, London</span>
      </div>
    </footer>
  );
}
