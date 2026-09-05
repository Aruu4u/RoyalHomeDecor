import { useState } from "react";
import { Link } from "react-router-dom";

import fallbackImage from "../../assets/hero.png";
import { formatPrice } from "../../lib/currency";
import type {
  CartItem as CartItemType,
} from "../../types/cart";
import type { Product } from "../../types/product";

interface CartItemProps {
  item: CartItemType;
  product: Product | null;
  disabled: boolean;

  onQuantityChange: (
    itemId: string,
    quantity: number,
  ) => Promise<void>;

  onRemove: (itemId: string) => Promise<void>;
}

export function CartItem({
  item,
  product,
  disabled,
  onQuantityChange,
  onRemove,
}: CartItemProps) {
  const [quantity, setQuantity] =
    useState(item.quantity);

  async function commitQuantity(
    nextQuantity: number,
  ): Promise<void> {
    const normalizedQuantity = Math.min(
      99,
      Math.max(
        1,
        Math.trunc(nextQuantity || 1),
      ),
    );

    setQuantity(normalizedQuantity);

    if (normalizedQuantity === item.quantity) {
      return;
    }

    try {
      await onQuantityChange(
        item.id,
        normalizedQuantity,
      );
    } catch {
      setQuantity(item.quantity);
    }
  }

  async function handleRemove(): Promise<void> {
    try {
      await onRemove(item.id);
    } catch {
      // The cart provider displays the error.
    }
  }

  const productPath = product
    ? `/products/${product.slug}`
    : "/";

  const imageUrl =
    product?.thumbnail_url ?? fallbackImage;

  return (
    <article className="cart-item">
  <div className="cart-item-left">
    <Link
      aria-label={
        product
          ? `Open ${product.name}`
          : "Open product"
      }
      className="cart-item-image-link"
      to={productPath}
    >
      <img
        alt={product?.name ?? "Furniture product"}
        className="cart-item-image"
        loading="lazy"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = fallbackImage;
        }}
        src={imageUrl}
      />
    </Link>

    <div
      aria-label={`Quantity for ${
        product?.name ?? item.variant.name
      }`}
      className="quantity-selector"
    >
      <button
        aria-label="Decrease quantity"
        disabled={disabled || quantity <= 1}
        onClick={() =>
          void commitQuantity(quantity - 1)
        }
        type="button"
      >
        −
      </button>

      <input
        aria-label="Cart item quantity"
        disabled={disabled}
        max={99}
        min={1}
        onBlur={() =>
          void commitQuantity(quantity)
        }
        onChange={(event) =>
          setQuantity(Number(event.target.value))
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        type="number"
        value={quantity}
      />

      <button
        aria-label="Increase quantity"
        disabled={disabled || quantity >= 99}
        onClick={() =>
          void commitQuantity(quantity + 1)
        }
        type="button"
      >
        +
      </button>
    </div>

    <button
      className="remove-cart-item-button"
      disabled={disabled}
      onClick={() => void handleRemove()}
      type="button"
    >
      Remove
    </button>
  </div>

  <div className="cart-item-main">
    <div className="cart-item-content">
      <p className="cart-item-eyebrow">
        {product?.style ?? "Royal Home Decor"}
      </p>

      <h2 className="cart-product-name">
        <Link to={productPath}>
          {product?.name ?? "Furniture item"}
        </Link>
      </h2>

      <p className="cart-selected-variant">
        Selected size:{" "}
        <strong>{item.variant.name}</strong>
      </p>

      <p className="cart-item-sku">
        SKU: {item.variant.sku}
      </p>

      <div className="cart-item-details">
        {item.variant.size_label && (
          <span>
            Dimensions: {item.variant.size_label}
          </span>
        )}

        {item.variant.colour && (
          <span>
            Colour: {item.variant.colour}
          </span>
        )}

        {item.variant.material && (
          <span>
            Material: {item.variant.material}
          </span>
        )}
      </div>

      <p className="cart-item-unit-price">
        {formatPrice(item.variant.price_paise)} each
      </p>
    </div>

    <div className="cart-item-price-area">
      <span>Total price</span>

      <strong>
        {formatPrice(item.line_total_paise)}
      </strong>
    </div>
  </div>
</article>
  );
}