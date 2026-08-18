import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { Seo } from '../components/Seo';
import { serviceCards, whatsappUrl } from '../data/site';

const process = [
  ['Consult', 'Tell us the make, model, year and the finish you have in mind.'],
  ['Design', 'We confirm compatibility, scope, pricing and the best route for your car.'],
  ['Install', 'Your upgrade is fitted, tested and handed over with aftercare guidance.'],
] as const;

export function ServicesPage() {
  return (
    <>
      <Seo
        title="Automotive Customisation Services"
        description="Ambient lighting, starlight headliners, screen upgrades, rims, calipers, dashcams and custom steering wheel fitting in Hounslow."
      />
      <PageHero
        eyebrow="Car customisation in Hounslow"
        title="Our services."
        description="We supply and fit lighting, technology and interior upgrades for a wide range of cars."
        image="/images/site/service-ambient.jpg"
      />

      <section className="section section--carbon">
        <div className="container">
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow">Explore our services</p>
              <h2>Choose a service.</h2>
            </div>
            <p>
              Every vehicle is checked for compatibility before we confirm a
              booking. For custom pricing, message the workshop first.
            </p>
          </div>

          <div className="service-grid">
            {serviceCards.map((service, index) => (
              <article className="service-card" key={service.id}>
                <Link className="service-card__media" to={service.href}>
                  <img src={service.image} alt={service.title} loading="lazy" />
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </Link>
                <div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <Link className="text-link" to={service.href}>
                    See options <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section service-process">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">A straightforward workshop process</p>
            <h2>How booking works.</h2>
          </div>
          <div className="service-process__grid">
            {process.map(([title, description], index) => (
              <article key={title}>
                <CheckCircle2 aria-hidden="true" />
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <div className="inline-cta">
            <div>
              <p className="eyebrow">Not sure which package fits?</p>
              <h3>Send us your car and your idea.</h3>
            </div>
            <a className="button button--primary" href={whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" /> WhatsApp the workshop
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
