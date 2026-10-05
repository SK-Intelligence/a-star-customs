/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Built by responsive-images.ts from the images src/ references (see src/components/ResponsiveImage.tsx). */
declare module 'virtual:responsive-images' {
  /** Intrinsic width and height of an original, then the widths of its WebP candidates. */
  export type ImageEntry = readonly [width: number, height: number, widths: readonly number[]];
  /** Every referenced image under public/images, keyed by its URL path. */
  export const images: Readonly<Record<string, ImageEntry>>;
  /** The WebP srcset for one image (responsive-image-names.ts). */
  export function srcSetFor(src: string, entry: ImageEntry): string;
}
