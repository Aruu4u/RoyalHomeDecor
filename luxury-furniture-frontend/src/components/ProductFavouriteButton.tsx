import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import {
  useFavourites,
} from "../hooks/useFavourites";

interface ProductFavouriteButtonProps {
  productId: string;
  productName: string;
  className?: string;
  showLabel?: boolean;

  onResult?: (
    message: string,
    isError: boolean,
  ) => void;
}

function ProductFavouriteButton({
  productId,
  productName,
  className = "",
  showLabel = false,
  onResult,
}: ProductFavouriteButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const { session } = useAuth();

  const {
    isFavourite,
    isProductBusy,
    toggleFavourite,
  } = useFavourites();

  const isSaved =
    isFavourite(productId);

  const isBusy =
    isProductBusy(productId);

  async function handleClick():
    Promise<void> {
    if (!session) {
      navigate("/login", {
        state: {
          from: location,
        },
      });

      return;
    }

    try {
      const nowSaved =
        await toggleFavourite(
          productId,
        );

      onResult?.(
        nowSaved
          ? `${productName} was added to your favourites.`
          : `${productName} was removed from your favourites.`,
        false,
      );
    } catch (requestError) {
      onResult?.(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update your favourites.",
        true,
      );
    }
  }

  return (
    <button
      aria-label={
        isSaved
          ? `Remove ${productName} from favourites`
          : `Add ${productName} to favourites`
      }
      aria-pressed={isSaved}
      className={[
        "product-favourite-button",
        isSaved ? "active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isBusy}
      onClick={() =>
        void handleClick()
      }
      title={
        isSaved
          ? "Remove from favourites"
          : "Add to favourites"
      }
      type="button"
    >
      <svg
        fill={
          isSaved
            ? "currentColor"
            : "none"
        }
        height="21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
        width="21"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>

      {showLabel && (
        <span>
          {isBusy
            ? "Updating..."
            : isSaved
              ? "Saved"
              : "Save"}
        </span>
      )}
    </button>
  );
}

export default ProductFavouriteButton;