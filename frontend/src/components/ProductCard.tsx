import { ArrowRight, MessageCircle, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice, getProductAddOnOptions, isAddOnProduct, type Product } from '../data/catalog';
import { whatsappUrl } from '../data/site';
import { ResponsiveImage } from './ResponsiveImage';

interface ProductCardProps {
  product: Product;
  returnTo: string;
  returnLabel: string;
  /** The catalogue grid without the category sidebar (wider cards). */
  fullWidth?: boolean;
}

/**
 * Card width per breakpoint of .product-grid: 4 columns, 3 at 1200px and below, 2 at 760px, 1 at
 * 520px; beside the 250px category sidebar unless fullWidth (the sidebar stacks at 760px).
 */
const CARD_SIZES = [
  '(min-width: 1468px) 266px, (min-width: 1201px) calc(24vw - 86px), (min-width: 761px) calc(32vw - 110px)',
  '(min-width: 521px) calc(50vw - 24px), calc(100vw - 32px)',
].join(', ');
const FULL_WIDTH_CARD_SIZES = [
  '(min-width: 1468px) 343px, (min-width: 1201px) calc(25vw - 24px), (min-width: 761px) calc(33.4vw - 26px)',
  '(min-width: 521px) calc(50vw - 24px), calc(100vw - 32px)',
].join(', ');

export function ProductCard({ product, returnTo, returnLabel, fullWidth = false }: ProductCardProps) {
  const firstVariant = product.variants[0];
  const prices = product.variants.map((variant) => variant.price).filter((price) => price > 0);
  const minimumPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const hasPriceRange = new Set(prices).size > 1;
  const isAddOnOnly = isAddOnProduct(product);
  const supportsAddOns = getProductAddOnOptions(product).some((option) => option.isAvailable);

  return (
    <article className="product-card">
      <Link className="product-card__media" to={`/${product.slug}`} state={{ returnTo, returnLabel }}>
        {product.ribbonText ? <span className="product-ribbon">{product.ribbonText}</span> : null}
        <ResponsiveImage
          src={product.images[0] ?? '/images/site/hero.jpg'}
          alt={product.title}
          sizes={fullWidth ? FULL_WIDTH_CARD_SIZES : CARD_SIZES}
          coverAspect={1 / 1.05}
        />
        <span className="product-card__view">
          View details <ArrowRight aria-hidden="true" />
        </span>
      </Link>
      <div className="product-card__body">
        <div>
          <Link to={`/${product.slug}`} state={{ returnTo, returnLabel }}><h3>{product.title}</h3></Link>
          <p className="product-price">
            {minimumPrice > 0 ? `${hasPriceRange ? 'From ' : ''}${formatPrice(minimumPrice)}` : 'Custom quote'}
          </p>
        </div>
        {isAddOnOnly ? (
          <Link
            className="product-card__action"
            to={`/${product.slug}`}
            state={{ returnTo, returnLabel }}
            aria-label={`View add-on details for ${product.title}`}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span>View add-on</span>
          </Link>
        ) : product.purchasable && product.available && firstVariant ? (
          <Link
            className="product-card__action"
            to={`/${product.slug}`}
            state={{ returnTo, returnLabel }}
            aria-label={`${supportsAddOns ? 'View package options' : product.kind === 'upgrade' ? 'View upgrade' : 'View product'} for ${product.title}`}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span>{supportsAddOns ? 'View package options' : product.kind === 'upgrade' ? 'View upgrade' : 'View product'}</span>
          </Link>
        ) : (
          <a
            className="product-card__action"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Enquire about ${product.title}`}
          >
            <MessageCircle aria-hidden="true" />
            <span>Get a quote</span>
          </a>
        )}
      </div>
    </article>
  );
}
