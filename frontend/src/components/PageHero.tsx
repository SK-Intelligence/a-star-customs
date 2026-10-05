import { images } from 'virtual:responsive-images';
import { ResponsiveImage } from './ResponsiveImage';

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  image?: string;
}

/**
 * The hero is full width and at least 500px tall (450px at 760px and below), with the image
 * cover-cropped into it: on a narrow screen the image renders at the box height times its aspect.
 */
function heroSizes(src: string): string {
  const [width = 3, height = 4] = Object.hasOwn(images, src) ? images[src]! : [];
  const minimumWidth = (boxHeight: number) => Math.ceil((boxHeight * width) / height);
  return `(max-width: 760px) max(100vw, ${minimumWidth(450)}px), max(100vw, ${minimumWidth(500)}px)`;
}

export function PageHero({ eyebrow, title, description, image }: PageHeroProps) {
  return (
    <section className="page-hero">
      {image ? (
        <ResponsiveImage className="page-hero__media" src={image} alt="" sizes={heroSizes(image)} priority />
      ) : null}
      <div className="container page-hero__content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
