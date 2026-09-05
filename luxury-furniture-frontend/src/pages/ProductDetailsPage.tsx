import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import ProductFavouriteButton from "../components/ProductFavouriteButton";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { formatPrice } from "../lib/currency";
import { getProductBySlug } from "../services/products";
import type {
  ProductDetails,
  ProductImage,
  ProductVariant,
} from "../types/product";

function ProductDetailsPage() {
  const { slug } = useParams<{ slug: string }>();

  const location = useLocation();
  const navigate = useNavigate();

  const { session } = useAuth();
  const { addItem, isMutating } = useCart();

  const [product, setProduct] =
    useState<ProductDetails | null>(null);

  const [selectedVariant, setSelectedVariant] =
    useState<ProductVariant | null>(null);

  const [selectedImage, setSelectedImage] =
    useState<ProductImage | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cartMessage, setCartMessage] =
    useState<string | null>(null);

  const [cartError, setCartError] =
    useState<string | null>(null);
const [
  favouriteMessage,
  setFavouriteMessage,
] = useState<string | null>(
  null,
);

const [
  favouriteError,
  setFavouriteError,
] = useState<string | null>(
  null,
);
  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadProduct() {
      if (!slug) {
        setError("Product address is invalid.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const productData = await getProductBySlug(
          slug,
          controller.signal,
        );

        if (!isActive) {
          return;
        }

        const activeVariants = productData.variants.filter(
          (variant) => variant.is_active,
        );

        const sortedImages = [...productData.images].sort(
          (firstImage, secondImage) =>
            firstImage.display_order -
            secondImage.display_order,
        );

        const primaryImage =
          sortedImages.find((image) => image.is_primary) ??
          sortedImages[0] ??
          null;

        const firstInStockVariant = activeVariants.find(
          (variant) =>
            (variant.inventory?.available_quantity ?? 0) > 0,
        );

        setProduct({
          ...productData,
          images: sortedImages,
          variants: activeVariants,
        });

        setSelectedVariant(
          firstInStockVariant ??
            activeVariants[0] ??
            null,
        );

        setSelectedImage(primaryImage);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        if (!isActive) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load this product.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [slug]);

  const availableQuantity =
    selectedVariant?.inventory?.available_quantity ?? 0;

  const isOutOfStock = availableQuantity <= 0;

  const isLowStock = useMemo(() => {
    if (!selectedVariant?.inventory) {
      return false;
    }

    return (
      availableQuantity > 0 &&
      availableQuantity <=
        selectedVariant.inventory.low_stock_threshold
    );
  }, [availableQuantity, selectedVariant]);

  async function handleAddToCart(): Promise<void> {
    if (!selectedVariant || isOutOfStock) {
      return;
    }

    if (!session) {
      navigate("/login", {
        state: {
          from: location,
        },
      });

      return;
    }

    setCartMessage(null);
    setCartError(null);

    try {
      await addItem(selectedVariant.id, 1);

      setCartMessage(
        `${selectedVariant.name} was added to your cart.`,
      );
    } catch (requestError) {
      setCartError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to add this item to your cart.",
      );
    }
  }

  function handleVariantSelection(
    variant: ProductVariant,
  ): void {
    setSelectedVariant(variant);
    setCartMessage(null);
    setCartError(null);
  }

  if (isLoading) {
    return (
      <main className="details-page">
        <p>Loading product...</p>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="details-page">
        <p className="error-message">
          {error ?? "Product was not found."}
        </p>

        <Link className="text-link" to="/">
          Return to home
        </Link>
      </main>
    );
  }

  const displayedPrice =
    selectedVariant?.price_paise ??
    product.base_price_paise;

  const displayedImage =
    selectedImage?.image_url ??
    product.thumbnail_url;

  return (
    <main className="details-page">
      <Link className="back-link" to="/">
        ← Back to products
      </Link>

      <section className="product-details">
        <div className="product-gallery">
          <div className="details-image">
            {displayedImage ? (
              <img
                alt={
                  selectedImage?.alt_text ??
                  product.name
                }
                src={displayedImage}
              />
            ) : (
              <span>No image available</span>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="image-thumbnails">
              {product.images.map((image) => (
                <button
                  aria-label={`View ${
                    image.alt_text ?? product.name
                  }`}
                  className={
                    selectedImage?.id === image.id
                      ? "image-thumbnail active"
                      : "image-thumbnail"
                  }
                  key={image.id}
                  onClick={() =>
                    setSelectedImage(image)
                  }
                  type="button"
                >
                  <img
                    alt={
                      image.alt_text ??
                      product.name
                    }
                    src={image.image_url}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="details-content">
          <p className="eyebrow">
            {product.style ?? "Luxury home décor"}
          </p>

          <h1>{product.name}</h1>

          <p className="details-description">
            {product.description ??
              product.short_description ??
              "A carefully selected piece for refined interiors."}
          </p>

          <p className="details-price">
            {formatPrice(displayedPrice)}
          </p>

          {product.variants.length > 0 && (
            <section className="variant-section">
              <div className="variant-heading">
                <h2>Select size</h2>

                {selectedVariant?.size_label && (
                  <span>
                    {selectedVariant.size_label}
                  </span>
                )}
              </div>

              <div className="variant-options">
                {product.variants.map((variant) => {
                  const variantStock =
                    variant.inventory
                      ?.available_quantity ?? 0;

                  return (
                    <button
                      className={
                        selectedVariant?.id === variant.id
                          ? "variant-option active"
                          : "variant-option"
                      }
                      disabled={variantStock <= 0}
                      key={variant.id}
                      onClick={() =>
                        handleVariantSelection(variant)
                      }
                      type="button"
                    >
                      <span>{variant.name}</span>

                      <small>
                        {variant.size_label ??
                          "Standard size"}
                      </small>

                      <strong>
                        {formatPrice(
                          variant.price_paise,
                        )}
                      </strong>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <div className="stock-status">
            {isOutOfStock ? (
              <p className="stock-message out-of-stock">
                Currently out of stock
              </p>
            ) : isLowStock ? (
              <p className="stock-message low-stock">
                Only {availableQuantity} left in stock
              </p>
            ) : (
              <p className="stock-message in-stock">
                In stock
              </p>
            )}
          </div>

          <dl className="product-information">
            <div>
              <dt>Material</dt>

              <dd>
                {selectedVariant?.material ??
                  product.top_material ??
                  "Not specified"}
              </dd>
            </div>

            <div>
              <dt>Colour</dt>

              <dd>
                {selectedVariant?.colour ??
                  product.colour ??
                  "Not specified"}
              </dd>
            </div>

            <div>
              <dt>Size</dt>

              <dd>
                {selectedVariant?.size_label ??
                  "Not specified"}
              </dd>
            </div>

            <div>
              <dt>SKU</dt>

              <dd>
                {selectedVariant?.sku ??
                  "Not specified"}
              </dd>
            </div>

            {selectedVariant?.length_cm &&
              selectedVariant.width_cm &&
              selectedVariant.height_cm && (
                <div>
                  <dt>Dimensions</dt>

                  <dd>
                    {selectedVariant.length_cm} ×{" "}
                    {selectedVariant.width_cm} ×{" "}
                    {selectedVariant.height_cm} cm
                  </dd>
                </div>
              )}

            {selectedVariant?.weight_grams && (
              <div>
                <dt>Weight</dt>

                <dd>
                  {(
                    selectedVariant.weight_grams /
                    1000
                  ).toFixed(1)}{" "}
                  kg
                </dd>
              </div>
            )}
          </dl>

          <div className="product-purchase-actions">
  <ProductFavouriteButton
    className="details-favourite-button"
    onResult={(
      message,
      isError,
    ) => {
      if (isError) {
        setFavouriteError(
          message,
        );

        setFavouriteMessage(
          null,
        );
      } else {
        setFavouriteMessage(
          message,
        );

        setFavouriteError(
          null,
        );
      }
    }}
    productId={product.id}
    productName={product.name}
    showLabel
  />

  <button
    className="add-to-cart-button"
    disabled={
      !selectedVariant ||
      isOutOfStock ||
      isMutating
    }
    onClick={() =>
      void handleAddToCart()
    }
    type="button"
  >
    {isMutating
      ? "Adding..."
      : isOutOfStock
        ? "Out of stock"
        : "Add to cart"}
  </button>
</div>

          {cartMessage && (
            <p
              className="cart-action-message cart-action-success"
              role="status"
            >
              {cartMessage}
            </p>
          )}

          {cartError && (
            <p
              className="cart-action-message cart-action-error"
              role="alert"
            >
              {cartError}
            </p>
          )}
          {favouriteMessage && (
  <p
    className="cart-action-message cart-action-success"
    role="status"
  >
    {favouriteMessage}
  </p>
)}

{favouriteError && (
  <p
    className="cart-action-message cart-action-error"
    role="alert"
  >
    {favouriteError}
  </p>
)}

          <p className="button-note">
            {!session
              ? "You will be asked to sign in before adding this item."
              : "Your cart is securely saved to your account."}
          </p>
        </div>
      </section>
    </main>
  );
}

export default ProductDetailsPage;