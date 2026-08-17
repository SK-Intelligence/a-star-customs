import { ExternalLink } from 'lucide-react';
import { ConsentGate } from '../components/CookieConsent';
import { PageHero } from '../components/PageHero';
import { Seo } from '../components/Seo';
import { collaborations } from '../data/site';

const tiktokVideos = [
  '7381172925073722657',
  '7458774015750982945',
  '7543203348439174422',
] as const;

export function CollaborationsPage() {
  return (
    <>
      <Seo
        title="Featured Collaborations"
        description="Discover recognisable creator cars transformed by A Star Customs, including bespoke ambient lighting, starlights and technology upgrades."
      />
      <PageHero
        eyebrow="Featured builds"
        title="Cars you may have seen on your feed."
        description="Creators trust us with cars their audiences know. Every collaboration still gets the same workshop detail as every customer build."
        image="/images/site/gallery-ambient-01.jpeg"
      />

      <section className="section collaboration-section">
        <div className="container">
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow">Who we’ve supplied</p>
              <h2>Recognisable names. Individual results.</h2>
            </div>
            <p>
              The brief changes with every car; the standard of finish does not.
            </p>
          </div>
          <div className="collaboration-grid">
            {collaborations.map((collaboration, index) => (
              <article className="collaboration-card" key={collaboration.id}>
                <img src={collaboration.image} alt={`${collaboration.name} collaboration`} loading="lazy" />
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{collaboration.name}</h3>
                  <p>{collaboration.description}</p>
                  <small>Build</small>
                  <strong>{collaboration.service}</strong>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--carbon social-builds">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">See the transformations in motion</p>
            <h2>From workshop to reveal.</h2>
          </div>
          <ConsentGate title="TikTok build videos">
            <div className="tiktok-grid">
              {tiktokVideos.map((videoId) => (
                <iframe
                  key={videoId}
                  src={`https://www.tiktok.com/player/v1/${videoId}?autoplay=0&loop=0`}
                  title="A Star Customs TikTok build video"
                  loading="lazy"
                  allow="fullscreen"
                />
              ))}
            </div>
          </ConsentGate>
          <a
            className="text-link social-builds__link"
            href="https://www.tiktok.com/@a.starcustoms"
            target="_blank"
            rel="noreferrer"
          >
            View more on TikTok <ExternalLink aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  );
}

