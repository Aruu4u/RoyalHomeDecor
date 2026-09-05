import { memo, useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { hasOffer, resolveProductPricing } from "../../lib/pricing";
import { loadProduct } from "../../services/catalogueCache";
import type { Product } from "../../types/product";
import SmartImage from "../ui/SmartImage";
import DiscountFlag from "./DiscountFlag";
import FavouriteButton from "./FavouriteButton";
import PriceTag from "./PriceTag";

interface ProductCardProps {
  product: Product;

  /** Name of the product's collection, shown above the title. */
  collectionName?: string;

  /** Above-the-fold cards load their image eagerly. */
  priority?: boolean;

  /** "New" ribbon, driven by created_at on the listing pages. */
  isNew?: boolean;

  onFeedback?: (message: string, isError: boolean) => void;
}

const NO_STOCK_MESSAGE = "This piece is currently out of stock.";

function ProductCard({
  product,
  collectionName,
  priority = false,
  isNew = false,
  onFeedback,
}: ProductCardProps) {
  const navigate = useNavigate();

  const { session } = useAuth();
  const { addItem } = useCart();

  const [isAdding, setIsAdding] = useState(false);

  const productPath = `/products/${product.slug}`;

  /*
   * Offer pricing comes from the API, which already resolved the better
   * of the product's own offer and any active offer section, and excluded
   * anything past its end date.
   */
  const pricing = resolveProductPricing(product);
  const onOffer = hasOffer(pricing);

  /*
   * Stock is summed across the product's active variants by the server.
   * The list endpoint sends no variants, so this flag is the only thing a
   * card can go on.
   */
  const isSoldOut = !product.in_stock;

  /* Nudges a shopper without inventing urgency: only shown under five. */
  const isLowStock =
    product.in_stock &&
    product.available_quantity > 0 &&
    product.available_quantity <= 5;

  /*
   * The list endpoint returns no variants, so a quick add has to fetch the
   * detail record first. When a product has a single purchasable variant we
   * add it straight away; anything more nuanced sends the shopper to the
   * product page so they can pick deliberately.
   */
  const handleQuickAdd = useCallback(async () => {
    /*
     * Belt and braces. The button is disabled when sold out, but a stale
     * card could still be clicked between a stock change and a refetch,
     * and the fetch below costs a round trip to reach the same answer.
     */
    if (isSoldOut) {
      onFeedback?.(NO_STOCK_MESSAGE, true);
      return;
    }

    if (!session) {
      navigate("/login", { state: { from: { pathname: productPath } } });
      return;
    }

    setIsAdding(true);

    try {
      const details = await loadProduct(product.slug);

      const purchasableVariants = details.variants.filter(
        (variant) =>
          variant.is_active &&
          (variant.inventory?.available_quantity ?? 0) > 0,
      );

      if (purchasableVariants.length === 0) {
        onFeedback?.(NO_STOCK_MESSAGE, true);
        return;
      }

      if (purchasableVariants.length > 1) {
        navigate(productPath);
        return;
      }

      await addItem(purchasableVariants[0].id, 1);

      onFeedback?.(`${product.name} was added to your cart.`, false);
    } catch (error) {
      onFeedback?.(
        error instanceof Error
          ? error.message
          : "Unable to add this piece to your cart.",
        true,
      );
    } finally {
      setIsAdding(false);
    }
  }, [
    addItem,
    isSoldOut,
    navigate,
    onFeedback,
    product.name,
    product.slug,
    productPath,
    session,
  ]);

  return (
    <article
      className={isSoldOut ? "product-card is-sold-out" : "product-card"}
    >
      <div className="product-card-media">
        <Link
          aria-label={`View ${product.name}`}
          className="product-card-media-link"
          to={productPath}
        >
          <SmartImage
            alt={product.name}
            priority={priority}
            ratio="4 / 5"
            sizes="(max-width: 560px) 78vw, (max-width: 880px) 45vw, 300px"
            src={product.thumbnail_url}
          />
        </Link>

        {/*
          Sold out is stated over the image as well as on the button.
          A greyed-out button alone reads as a loading state; a shopper
          needs to know why before they reach for it.
        */}
        {isSoldOut && (
          <div aria-hidden="true" className="product-card-soldout">
            <span className="product-card-soldout-label">Out of stock</span>
          </div>
        )}

        <div className="product-card-labels">
          {onOffer && (
            <DiscountFlag
              discountPercent={pricing.discountPercent}
              label={pricing.label}
            />
          )}

          {product.is_recommended && (
            <span className="badge badge-gold">Recommended</span>
          )}

          {isNew && <span className="badge badge-ink">New</span>}

          {isLowStock && (
            <span className="badge badge-warning">
              Only {product.available_quantity} left
            </span>
          )}
        </div>

        <div className="product-card-tools">
          <FavouriteButton
            productId={product.id}
            productName={product.name}
            onResult={onFeedback}
          />
        </div>

        <div className="product-card-quick">
          {/*
            `disabled` makes the button genuinely unclickable rather than
            merely styled that way: it stops pointer events, removes it
            from the tab order, and screen readers announce it as
            unavailable. The wording says why, so nobody is left guessing
            at a dimmed control.
          */}
          <button
            className="product-card-add"
            disabled={isAdding || isSoldOut}
            onClick={() => void handleQuickAdd()}
            title={isSoldOut ? NO_STOCK_MESSAGE : undefined}
            type="button"
          >
            {isSoldOut
              ? "Out of stock"
              : isAdding
                ? "Adding..."
                : "Add to cart"}
          </button>
        </div>
      </div>

      <div className="product-card-body">
        {(collectionName || product.style) && (
          <p className="product-card-meta">
            {collectionName ?? product.style}
          </p>
        )}

        <h3 className="product-card-title">
          <Link to={productPath}>{product.name}</Link>
        </h3>

        <PriceTag pricing={pricing} />

        {/* Only shown once a piece has been reviewed, never as "0 (0)". */}
        {product.review_count > 0 && product.review_average !== null && (
          <p className="product-card-rating">
            <span
              aria-hidden="true"
              className="product-card-rating-stars"
              style={{
                ["--rating-fill" as string]: `${
                  (product.review_average / 5) * 100
                }%`,
              }}
            >
              <span className="product-card-rating-empty">
                {"\u2605\u2605\u2605\u2605\u2605"}
              </span>
              <span className="product-card-rating-filled">
                {"\u2605\u2605\u2605\u2605\u2605"}
              </span>
            </span>

            <span className="product-card-rating-text">
              {product.review_average.toFixed(1)}
              <span className="product-card-rating-count">
                ({product.review_count})
              </span>
            </span>
          </p>
        )}
      </div>
    </article>
  );
}

/*
 * Listing pages render many cards and re-render on filter changes.
 * Memoising keeps the DOM work proportional to what actually changed.
 */
export default memo(ProductCard);
