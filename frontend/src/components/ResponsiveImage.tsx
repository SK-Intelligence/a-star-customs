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
   * For a photo contained (object-fit: contain) in its box: paints the photo's own backdrop colour
   * behind it (white for a product shot on white), so the letterbox reads as part of the photo.
   * A photo whose edges are a scene, not a plain backdrop, keeps the box's own dark background.
   */
  matte?: boolean;
  /** Only for the page's LCP image: loads eagerly at high fetch priority. */
  priority?: boolean;
};

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
  matte = false,
  priority = false,
  loading,
  fetchPriority,
  style,
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

  if (!Object.hasOwn(images, src)) return <img src={src} style={style} {...commonProps} />;

  const entry = images[src]!;
  const [width, height, , edgeColour] = entry;
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={srcSetFor(src, entry)}
        sizes={sizes}
      />
      <img
        src={src}
        width={width}
        height={height}
        style={matte && edgeColour ? { backgroundColor: edgeColour, ...style } : style}
        {...commonProps}
      />
    </picture>
  );
}
