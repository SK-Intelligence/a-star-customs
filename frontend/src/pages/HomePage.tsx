import { ArrowRight, Check } from 'lucide-react';
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
          <h1>Car needs an upgrade?</h1>
          <p className="home-hero__lead">
            Here at A Star Customs we always provide a 5 star service...come
            take a look
          </p>
          <div className="button-row">
            <Link className="button button--primary" to="/shop">
              Shop now <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--carbon home-promos">
        <div className="container">
          <div className="feature-duo">
            <Link className="feature-panel" to="/services">
              <img
                src="/images/site/service-ambient.jpg"
                alt="Purple ambient lighting installed in a car"
                loading="lazy"
                decoding="async"
              />
              <div>
                <h2>Services</h2>
                <p>
                  See the upgrades we supply and fit, including lighting,
                  screens, wheels, dashcams and steering wheels.
                </p>
                <span className="feature-panel__link">
                  Explore <ArrowRight aria-hidden="true" />
                </span>
              </div>
            </Link>
            <Link className="feature-panel" to="/gallery">
              <img
                src="/images/site/gallery-stars-02.jpg"
                alt="Detailed starlight headliner installation"
                loading="lazy"
                decoding="async"
              />
              <div>
                <h2>Gallery</h2>
                <p>
                  Take a look at customer cars and recent installations from
                  the workshop.
                </p>
                <span className="feature-panel__link">
                  View our work <ArrowRight aria-hidden="true" />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="section about-section">
        <div className="container about-grid">
          <img
            className="about-media"
            src="/images/site/gallery-ambient-02.jpeg"
            alt="Blue and purple ambient lighting fitted at A Star Customs"
            loading="lazy"
            decoding="async"
          />
          <div className="about-copy">
            <h2>About us</h2>
            <p>
              At A Star Customs, we customise cars across a wide range of makes
              and models. Our work includes interior lighting, starlight
              headliners, screens, dashcams, steering wheels, rims and calipers.
            </p>
            <p>
              You can come to us with a clear plan or just an idea. We will
              check what fits your car, talk through the available options,
              and confirm the price and fitting time before you book.
            </p>
            <p>We keep you involved from the first conversation to collection:</p>
            <ul className="check-list">
              {aboutPoints.map((point) => (
                <li key={point}>
                  <Check aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <p>
              Every job is checked before handover, and our workmanship is
              covered for one year.
            </p>
            <dl className="about-stats" aria-label="A Star Customs experience">
              <div>
                <dt>400+</dt>
                <dd>Happy clients</dd>
              </div>
              <div>
                <dt>5</dt>
                <dd>Years of experience</dd>
              </div>
            </dl>
            <Link className="text-link" to="/featured-collabs">
              Learn more <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="home-showcase" aria-labelledby="home-showcase-title">
        <Link to="/gallery">
          <span>
            <small>Recent work</small>
            <h2 id="home-showcase-title">See inside the workshop</h2>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
