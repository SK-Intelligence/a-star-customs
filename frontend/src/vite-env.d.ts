/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Built by responsive-images.ts from public/images (see src/components/ResponsiveImage.tsx). */
declare module 'virtual:responsive-images' {
  /** Standard widths of the `<name>.<ext>.<width>w.webp` variants; each image also has one at its own width. */
  export const variantWidths: readonly number[];
  /** Intrinsic [width, height] of every raster image under public/images, keyed by its URL path. */
  export const imageSizes: Readonly<Record<string, readonly [number, number]>>;
}
