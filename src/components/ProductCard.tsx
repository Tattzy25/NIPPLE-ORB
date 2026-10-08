import React from 'react';
import { ShoppingBag, Star, Check } from 'lucide-react';
import { RecommendedProductItem } from '../types';

interface ProductCardProps {
  product: RecommendedProductItem;
  onAddToCart?: (product: RecommendedProductItem) => void;
  layout?: 'grid' | 'carousel';
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  layout = 'grid',
}) => {
  const [added, setAdded] = React.useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdded(true);
    onAddToCart?.(product);
    setTimeout(() => setAdded(false), 2200);
  };

  const isCarousel = layout === 'carousel';

  return (
    <div
      className={`group relative bg-white border border-amber-100/80 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex ${
        isCarousel ? 'flex-col w-60 shrink-0' : 'flex-col'
      }`}
    >
      {/* Product Image */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-amber-50/50 mb-3">
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {product.compareAtPrice && product.compareAtPrice > product.price && (
          <span className="absolute top-2 left-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            Save {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="text-[11px] text-amber-700/80 font-medium mb-1 truncate">
              {product.tags.join(' · ')}
            </div>
          )}

          <h4 className="text-sm font-semibold text-stone-800 line-clamp-1 group-hover:text-amber-800 transition-colors">
            {product.title}
          </h4>

          <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
            {product.subtitle}
          </p>

          {/* Rating */}
          <div className="flex items-center gap-1 mt-2 text-xs text-stone-600">
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < Math.floor(product.rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-stone-300'
                  }`}
                />
              ))}
            </div>
            <span className="font-semibold text-[11px]">{product.rating}</span>
            <span className="text-stone-400 text-[10px]">({product.reviewsCount})</span>
          </div>
        </div>

        {/* Pricing & Add to Cart button */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-amber-50">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-stone-900">
              ${product.price.toFixed(2)}
            </span>
            {product.compareAtPrice && (
              <span className="text-xs text-stone-400 line-through">
                ${product.compareAtPrice.toFixed(2)}
              </span>
            )}
          </div>

          <button
            onClick={handleAdd}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${
              added
                ? 'bg-emerald-600 text-white shadow-emerald-200'
                : 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-white shadow-amber-200'
            }`}
          >
            {added ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Added
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                Shop
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
