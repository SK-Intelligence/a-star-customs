import { Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productMinimumPrice, shopCategories, type Product } from '../data/catalog';
import { ProductCard } from './ProductCard';

type SortMode = 'price-asc' | 'price-desc' | 'recent';

interface CatalogBrowserProps {
  source: readonly Product[];
  showCategories?: boolean;
  emptyMessage?: string;
}

const PAGE_SIZE = 20;

export function CatalogBrowser({
  source,
  showCategories = true,
  emptyMessage = 'No products match those filters yet.',
}: CatalogBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('price-asc');
  const [page, setPage] = useState(1);
  const requestedCategory = searchParams.get('category');
  const sourceCategories = shopCategories.filter((category) => source.some(category.matches));
  const selectedCategory = sourceCategories.find(({ label }) => label === requestedCategory);
  const activeCategory = selectedCategory?.label ?? 'All products';

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const items = source.filter((product) => {
      const categoryMatches =
        !selectedCategory || selectedCategory.matches(product);
      const queryMatches =
        !needle ||
        `${product.title} ${product.subtitle ?? ''} ${product.collections.join(' ')}`
          .toLocaleLowerCase()
          .includes(needle);
      return categoryMatches && queryMatches;
    });

    return [...items].sort((left, right) => {
      if (sort === 'price-desc') return productMinimumPrice(right) - productMinimumPrice(left);
      if (sort === 'recent') {
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }
      const leftPrice = productMinimumPrice(left) || Number.POSITIVE_INFINITY;
      const rightPrice = productMinimumPrice(right) || Number.POSITIVE_INFINITY;
      return leftPrice - rightPrice;
    });
  }, [query, selectedCategory, sort, source]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const chooseCategory = (category: string) => {
    const next = new URLSearchParams(searchParams);
    if (category === 'All products') next.delete('category');
    else next.set('category', category);
    setSearchParams(next);
    setPage(1);
  };

  return (
    <div className={showCategories ? 'catalog-layout' : 'catalog-layout catalog-layout--full'}>
      {showCategories ? (
        <aside className="catalog-categories">
          <p className="eyebrow">Browse by</p>
          <h2>Categories</h2>
          <div>
            {['All products', ...sourceCategories.map(({ label }) => label)].map((category) => (
              <button
                type="button"
                key={category}
                className={activeCategory === category ? 'is-active' : undefined}
                onClick={() => chooseCategory(category)}
              >
                {category}
                <span>
                  {category === 'All products'
                    ? source.length
                    : source.filter(
                        sourceCategories.find(({ label }) => label === category)?.matches ?? (() => false),
                      ).length}
                </span>
              </button>
            ))}
          </div>
          <label className="catalog-category-select">
            <SlidersHorizontal aria-hidden="true" />
            <span className="sr-only">Choose a product category</span>
            <select value={activeCategory} onChange={(event) => chooseCategory(event.target.value)}>
              <option value="All products">All products ({source.length})</option>
              {sourceCategories.map((category) => (
                <option value={category.label} key={category.label}>
                  {category.label} ({source.filter(category.matches).length})
                </option>
              ))}
            </select>
          </label>
        </aside>
      ) : null}

      <div className="catalog-results">
        <div className="catalog-toolbar">
          <label className="search-field">
            <Search aria-hidden="true" />
            <span className="sr-only">Search products</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search products"
            />
          </label>
          <label className="sort-field">
            <SlidersHorizontal aria-hidden="true" />
            <span className="sr-only">Sort products</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortMode);
                setPage(1);
              }}
            >
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="recent">Most recent</option>
            </select>
          </label>
        </div>

        <div className="catalog-meta">
          <div>
            <p className="eyebrow">{activeCategory}</p>
            <h2>{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</h2>
          </div>
          {query ? <span>Results for “{query}”</span> : null}
        </div>

        {visible.length > 0 ? (
          <div className="product-grid">
            {visible.map((product) => <ProductCard product={product} key={product.id} />)}
          </div>
        ) : (
          <div className="empty-results">
            <Search aria-hidden="true" />
            <h3>Nothing found</h3>
            <p>{emptyMessage}</p>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                setQuery('');
                chooseCategory('All products');
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {pageCount > 1 ? (
          <nav className="pagination" aria-label="Product pages">
            <button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
              Previous
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
              <button
                type="button"
                key={number}
                className={safePage === number ? 'is-active' : undefined}
                aria-current={safePage === number ? 'page' : undefined}
                onClick={() => setPage(number)}
              >
                {number}
              </button>
            ))}
            <button type="button" disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)}>
              Next
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
