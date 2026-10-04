import type { ImgHTMLAttributes } from 'react';
import { imageSizes, variantWidths } from 'virtual:responsive-images';

type ResponsiveImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'sizes' | 'width' | 'height'> & {
  /** Canonical path under /images, as stored in the catalogue. */
  src: string;
  /** Rendered width of the image box, as for <img sizes>. */
  sizes: string;
  /** Only for the page's LCP image. */
  priority?: boolean;
};

/**
 * A catalogue or site image as a <picture>: WebP variants sized for the viewport (made at build
 * time by responsive-images.ts), and the original file as the fallback <img>. The <img> carries the
 * intrinsic width and height, so the browser reserves the right box before the file arrives.
 * <picture> is `display: contents`, so CSS that styles the <img> lays out as before.
 */
export function ResponsiveImage({ src, sizes, priority = false, loading, ...imageProps }: ResponsiveImageProps) {
  const size = imageSizes[src];
  // React 18 does not know `fetchPriority`; the lowercase attribute passes through unchanged.
  const priorityProps = priority ? { fetchpriority: 'high' } : {};
  const imageLoading = loading ?? (priority ? 'eager' : 'lazy');

  if (!size) {
    return (
      <img src={src} loading={imageLoading} decoding={priority ? undefined : 'async'} {...priorityProps} {...imageProps} />
    );
  }

  const [width, height] = size;
  const srcSet = [...variantWidths.filter((candidate) => candidate < width), width]
    .map((candidate) => `${src}.${candidate}w.webp ${candidate}w`)
    .join(', ');

  return (
    <picture>
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      <img
        src={src}
        width={width}
        height={height}
        loading={imageLoading}
        decoding={priority ? undefined : 'async'}
        {...priorityProps}
        {...imageProps}
      />
    </picture>
  );
}
