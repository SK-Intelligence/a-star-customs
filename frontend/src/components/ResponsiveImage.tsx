import type { ImgHTMLAttributes } from 'react';
import { images, srcSetFor } from 'virtual:responsive-images';

type ResponsiveImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'sizes' | 'width' | 'height' | 'alt'
> & {
  /** Canonical path under /images, as stored in the catalogue. */
  src: string;
  /** Text alternative; an empty string for a decorative image. */
  alt: string;
  /** Width of the image box, as for <img sizes>. */
  sizes: string;
  /**
   * Width / height of the box when the image is cover-cropped into it. A photo wider than the box
   * renders wider than the box by the ratio of the two aspect ratios; `sizes` is scaled to match.
   */
  coverAspect?: number;
  /** Only for the page's LCP image: loads eagerly at high fetch priority. */
  priority?: boolean;
};

/** Multiplies every length in a sizes list, keeping its media conditions. */
function scaleSizes(sizes: string, factor: number): string {
  const entries: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index <= sizes.length; index += 1) {
    const character = sizes[index];
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if ((character === ',' && depth === 0) || character === undefined) {
      entries.push(sizes.slice(start, index).trim());
      start = index + 1;
    }
  }
  return entries
    .map((entry) => {
      let end = -1;
      if (entry.startsWith('(')) {
        for (let index = 0, level = 0; index < entry.length; index += 1) {
          if (entry[index] === '(') level += 1;
          else if (entry[index] === ')' && --level === 0) {
            end = index;
            break;
          }
        }
      }
      const media = entry.slice(0, end + 1);
      const length = entry.slice(end + 1).trim();
      return `${media}${media ? ' ' : ''}calc((${length}) * ${factor})`;
    })
    .join(', ');
}

/**
 * A catalogue or site image as a <picture>: WebP variants sized for the viewport (made at build
 * time by responsive-images.ts), and the original file as the fallback <img>. The <img> carries the
 * intrinsic width and height, so the browser reserves the right box before the file arrives.
 * <picture> is `display: contents`, so CSS that styles the <img> lays out as before.
 */
export function ResponsiveImage({
  src,
  alt,
  sizes,
  coverAspect,
  priority = false,
  loading,
  fetchPriority,
  ...imageProps
}: ResponsiveImageProps) {
  // React 18 does not know `fetchPriority` (it warns and drops the camelCase prop); the lowercase
  // attribute passes through unchanged.
  const fetchPriorityValue = fetchPriority ?? (priority ? 'high' : undefined);
  const commonProps = {
    alt,
    loading: loading ?? (priority ? 'eager' : 'lazy'),
    decoding: priority ? undefined : ('async' as const),
    ...(fetchPriorityValue ? { fetchpriority: fetchPriorityValue } : {}),
    ...imageProps,
  };

  if (!Object.hasOwn(images, src)) return <img src={src} {...commonProps} />;

  const entry = images[src]!;
  const [width, height] = entry;
  const coverScale = coverAspect ? Math.ceil((width / height / coverAspect) * 100) / 100 : 1;
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={srcSetFor(src, entry)}
        sizes={coverScale > 1 ? scaleSizes(sizes, coverScale) : sizes}
      />
      <img src={src} width={width} height={height} {...commonProps} />
    </picture>
  );
}
