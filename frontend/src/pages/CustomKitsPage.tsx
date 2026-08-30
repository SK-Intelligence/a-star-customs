import { CatalogBrowser } from '../components/CatalogBrowser';
import { PageHero } from '../components/PageHero';
import { Seo } from '../components/Seo';
import { products } from '../data/catalog';

const customKits = products.filter((product) => product.collections.includes('DIY'));

export function CustomKitsPage() {
  return (
    <>
      <Seo
        title="Custom Automotive Kits"
        description="Browse self-install and custom-fit ambient lighting, starlight and vehicle interior kits from A Star Customs."
      />
      <PageHero
        eyebrow="DIY & self-install kits"
        title="Kits for your own installation."
        description="Browse components and complete kits if you plan to fit the upgrade yourself."
        image="/images/products/starlight-fiber-optic-kit-01.jpg"
      />
      <section className="section shop-section section--carbon">
        <div className="container">
          <div className="collection-intro">
            <p className="eyebrow">DIY kits</p>
            <h2>Parts and kits for your project.</h2>
            <p>Always confirm compatibility before ordering if your exact model is not listed.</p>
          </div>
          <CatalogBrowser
            source={customKits}
            showCategories={false}
            emptyMessage="Try a broader search or browse the complete shop."
            returnLabel="custom kits"
          />
        </div>
      </section>
    </>
  );
}
