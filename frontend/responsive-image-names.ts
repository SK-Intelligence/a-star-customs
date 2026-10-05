// Names and widths of the responsive WebP variants. Imported by responsive-images.ts (build and
// dev server) and re-exported to the browser by its `virtual:responsive-images` module, so the
// files the build writes and the srcset ResponsiveImage emits come from the same code.

/** Intrinsic width and height of an original, then the widths of its WebP candidates. */
export type ImageEntry = readonly [width: number, height: number, widths: readonly number[]];

export const VARIANT_WIDTHS: readonly number[] = [160, 320, 480, 640, 768, 960, 1280];

/** Candidate widths for an original: every standard width below its own, then its own width. */
export function widthsFor(width: number): number[] {
  return [...VARIANT_WIDTHS.filter((candidate) => candidate < width), width];
}

/** A WebP original is itself the candidate at its own width; no copy of it is written. */
export function isOriginalCandidate(src: string, width: number, intrinsicWidth: number): boolean {
  return width === intrinsicWidth && /\.webp$/i.test(src);
}

/** `/images/a/b.jpg` -> `/images/a/b.jpg.640w.webp`: keeping the extension keeps names unique. */
export function variantUrl(src: string, width: number): string {
  return `${src}.${width}w.webp`;
}

export function candidateUrl(src: string, width: number, intrinsicWidth: number): string {
  return isOriginalCandidate(src, width, intrinsicWidth) ? src : variantUrl(src, width);
}

export function srcSetFor(src: string, [intrinsicWidth, , widths]: ImageEntry): string {
  return widths.map((width) => `${candidateUrl(src, width, intrinsicWidth)} ${width}w`).join(', ');
}
