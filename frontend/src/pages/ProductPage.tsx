import { ArrowLeft, Check, MessageCircle, Plus, ShieldCheck, ShoppingBag, Sparkles, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ImageLightbox } from '../components/ImageLightbox';
import { ProductCard } from '../components/ProductCard';
import { QuantityControl } from '../components/QuantityControl';
import { ReviewPanel } from '../components/ReviewPanel';
import { Seo } from '../components/Seo';
import { formatPrice, getActiveAddOnDefinition, getProductAddOns, getProductAddOnOptions, productBySlug, products, type AvailableProductAddOnOption } from '../data/catalog';
import { whatsappUrl } from '../data/site';
import { useCartStore } from '../store/cart';
import { NotFoundPage } from './NotFoundPage';

export function ProductPage() {
  const { slug = '' } = useParams();
  const product = productBySlug.get(slug);
  const addItems = useCartStore((state) => state.addItems);
  const [variantId, setVariantId] = useState(product?.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    setVariantId(product?.variants[0]?.id ?? '');
    setQuantity(1);
    setSelectedAddOnIds([]);
    setImageIndex(0);
  }, [product?.id, product?.variants]);

  const selectedVariant = product?.variants.find((variant) => variant.id === variantId) ?? product?.variants[0];
  const activeAddOnDefinition = product ? getActiveAddOnDefinition(product) : undefined;
  const addOnOptions = useMemo(() => (product ? getProductAddOnOptions(product) : []), [product]);
  const selectedAddOns = addOnOptions.filter(
    (option): option is AvailableProductAddOnOption =>
      option.isAvailable && selectedAddOnIds.includes(option.definition.id),
  );
  const related = useMemo(() => {
    if (!product) return [];
    const addOnIds = new Set(getProductAddOns(product).map((addOn) => addOn.id));
    return products
      .filter(
        (candidate) =>
          candidate.id !== product.id &&
          !addOnIds.has(candidate.id) &&
          candidate.collections.some((collection) => product.collections.includes(collection)),
      )
      .slice(0, 4);
  }, [product]);

  if (!product || !selectedVariant) return <NotFoundPage />;

  const activeImage = product.images[imageIndex] ?? product.images[0] ?? '/images/site/hero.jpg';
  const canBuy =
    product.purchasable &&
    product.available &&
    selectedVariant.available &&
    activeAddOnDefinition === undefined;
  const addOnTotal = selectedAddOns.reduce(
    (total, { variant }) => total + (variant?.price ?? 0),
    0,
  );
  const buildTotal = (selectedVariant.price + addOnTotal) * quantity;

  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOnIds((current) =>
      current.includes(addOnId)
        ? current.filter((id) => id !== addOnId)
        : [...current, addOnId],
    );
  };

  const addBuildToBag = () => {
    if (addOnOptions.length === 0) {
      addItems([{
        productId: product.id,
        variantId: selectedVariant.id,
        quantity,
        lineType: 'standalone',
      }]);
      return;
    }

    const buildId = crypto.randomUUID();
    addItems([
      { productId: product.id, variantId: selectedVariant.id, quantity, buildId, lineType: 'base' },
      ...selectedAddOns.flatMap(({ product: addOn, variant }) => {
        return addOn && variant
          ? [{ productId: addOn.id, variantId: variant.id, quantity, buildId, lineType: 'addon' as const }]
          : [];
      }),
    ]);
  };

  return (
    <>
      <Seo
        title={product.title}
        description={product.subtitle ?? `Explore ${product.title} from A Star Customs.`}
      />
      <section className="product-page section--carbon">
        <div className="container">
          <Link className="back-link" to="/shop"><ArrowLeft aria-hidden="true" /> Back to shop</Link>
          <div className="product-detail">
            <div className="product-gallery">
              <button className="product-gallery__main" type="button" onClick={() => setLightboxIndex(imageIndex)}>
                {product.ribbonText ? <span className="product-ribbon">{product.ribbonText}</span> : null}
                <img src={activeImage} alt={product.title} />
                <span>Click to expand</span>
              </button>
              {product.images.length > 1 ? (
                <div className="product-thumbnails">
                  {product.images.map((image, index) => (
                    <button
                      type="button"
                      key={image}
                      className={imageIndex === index ? 'is-active' : undefined}
                      onClick={() => setImageIndex(index)}
                      aria-label={`Show ${product.title} image ${index + 1}`}
                    >
                      <img src={image} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="product-buybox" data-floating-action-zone>
              <p className="eyebrow">{product.collections[0] ?? 'A Star Customs'}</p>
              <h1>{product.title}</h1>
              {product.subtitle ? <p className="product-buybox__subtitle">{product.subtitle}</p> : null}
              <strong className="product-buybox__price">
                {selectedVariant.price > 0 ? formatPrice(selectedVariant.price) : 'Custom quote'}
              </strong>

              {product.variants.length > 1 ? (
                <fieldset className="variant-picker">
                  <legend>{product.purchasable ? 'Choose an option' : 'Available options'}</legend>
                  <div>
                    {product.variants.map((variant) => (
                      <button
                        type="button"
                        key={variant.id}
                        className={variant.id === selectedVariant.id ? 'is-active' : undefined}
                        onClick={() => setVariantId(variant.id)}
                        aria-pressed={variant.id === selectedVariant.id}
                        disabled={!variant.available}
                      >
                        <span>{variant.title}</span>
                        <strong>{formatPrice(variant.price)}</strong>
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {canBuy && addOnOptions.length > 0 ? (
                <section className="build-extras" aria-labelledby="build-extras-title">
                  <div className="build-extras__heading">
                    <div>
                      <p className="eyebrow">Build your package</p>
                      <h2 id="build-extras-title">Optional extras</h2>
                    </div>
                    <span>{addOnOptions.filter(({ definition }) => definition.status === 'active').length} available</span>
                  </div>
                  <p>Tap any available extra to add or remove it. Each add-on remains removable in your bag.</p>
                  <div className="build-extras__options">
                    {addOnOptions.map((option) => {
                      const { definition, product: addOn } = option;
                      const isSelected = option.isAvailable && selectedAddOnIds.includes(definition.id);
                      const AddOnIcon = isSelected ? Check : Plus;

                      return (
                        <button
                          type="button"
                          key={definition.id}
                          className={`${isSelected ? 'build-extra is-selected' : 'build-extra'}${option.isAvailable ? '' : ' is-disabled'}`}
                          aria-pressed={isSelected}
                          onClick={() => toggleAddOn(definition.id)}
                          disabled={!option.isAvailable}
                        >
                          {addOn ? <img src={addOn.images[0] ?? '/images/site/hero.jpg'} alt="" /> : <Sparkles aria-hidden="true" />}
                          <span>
                            <small>{option.isAvailable ? 'Optional add-on' : 'Coming soon'}</small>
                            <strong>{definition.label}</strong>
                            <span>{definition.description}</span>
                            <em>{option.isAvailable ? `+${formatPrice(option.variant.price)} per build` : 'Pricing to be confirmed'}</em>
                          </span>
                          <i aria-hidden="true">{option.isAvailable ? <AddOnIcon /> : null}</i>
                        </button>
                      );
                    })}
                  </div>
                  <dl className="build-total" aria-live="polite">
                    <div><dt>Base package</dt><dd>{formatPrice(selectedVariant.price * quantity)}</dd></div>
                    <div><dt>Extras ({selectedAddOns.length})</dt><dd>+{formatPrice(addOnTotal * quantity)}</dd></div>
                    <div><dt>Build total</dt><dd>{formatPrice(buildTotal)}</dd></div>
                  </dl>
                </section>
              ) : null}

              {canBuy ? (
                <div className="buy-actions">
                  <QuantityControl value={quantity} onChange={setQuantity} />
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={addBuildToBag}
                  >
                    <ShoppingBag aria-hidden="true" />
                    {addOnOptions.length > 0 ? `Add build to bag · ${formatPrice(buildTotal)}` : 'Add to bag'}
                  </button>
                </div>
              ) : activeAddOnDefinition ? (
                <div className="custom-quote-box">
                  <Plus aria-hidden="true" />
                  <div>
                    <h2>Add this to a compatible package.</h2>
                    <p>Choose a compatible ambient lighting package, then select this extra from that product page.</p>
                  </div>
                  <Link className="button button--primary" to="/shop">
                    Browse compatible packages
                  </Link>
                </div>
              ) : (
                <div className="custom-quote-box">
                  <Sparkles aria-hidden="true" />
                  <div>
                    <h2>Contact us before ordering.</h2>
                    <p>Contact the workshop before ordering so we can confirm specification and price.</p>
                  </div>
                  <a className="button button--primary" href={whatsappUrl} target="_blank" rel="noreferrer">
                    <MessageCircle aria-hidden="true" /> Discuss this build
                  </a>
                </div>
              )}

              <div className="buybox-trust">
                <span><ShieldCheck aria-hidden="true" /> One-year workmanship warranty</span>
                <span><Wrench aria-hidden="true" /> Professional fitting available</span>
                <span><Check aria-hidden="true" /> Compatibility confirmed before fitting</span>
              </div>
            </div>
          </div>

          <div className="product-description">
            <div>
              <p className="eyebrow">What’s included</p>
              <h2>Product details</h2>
            </div>
            <div className="rich-text" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
          </div>

          {related.length > 0 ? (
            <section className="related-products">
              <div className="section-heading">
                <p className="eyebrow">You may also need</p>
                <h2>Other products for your car.</h2>
              </div>
              <div className="product-grid">
                {related.map((item) => <ProductCard product={item} key={item.id} />)}
              </div>
            </section>
          ) : null}

          <ReviewPanel productId={product.id} />
        </div>
      </section>
      <ImageLightbox
        images={product.images}
        activeIndex={lightboxIndex}
        alt={product.title}
        onChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}
