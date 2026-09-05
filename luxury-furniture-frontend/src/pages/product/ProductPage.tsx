import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import ServiceNotice from "../../components/error/ServiceNotice";
import FavouriteButton from "../../components/product/FavouriteButton";
import PriceTag from "../../components/product/PriceTag";
import ProductCard from "../../components/product/ProductCard";
import ProductReviews from "../../components/product/ProductReviews";
import StarRating from "../../components/product/StarRating";
import Carousel from "../../components/ui/Carousel";
import { ErrorState, PageLoader } from "../../components/ui/Feedback";
import QuantityStepper from "../../components/ui/QuantityStepper";
import Reveal from "../../components/ui/Reveal";
import SectionHeading from "../../components/ui/SectionHeading";
import SmartImage from "../../components/ui/SmartImage";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { useCollections, useProduct, useProducts } from "../../hooks/useCatalogue";
import { formatPrice } from "../../lib/currency";
import { resolveVariantPricing } from "../../lib/pricing";
import { invalidateProduct } from "../../services/catalogueCache";
import type { ProductVariant } from "../../types/product";

import "../../components/product/reviews.css";
import "./product-page.css";

interface StockState {
  label: string;
  tone: "success" | "warning" | "danger";
  available: number;
}

function readStock(variant: ProductVariant | null): StockState {
  const inventory = variant?.inventory ?? null;
  const available = inventory?.available_quantity ?? 0;

  if (!variant || !variant.is_active || available <= 0) {
    return { label: "Out of stock", tone: "danger", available: 0 };
  }

  if (available <= (inventory?.low_stock_threshold ?? 0)) {
    return {
      label: `Only ${available} left in stock`,
      tone: "warning",
      available,
    };
  }

  return { label: "In stock, ready to ship", tone: "success", available };
}

/** Numeric dimension fields arrive as strings from the API. */
function formatDimensions(variant: ProductVariant): string | null {
  const parts = [variant.length_cm, variant.width_cm, variant.height_cm]
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value).toFixed(0));

  if (parts.length === 0) {
    return null;
  }

  return `${parts.join(" \u00D7 ")} cm`;
}

function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { session } = useAuth();
  const { addItem, isMutating } = useCart();

  const { data: product, isLoading, error, errorKind, reload } =
    useProduct(slug);
  const { data: collections } = useCollections();

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);

  /* Reset selection whenever a different product loads. */
  useEffect(() => {
    setActiveImageIndex(0);
    setQuantity(1);
    setFeedback(null);

    if (!product) {
      setSelectedVariantId(null);
      return;
    }

    /* Preselect the first variant that can actually be bought. */
    const firstPurchasable = product.variants.find(
      (variant) =>
        variant.is_active && (variant.inventory?.available_quantity ?? 0) > 0,
    );

    setSelectedVariantId(
      firstPurchasable?.id ?? product.variants[0]?.id ?? null,
    );
  }, [product]);

  const selectedVariant = useMemo(
    () =>
      product?.variants.find((variant) => variant.id === selectedVariantId) ??
      null,
    [product, selectedVariantId],
  );

  const stock = readStock(selectedVariant);

  /* Clamp quantity when switching to a variant with less stock. */
  useEffect(() => {
    setQuantity((current) =>
      stock.available > 0 ? Math.min(current, stock.available) : 1,
    );
  }, [stock.available]);

  const collection = useMemo(
    () =>
      (collections ?? []).find(
        (candidate) => candidate.id === product?.collection_id,
      ) ?? null,
    [collections, product?.collection_id],
  );

  /* Related pieces from the same collection, minus the current product. */
  const { data: relatedRaw } = useProducts(
    useMemo(
      () => ({
        collectionId: product?.collection_id ?? null,
        limit: 10,
      }),
      [product?.collection_id],
    ),
  );

  const related = useMemo(
    () =>
      (relatedRaw ?? [])
        .filter((candidate) => candidate.id !== product?.id)
        .slice(0, 8),
    [relatedRaw, product?.id],
  );

  const images = product?.images ?? [];
  const activeImage = images[activeImageIndex] ?? images[0] ?? null;

  const displayPrice = selectedVariant
    ? selectedVariant.price_paise
    : product?.base_price_paise ?? 0;

  /*
   * Pricing follows the selected variant, so switching size updates both
   * the charged figure and the saving. The percentage comes from the API.
   */
  const pricing = resolveVariantPricing(
    displayPrice,
    product ?? { base_price_paise: displayPrice },
  );

  async function handleAddToCart(): Promise<void> {
    if (!session) {
      navigate("/login", {
        state: { from: { pathname: `/products/${slug ?? ""}` } },
      });
      return;
    }

    if (!selectedVariant || stock.available <= 0) {
      return;
    }

    try {
      await addItem(selectedVariant.id, quantity);

      setFeedback({
        message: `Added ${quantity} \u00D7 ${product?.name ?? "item"} to your cart.`,
        isError: false,
      });
    } catch (addError) {
      setFeedback({
        message:
          addError instanceof Error
            ? addError.message
            : "Unable to add this piece to your cart.",
        isError: true,
      });
    }
  }

  if (isLoading) {
    return <PageLoader label="Loading piece" />;
  }

  /* Our-side failures get the full customer notice, not an inline box. */
  if (errorKind === "service" || errorKind === "offline") {
    return (
      <ServiceNotice
        inline
        onRetry={reload}
        variant={errorKind === "offline" ? "offline" : "surveillance"}
      />
    );
  }

  if (error || !product) {
    return (
      <div className="shell product-page-error">
        <ErrorState
          message={error ?? "We could not find this piece."}
          onRetry={reload}
          title="This piece is unavailable"
        />
      </div>
    );
  }

  return (
    <div className="product-page page-enter">
      <div className="shell">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/shop">Shop</Link>

          {collection && (
            <>
              <span aria-hidden="true">/</span>
              <Link to={`/collections/${collection.slug}`}>
                {collection.name}
              </Link>
            </>
          )}

          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="product-layout">
          {/* ================= GALLERY ================= */}

          <div className="product-gallery">
            <div className="product-gallery-main">
              <SmartImage
                alt={activeImage?.alt_text ?? product.name}
                fallbackLabel={product.name}
                priority
                ratio="1 / 1"
                sizes="(max-width: 900px) 100vw, 620px"
                src={activeImage?.image_url ?? product.thumbnail_url}
              />

              {product.is_recommended && (
                <span className="badge badge-gold product-gallery-badge">
                  Recommended
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div
                aria-label="Product images"
                className="product-thumbnails"
                role="tablist"
              >
                {images.map((image, index) => (
                  <button
                    aria-label={image.alt_text ?? `Image ${index + 1}`}
                    aria-selected={index === activeImageIndex}
                    className={
                      index === activeImageIndex
                        ? "product-thumbnail is-active"
                        : "product-thumbnail"
                    }
                    key={image.id}
                    onClick={() => setActiveImageIndex(index)}
                    role="tab"
                    type="button"
                  >
                    <SmartImage
                      alt={image.alt_text ?? product.name}
                      ratio="1 / 1"
                      src={image.image_url}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ================= DETAILS ================= */}

          <div className="product-detail">
            {collection && (
              <Link
                className="product-detail-collection"
                to={`/collections/${collection.slug}`}
              >
                {collection.name}
              </Link>
            )}

            <h1 className="product-detail-title">{product.name}</h1>

            {/*
              Jumps to the reviews rather than only showing the score, which
              is what a shopper is reaching for when they look at stars near
              a title.
            */}
            {product.review_count > 0 && product.review_average !== null && (
              <a className="product-detail-rating" href="#product-reviews-heading">
                <StarRating
                  count={product.review_count}
                  value={product.review_average}
                />
              </a>
            )}

            {product.short_description && (
              <p className="lede">{product.short_description}</p>
            )}

            <div className="product-detail-price">
              <PriceTag pricing={pricing} showSaving size="detail" />

              <span className="product-detail-price-note">
                Inclusive of all taxes
              </span>
            </div>

            {/* ---------- Variants ---------- */}

            {product.variants.length > 0 && (
              <fieldset className="variant-group">
                <legend className="field-label">
                  {product.variants.length > 1
                    ? "Choose an option"
                    : "Option"}
                </legend>

                <div className="variant-options">
                  {product.variants.map((variant) => {
                    const variantStock = readStock(variant);
                    const isUnavailable = variantStock.available <= 0;

                    return (
                      <button
                        className={[
                          "variant-option",
                          variant.id === selectedVariantId ? "is-active" : "",
                          isUnavailable ? "is-unavailable" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        disabled={isUnavailable}
                        key={variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        type="button"
                      >
                        <span className="variant-option-name">
                          {variant.name}
                        </span>

                        {variant.size_label && (
                          <span className="variant-option-size">
                            {variant.size_label}
                          </span>
                        )}

                        <span className="variant-option-price">
                          {formatPrice(variant.price_paise)}
                        </span>

                        {isUnavailable && (
                          <span className="variant-option-flag">Sold out</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* ---------- Stock + add to cart ---------- */}

            <p className={`stock-line is-${stock.tone}`}>
              <span aria-hidden="true" className="stock-dot" />
              {stock.label}
            </p>

            <div className="product-actions">
              <QuantityStepper
                ariaLabel="Quantity to add"
                disabled={stock.available <= 0}
                max={stock.available || 1}
                onChange={setQuantity}
                value={quantity}
              />

              <button
                className="btn btn-primary btn-lg product-add-button"
                disabled={stock.available <= 0 || isMutating}
                onClick={() => void handleAddToCart()}
                type="button"
              >
                {isMutating
                  ? "Adding..."
                  : stock.available <= 0
                    ? "Out of stock"
                    : "Add to cart"}
              </button>

              <FavouriteButton
                productId={product.id}
                productName={product.name}
                onResult={(message, isError) =>
                  setFeedback({ message, isError })
                }
                withLabel
              />
            </div>

            {feedback && (
              <div
                aria-live="polite"
                className={`notice ${
                  feedback.isError ? "notice-error" : "notice-success"
                }`}
                role="status"
              >
                <span>{feedback.message}</span>

                {!feedback.isError && (
                  <Link className="btn-quiet" to="/cart">
                    View cart
                  </Link>
                )}
              </div>
            )}

            <ul className="product-assurances">
              <li>Free shipping on orders over &#8377;500</li>
              <li>Crated and insured in transit</li>
              <li>3-day returns from delivery</li>
            </ul>

            {/* ---------- Specification ---------- */}

            <div className="product-specs">
              <h2 className="product-specs-title">Details</h2>

              <dl>
                {selectedVariant && (
                  <div>
                    <dt>SKU</dt>
                    <dd>{selectedVariant.sku}</dd>
                  </div>
                )}

                {/*
                  Three separate rows rather than one merged "Material".
                  A marble top on a brass base is two facts, and collapsing
                  them loses the one a shopper is usually checking.
                */}
                {product.top_material && (
                  <div>
                    <dt>Top material</dt>
                    <dd>{product.top_material}</dd>
                  </div>
                )}

                {product.base_material && (
                  <div>
                    <dt>Base material</dt>
                    <dd>{product.base_material}</dd>
                  </div>
                )}

                {product.finish && (
                  <div>
                    <dt>Finish</dt>
                    <dd>{product.finish}</dd>
                  </div>
                )}

                {/*
                  Variants carry their own material for the cases where the
                  options genuinely differ. Shown only when it adds
                  something the product-level rows above do not already say.
                */}
                {selectedVariant?.material &&
                  selectedVariant.material !== product.top_material &&
                  selectedVariant.material !== product.base_material && (
                    <div>
                      <dt>Material (this option)</dt>
                      <dd>{selectedVariant.material}</dd>
                    </div>
                  )}

                {(selectedVariant?.colour ?? product.colour) && (
                  <div>
                    <dt>Colour</dt>
                    <dd>{selectedVariant?.colour ?? product.colour}</dd>
                  </div>
                )}

                {product.style && (
                  <div>
                    <dt>Style</dt>
                    <dd>{product.style}</dd>
                  </div>
                )}

                {selectedVariant && formatDimensions(selectedVariant) && (
                  <div>
                    <dt>Dimensions</dt>
                    <dd>{formatDimensions(selectedVariant)}</dd>
                  </div>
                )}

                {selectedVariant?.weight_grams != null && (
                  <div>
                    <dt>Weight</dt>
                    <dd>
                      {(selectedVariant.weight_grams / 1000).toFixed(1)} kg
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* ================= DESCRIPTION ================= */}

        {product.description && (
          <Reveal className="product-description">
            <h2 className="product-description-title">About this piece</h2>

            <div className="product-description-body">
              {product.description
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
            </div>
          </Reveal>
        )}

        {/* ================= REVIEWS ================= */}

        {slug && (
          <ProductReviews
            /*
             * Keyed on the slug so navigating between products remounts the
             * block. That resets the form, the page size and the loaded
             * reviews without the component having to clear each piece of
             * state itself and re-render to do it.
             */
            key={slug}
            /*
             * The cached detail record is dropped before refetching. Its
             * five-minute TTL would otherwise keep serving the old score,
             * so the new review would show in the list below while the
             * stars beside the title stayed where they were.
             */
            onReviewPublished={() => {
              invalidateProduct(slug);
              reload();
            }}
            productName={product.name}
            productSlug={slug}
          />
        )}

        {/* ================= RELATED ================= */}

        {related.length > 0 && (
          <section className="section product-related">
            <Reveal>
              <SectionHeading
                actionLabel="View collection"
                actionTo={
                  collection ? `/collections/${collection.slug}` : "/shop"
                }
                eyebrow="You may also like"
                title="Pairs well with"
              />
            </Reveal>

            <Reveal>
              <Carousel
                ariaLabel="Related pieces"
                trackClassName="carousel-rail"
              >
                {related.map((candidate) => (
                  <ProductCard
                    collectionName={collection?.name}
                    key={candidate.id}
                    onFeedback={(message, isError) =>
                      setFeedback({ message, isError })
                    }
                    product={candidate}
                  />
                ))}
              </Carousel>
            </Reveal>
          </section>
        )}
      </div>
    </div>
  );
}

export default ProductPage;
