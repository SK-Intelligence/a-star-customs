import { Expand } from 'lucide-react';
import { useState } from 'react';
import { ImageLightbox } from '../components/ImageLightbox';
import { PageHero } from '../components/PageHero';
import { Seo } from '../components/Seo';
import { galleryGroups } from '../data/site';

interface ActiveGallery {
  images: readonly string[];
  index: number;
  alt: string;
}

export function GalleryPage() {
  const [active, setActive] = useState<ActiveGallery | null>(null);

  return (
    <>
      <Seo
        title="Automotive Customisation Gallery"
        description="Browse real A Star Customs ambient lighting, starlight headliners, screens, wheels, steering wheels and dashcam installations."
      />
      <PageHero
        eyebrow="Real work. Real customer cars."
        title="See what precision looks like after dark."
        description="A closer look at the details, fit and finish behind recent A Star Customs transformations."
        image="/images/site/gallery-stars-03.jpg"
      />

      <section className="section gallery-section">
        <div className="container gallery-groups">
          {galleryGroups.map((group, groupIndex) => (
            <article className="gallery-group" key={group.id}>
              <div className="gallery-group__heading">
                <span>{String(groupIndex + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{group.title}</h2>
                  <p>{group.description}</p>
                </div>
              </div>
              <div className={`gallery-mosaic gallery-mosaic--${Math.min(group.images.length, 6)}`}>
                {group.images.map((image, imageIndex) => (
                  <button
                    type="button"
                    key={image}
                    onClick={() =>
                      setActive({
                        images: group.images,
                        index: imageIndex,
                        alt: `${group.title} example ${imageIndex + 1}`,
                      })
                    }
                    aria-label={`Open ${group.title} image ${imageIndex + 1}`}
                  >
                    <img src={image} alt={`${group.title} example ${imageIndex + 1}`} loading="lazy" />
                    <span><Expand aria-hidden="true" /></span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <ImageLightbox
        images={active?.images ?? []}
        activeIndex={active?.index ?? null}
        alt={active?.alt ?? 'Gallery image'}
        onChange={(index) => setActive((current) => (current ? { ...current, index } : null))}
        onClose={() => setActive(null)}
      />
    </>
  );
}

