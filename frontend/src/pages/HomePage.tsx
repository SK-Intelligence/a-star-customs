import { ArrowRight, Check, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';

const aboutPoints = [
  'We discuss the job with you before work starts',
  'Clear pricing and progress updates',
  'Every installation checked before handover',
];

export function HomePage() {
  return (
    <>
      <Seo
        title="Car Upgrades & Customisation"
        description="Car lighting, starlight headliners, screen upgrades, dashcams, steering wheels, rims and calipers fitted by A Star Customs in Hounslow."
      />

      <section className="home-hero">
        <div className="home-hero__media" aria-hidden="true" />
        <div className="home-hero__shade" aria-hidden="true" />
        <div className="container home-hero__content">
          <p className="eyebrow">Car customisation in Hounslow</p>
          <h1>Car needs an upgrade?</h1>
          <p className="home-hero__lead">
            Here at A Star Customs, we always provide a 5-star service. Come
            take a look at what we can do for your car.
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
            <span>customer service</span>
          </div>
        </div>
      </section>

      <section className="section section--carbon">
        <div className="container">
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow">Start with what your car needs</p>
              <h2>Choose the right upgrade for your car.</h2>
            </div>
            <p>
              Explore our fitted services or browse kits and accessories
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
                <p>Lighting, screens, wheels, dashcams and steering wheels.</p>
                <span className="feature-panel__link">
                  View services <ArrowRight aria-hidden="true" />
                </span>
              </div>
            </Link>
            <Link className="feature-panel" to="/gallery">
              <img src="/images/site/gallery-stars-02.jpg" alt="Detailed starlight headliner installation" />
              <span className="feature-panel__number">02</span>
              <div>
                <p className="eyebrow">Recent work</p>
                <h3>View our work</h3>
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
              alt="Custom steering wheel"
            />
            <span className="about-collage__badge">
              <Sparkles aria-hidden="true" /> Hounslow workshop
            </span>
          </div>
          <div className="about-copy">
            <p className="eyebrow">About A Star Customs</p>
            <h2>Car upgrades fitted in Hounslow.</h2>
            <p>
              We fit ambient lighting, starlights, screens, dashcams, steering
              wheels, rims and calipers for a wide range of makes and models.
            </p>
            <p>
              Tell us what you drive and what you want changed. We will confirm
              compatibility, options, price and fitting time before you book.
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
            <h2>From enquiry to collection.</h2>
          </div>
          <div className="process-grid">
            <article>
              <span>01</span>
              <Sparkles aria-hidden="true" />
              <h3>Tell us about your car</h3>
              <p>Send the make, model, year and details of the work you want.</p>
            </article>
            <article>
              <span>02</span>
              <Wrench aria-hidden="true" />
              <h3>Confirm the job</h3>
              <p>We agree the parts, finish, price and workshop date with you.</p>
            </article>
            <article>
              <span>03</span>
              <ShieldCheck aria-hidden="true" />
              <h3>Collect your car</h3>
              <p>We check the installation, show you how it works and explain the warranty.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section cta-section">
        <div className="container cta-panel">
          <div>
            <p className="eyebrow">Thinking about an upgrade?</p>
            <h2>Tell us what you have in mind.</h2>
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
