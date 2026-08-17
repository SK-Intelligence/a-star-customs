import { ArrowRight, Check, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';

const aboutPoints = [
  'Collaborative design from concept to handover',
  'Transparent planning and progress updates',
  'Rigorous quality control on every build',
];

export function HomePage() {
  return (
    <>
      <Seo
        title="Premium Automotive Customisation"
        description="Transform your car with ambient lighting, starlight headliners, screen upgrades and bespoke finishes from A Star Customs in Hounslow."
      />

      <section className="home-hero">
        <div className="home-hero__media" aria-hidden="true" />
        <div className="home-hero__shade" aria-hidden="true" />
        <div className="container home-hero__content">
          <p className="eyebrow">London · Built around your car</p>
          <h1>
            Your car.
            <span>Your vision.</span>
            Our craft.
          </h1>
          <p className="home-hero__lead">
            Premium lighting, technology and interior upgrades installed with
            precision — and backed by a one-year workmanship warranty.
          </p>
          <div className="button-row">
            <Link className="button button--primary" to="/shop">
              Shop upgrades <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="button button--ghost" to="/contact-us">
              Plan a custom build
            </Link>
          </div>
        </div>
        <div className="home-hero__rail" aria-hidden="true">
          <span>Ambient</span>
          <span>Starlights</span>
          <span>OEM+</span>
          <span>Custom</span>
        </div>
      </section>

      <section className="proof-strip" aria-label="A Star Customs at a glance">
        <div className="container proof-strip__grid">
          <div>
            <strong>400+</strong>
            <span>happy clients</span>
          </div>
          <div>
            <strong>5</strong>
            <span>years of experience</span>
          </div>
          <div>
            <strong>1 yr</strong>
            <span>workmanship warranty</span>
          </div>
          <div>
            <strong>5★</strong>
            <span>service mindset</span>
          </div>
        </div>
      </section>

      <section className="section section--carbon">
        <div className="container">
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow">Start with what your car needs</p>
              <h2>From subtle upgrade to full transformation.</h2>
            </div>
            <p>
              Explore our fitted services or browse proven kits and accessories
              for your own build.
            </p>
          </div>

          <div className="feature-duo">
            <Link className="feature-panel" to="/services">
              <img src="/images/site/service-ambient.jpg" alt="Purple ambient lighting installed in a car" />
              <span className="feature-panel__number">01</span>
              <div>
                <p className="eyebrow">Supplied & fitted</p>
                <h3>Explore services</h3>
                <p>Lighting, screens, rims, cameras and bespoke steering.</p>
                <span className="feature-panel__link">
                  View services <ArrowRight aria-hidden="true" />
                </span>
              </div>
            </Link>
            <Link className="feature-panel" to="/gallery">
              <img src="/images/site/gallery-stars-02.jpg" alt="Detailed starlight headliner installation" />
              <span className="feature-panel__number">02</span>
              <div>
                <p className="eyebrow">Recent transformations</p>
                <h3>See the finish</h3>
                <p>Real customer cars, photographed at the workshop.</p>
                <span className="feature-panel__link">
                  Open gallery <ArrowRight aria-hidden="true" />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="section about-section">
        <div className="container about-grid">
          <div className="about-collage" aria-label="A Star Customs work examples">
            <img
              className="about-collage__main"
              src="/images/site/gallery-ambient-02.jpeg"
              alt="Blue and purple ambient lighting in a vehicle interior"
            />
            <img
              className="about-collage__detail"
              src="/images/site/gallery-steering-01.webp"
              alt="Bespoke custom steering wheel"
            />
            <span className="about-collage__badge">
              <Sparkles aria-hidden="true" /> Built differently
            </span>
          </div>
          <div className="about-copy">
            <p className="eyebrow">About A Star Customs</p>
            <h2>We make ordinary interiors feel one of one.</h2>
            <p>
              We specialise in bespoke customisation across all makes and models,
              bringing together careful craftsmanship, modern materials and the
              latest automotive technology.
            </p>
            <p>
              From a single detail to a complete interior concept, every project
              is shaped around your vision — never a one-size-fits-all template.
            </p>
            <ul className="check-list">
              {aboutPoints.map((point) => (
                <li key={point}>
                  <Check aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <Link className="text-link" to="/featured-collabs">
              See featured builds <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section process-section">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">How a custom build works</p>
            <h2>Clear from first message to final reveal.</h2>
          </div>
          <div className="process-grid">
            <article>
              <span>01</span>
              <Sparkles aria-hidden="true" />
              <h3>Share the vision</h3>
              <p>Send your make, model, year, reference images and must-haves.</p>
            </article>
            <article>
              <span>02</span>
              <Wrench aria-hidden="true" />
              <h3>Approve the plan</h3>
              <p>We confirm the design, materials, price and workshop schedule.</p>
            </article>
            <article>
              <span>03</span>
              <ShieldCheck aria-hidden="true" />
              <h3>Collect with confidence</h3>
              <p>Every build is checked, demonstrated and warranty-backed.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section cta-section">
        <div className="container cta-panel">
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2>Make the cabin feel like yours.</h2>
          </div>
          <div className="button-row">
            <Link className="button button--primary" to="/contact-us">
              Start an enquiry <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="button button--ghost" to="/shop">
              Browse the shop
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
