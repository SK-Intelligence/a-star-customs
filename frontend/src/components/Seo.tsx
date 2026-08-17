import { useEffect } from 'react';

interface SeoProps {
  title: string;
  description: string;
}

export function Seo({ title, description }: SeoProps) {
  useEffect(() => {
    const fullTitle = `${title} | A Star Customs`;
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    document.title = fullTitle;
    let descriptionElement = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );

    if (!descriptionElement) {
      descriptionElement = document.createElement('meta');
      descriptionElement.name = 'description';
      document.head.append(descriptionElement);
    }

    descriptionElement.content = description;

    const upsertMeta = (property: string, content: string) => {
      let element = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('property', property);
        document.head.append(element);
      }
      element.content = content;
    };

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = canonicalUrl;
    upsertMeta('og:title', fullTitle);
    upsertMeta('og:description', description);
    upsertMeta('og:url', canonicalUrl);
    upsertMeta('og:type', 'website');
  }, [description, title]);

  return null;
}
