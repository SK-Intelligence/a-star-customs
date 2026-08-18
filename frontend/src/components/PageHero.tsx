interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  image?: string;
}

export function PageHero({ eyebrow, title, description, image }: PageHeroProps) {
  return (
    <section
      className="page-hero"
      style={image ? { '--page-hero-image': `url(${image})` } as React.CSSProperties : undefined}
    >
      <div className="container page-hero__content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
