import { CatalogBrowser } from '../components/CatalogBrowser';
import { PageHero } from '../components/PageHero';
import { Seo } from '../components/Seo';
import { products } from '../data/catalog';

export function ShopPage() {
  return (
    <>
      <Seo
        title="Shop Automotive Upgrades"
        description="Shop A Star Customs lighting, starlight, screen, dashcam, wheel and interior upgrade packages with secure Stripe-ready checkout."
      />
      <PageHero
        eyebrow="37 proven upgrades"
        title="Find the right detail for your build."
        description="Shop ready-to-order products and fitted packages. Products marked custom quote must be discussed with the workshop before ordering."
        image="/images/site/gallery-stars-01.jpg"
      />
      <section className="section shop-section section--carbon">
        <div className="container">
          <CatalogBrowser source={products} />
        </div>
      </section>
    </>
  );
}

