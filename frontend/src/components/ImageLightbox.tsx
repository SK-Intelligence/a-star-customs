import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface ImageLightboxProps {
  images: readonly string[];
  activeIndex: number | null;
  alt: string;
  onChange: (index: number) => void;
  onClose: () => void;
}

export function ImageLightbox({
  images,
  activeIndex,
  alt,
  onChange,
  onClose,
}: ImageLightboxProps) {
  const lightboxRef = useDialogFocus<HTMLDivElement>({
    isOpen: activeIndex !== null,
    onClose,
    initialFocusSelector: '.lightbox__close',
  });

  useEffect(() => {
    if (activeIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        onChange((activeIndex - 1 + images.length) % images.length);
      }
      if (event.key === 'ArrowRight') {
        onChange((activeIndex + 1) % images.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, images.length, onChange, onClose]);

  if (activeIndex === null || !images[activeIndex]) return null;

  return (
    <div ref={lightboxRef} className="lightbox" role="dialog" aria-modal="true" aria-label={`${alt} image viewer`} tabIndex={-1}>
      <button type="button" className="lightbox__close" onClick={onClose} aria-label="Close image viewer">
        <X aria-hidden="true" />
      </button>
      {images.length > 1 ? (
        <button
          type="button"
          className="lightbox__previous"
          onClick={() => onChange((activeIndex - 1 + images.length) % images.length)}
          aria-label="Previous image"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      ) : null}
      <img src={images[activeIndex]} alt={alt} />
      {images.length > 1 ? (
        <button
          type="button"
          className="lightbox__next"
          onClick={() => onChange((activeIndex + 1) % images.length)}
          aria-label="Next image"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
