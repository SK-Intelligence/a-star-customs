import { CatalogBrowser } from '../components/CatalogBrowser';
import { PageHero } from '../components/PageHero';
import { Seo } from '../components/Seo';
import { products } from '../data/catalog';

const customKits = products.filter((product) =>
  product.collections.some((collection) => ['DIY', 'Custom Fittings'].includes(collection)),
);

export function CustomKitsPage() {
  return (
    <>
      <Seo
        title="Custom Automotive Kits"
        description="Browse self-install and custom-fit ambient lighting, starlight and vehicle interior kits from A Star Customs."
      />
      <PageHero
        eyebrow="Build it your way"
        title="Custom kits for hands-on builds."
        description="Purpose-selected components and complete kits for enthusiasts who want to handle the installation themselves."
        image="/images/site/service-screen.webp"
      />
      <section className="section shop-section section--carbon">
        <div className="container">
          <div className="collection-intro">
            <p className="eyebrow">DIY & custom fittings</p>
            <h2>Workshop-grade parts, ready for your project.</h2>
            <p>Always confirm compatibility before ordering if your exact model is not listed.</p>
          </div>
          <CatalogBrowser
            source={customKits}
            showCategories={false}
            emptyMessage="Try a broader search or browse the complete shop."
          />
        </div>
      </section>
    </>
  );
}
