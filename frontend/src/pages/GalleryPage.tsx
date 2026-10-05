import { Expand } from 'lucide-react';
import { useState } from 'react';
import { ImageLightbox } from '../components/ImageLightbox';
import { PageHero } from '../components/PageHero';
import { ResponsiveImage } from '../components/ResponsiveImage';
import { Seo } from '../components/Seo';
import { galleryGroups } from '../data/site';

interface ActiveGallery {
  images: readonly string[];
  index: number;
  alt: string;
}

// Mosaic tiles: a 12-column grid (the first tile 7 columns by 2 rows, the next two 5, the rest 4);
// on phones two columns, the first tile spanning both.
function gallerySizes(index: number): string {
  if (index === 0) return '(max-width: 760px) 100vw, (min-width: 1468px) 830px, 58vw';
  if (index < 3) return '(max-width: 760px) 50vw, (min-width: 1468px) 590px, 42vw';
  return '(max-width: 760px) 50vw, (min-width: 1468px) 475px, 34vw';
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
        title="See our recent work."
        description="Browse lighting, starlights, screens, wheels, steering wheels and dashcams fitted at our workshop."
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
                    <ResponsiveImage
                      src={image}
                      alt={`${group.title} example ${imageIndex + 1}`}
                      sizes={gallerySizes(imageIndex)}
                    />
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
