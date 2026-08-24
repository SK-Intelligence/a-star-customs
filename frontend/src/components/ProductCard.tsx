import { ArrowRight, MessageCircle, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice, getActiveAddOnDefinition, type Product } from '../data/catalog';
import { whatsappUrl } from '../data/site';
import { useCartStore } from '../store/cart';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const firstVariant = product.variants[0];
  const prices = product.variants.map((variant) => variant.price).filter((price) => price > 0);
  const minimumPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const hasPriceRange = new Set(prices).size > 1;
  const isAddOnOnly = getActiveAddOnDefinition(product) !== undefined;

  return (
    <article className="product-card">
      <Link className="product-card__media" to={`/${product.slug}`}>
        {product.ribbonText ? <span className="product-ribbon">{product.ribbonText}</span> : null}
        <img src={product.images[0] ?? '/images/site/hero.jpg'} alt={product.title} loading="lazy" />
        <span className="product-card__view">
          View details <ArrowRight aria-hidden="true" />
        </span>
      </Link>
      <div className="product-card__body">
        <div>
          <Link to={`/${product.slug}`}><h3>{product.title}</h3></Link>
          <p className="product-price">
            {minimumPrice > 0 ? `${hasPriceRange ? 'From ' : ''}${formatPrice(minimumPrice)}` : 'Custom quote'}
          </p>
        </div>
        {isAddOnOnly ? (
          <Link
            className="product-card__action"
            to={`/${product.slug}`}
            aria-label={`View add-on details for ${product.title}`}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span>View add-on</span>
          </Link>
        ) : product.purchasable && product.available && firstVariant && product.variants.length > 1 ? (
          <Link
            className="product-card__action"
            to={`/${product.slug}`}
            aria-label={`Choose an option for ${product.title}`}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span>Choose options</span>
          </Link>
        ) : product.purchasable && product.available && firstVariant ? (
          <button
            type="button"
            className="product-card__action"
            onClick={() => addItem(product.id, firstVariant.id)}
            aria-label={`Add ${product.title} to bag`}
          >
            <ShoppingBag aria-hidden="true" />
            <span>Add to bag</span>
          </button>
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
