import { ArrowLeft, ArrowRight, Check, MessageCircle, Plus, ShieldCheck, ShoppingBag, Sparkles, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ImageLightbox } from '../components/ImageLightbox';
import { QuantityControl } from '../components/QuantityControl';
import { ReviewPanel } from '../components/ReviewPanel';
import { Seo } from '../components/Seo';
import { formatPrice, getDiscoveryProducts, getProductAddOnOptions, isAddOnProduct, productBySlug, type AvailableProductAddOnOption } from '../data/catalog';
import { whatsappUrl } from '../data/site';
import { useCartStore } from '../store/cart';
import { NotFoundPage } from './NotFoundPage';

export function ProductPage() {
  const { slug = '' } = useParams();
  const product = productBySlug.get(slug);
  const addItem = useCartStore((state) => state.addItem);
  const addItems = useCartStore((state) => state.addItems);
  const [variantId, setVariantId] = useState(product?.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 761px)').matches,
  );

  useEffect(() => {
    setVariantId(product?.variants[0]?.id ?? '');
    setQuantity(1);
    setSelectedAddOnIds([]);
    setImageIndex(0);
  }, [product?.id, product?.variants]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 761px)');
    const syncDisclosure = () => setDiscoveryOpen(media.matches);
    syncDisclosure();
    media.addEventListener('change', syncDisclosure);
    return () => media.removeEventListener('change', syncDisclosure);
  }, [product?.id]);

  const selectedVariant = product?.variants.find((variant) => variant.id === variantId) ?? product?.variants[0];
  const addOnOnly = product ? isAddOnProduct(product) : false;
  const addOnOptions = useMemo(() => (product ? getProductAddOnOptions(product) : []), [product]);
  const availableAddOnOptions = addOnOptions.filter(
    (option): option is AvailableProductAddOnOption => option.isAvailable,
  );
  const selectedAddOns = addOnOptions.filter(
    (option): option is AvailableProductAddOnOption =>
      option.isAvailable && selectedAddOnIds.includes(option.definition.id),
  );
  const discoveryProducts = useMemo(
    () => (product ? getDiscoveryProducts(product) : []),
    [product],
  );

  if (!product || !selectedVariant) return <NotFoundPage />;

  const activeImage = product.images[imageIndex] ?? product.images[0] ?? '/images/site/hero.jpg';
  const canBuy =
    product.purchasable &&
    product.available &&
    selectedVariant.available &&
    !addOnOnly;
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
    if (availableAddOnOptions.length === 0) {
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
                <img src={activeImage} alt={product.title} loading="eager" decoding="async" />
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
                      <img src={image} alt="" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="product-buybox" data-floating-action-zone>
              <p className="eyebrow">{product.collections[0] ?? 'A Star Customs'}</p>
              <h1>{product.title}</h1>
              {product.subtitle ? <p className="product-buybox__subtitle">{product.subtitle}</p> : null}
              <p className={`product-fitment product-fitment--${product.fitment.mode}`}>
                <ShieldCheck aria-hidden="true" />
                <span><strong>Fitment</strong>{product.fitment.label}</span>
              </p>
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

              {canBuy && availableAddOnOptions.length > 0 ? (
                <section className="build-extras" aria-labelledby="build-extras-title">
                  <div className="build-extras__heading">
                    <div>
                      <p className="eyebrow">Build your package</p>
                      <h2 id="build-extras-title">Personalise your package</h2>
                    </div>
                    <span>{availableAddOnOptions.length} options</span>
                  </div>
                  {availableAddOnOptions.length > 0 ? (
                    <>
                      <div className="build-extras__subheading">
                        <h3>Optional add-ons</h3>
                        <p>Choose any extras you would like with this product. We confirm final fitment before installation.</p>
                      </div>
                      <div className="build-extras__options">
                        {availableAddOnOptions.map((option) => {
                          const { definition, product: addOn } = option;
                          const isSelected = selectedAddOnIds.includes(definition.id);
                          const AddOnIcon = isSelected ? Check : Plus;

                          return (
                            <button
                              type="button"
                              key={definition.id}
                              className={isSelected ? 'build-extra is-selected' : 'build-extra'}
                              aria-pressed={isSelected}
                              onClick={() => toggleAddOn(definition.id)}
                            >
                              {addOn ? (
                                <img
                                  src={addOn.images[0] ?? '/images/site/hero.jpg'}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : <Sparkles aria-hidden="true" />}
                              <span>
                                <small>Optional extra</small>
                                <strong>{definition.label}</strong>
                                <span>{definition.description}</span>
                                <em>+{formatPrice(option.variant.price)} per build</em>
                              </span>
                              <i aria-hidden="true"><AddOnIcon /></i>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                  {availableAddOnOptions.length > 0 ? (
                    <dl className="build-total" aria-live="polite">
                      <div><dt>Base package</dt><dd>{formatPrice(selectedVariant.price * quantity)}</dd></div>
                      <div><dt>Extras ({selectedAddOns.length})</dt><dd>+{formatPrice(addOnTotal * quantity)}</dd></div>
                      <div><dt>Build total</dt><dd>{formatPrice(buildTotal)}</dd></div>
                    </dl>
                  ) : null}
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
                    {availableAddOnOptions.length > 0 ? `Add build to bag · ${formatPrice(buildTotal)}` : 'Add to bag'}
                  </button>
                </div>
              ) : addOnOnly ? (
                <div className="custom-quote-box">
                  <Plus aria-hidden="true" />
                  <div>
                    <h2>Add this to a base package.</h2>
                    <p>Choose any product not labelled “Add-On”, then select this extra from its product page.</p>
                  </div>
                  <Link className="button button--primary" to="/shop">
                    Browse base packages
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

          {discoveryProducts.length > 0 ? (
            <section className="product-discovery" aria-labelledby="product-discovery-title">
              <details
                open={discoveryOpen}
                onToggle={(event) => setDiscoveryOpen(event.currentTarget.open)}
              >
                <summary>
                  <span>
                    <strong id="product-discovery-title">If you’re interested</strong>
                    <small>Compatible upgrades and fitment-confirmed services</small>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </summary>
                <div className="product-discovery__grid">
                  {discoveryProducts.map((item) => {
                    const variant = item.variants.find((candidate) => candidate.available && candidate.price > 0);
                    return (
                      <article className="discovery-offer" key={item.id}>
                        <Link to={`/${item.slug}`} className="discovery-offer__media">
                          <img
                            src={item.images[0] ?? '/images/site/hero.jpg'}
                            alt={item.title}
                            loading="lazy"
                            decoding="async"
                          />
                        </Link>
                        <div>
                          <small>{item.kind === 'upgrade' ? 'Standalone upgrade' : 'You may also like'}</small>
                          <Link to={`/${item.slug}`}><strong>{item.title}</strong></Link>
                          <span>{variant ? formatPrice(variant.price) : 'Custom quote'}</span>
                          {variant ? (
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => addItem(item.id, variant.id)}
                            >
                              <Plus aria-hidden="true" /> Add to bag
                            </button>
                          ) : (
                            <Link className="text-link" to={`/${item.slug}`}>View details <ArrowRight aria-hidden="true" /></Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </details>
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
