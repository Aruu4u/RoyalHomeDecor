import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useFavourites } from "../../hooks/useFavourites";

interface FavouriteButtonProps {
  productId: string;
  productName: string;

  /** Renders the state as text next to the icon. */
  withLabel?: boolean;

  className?: string;
  onResult?: (message: string, isError: boolean) => void;
}

/**
 * Heart toggle for saving a piece.
 *
 * Both directions apply immediately. Saving and unsaving are trivially
 * reversible in one more tap, so a confirmation step here would cost
 * more than the mistake it prevents.
 *
 * Unauthenticated shoppers are routed to sign in and returned to where
 * they were.
 */
function FavouriteButton({
  productId,
  productName,
  withLabel = false,
  className,
  onResult,
}: FavouriteButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const { session } = useAuth();
  const { isFavourite, isProductBusy, toggleFavourite } = useFavourites();

  const isSaved = isFavourite(productId);
  const isBusy = isProductBusy(productId);

  async function handleClick(): Promise<void> {
    if (!session) {
      navigate("/login", { state: { from: location } });
      return;
    }

    try {
      const nowSaved = await toggleFavourite(productId);

      onResult?.(
        nowSaved
          ? `${productName} was saved to your favourites.`
          : `${productName} was removed from your favourites.`,
        false,
      );
    } catch {
      onResult?.("We could not update your favourites just now.", true);
    }
  }

  return (
    <button
      aria-label={
        isSaved
          ? `Remove ${productName} from favourites`
          : `Save ${productName} to favourites`
      }
      aria-pressed={isSaved}
      className={[
        "favourite-button",
        isSaved ? "is-saved" : "",
        withLabel ? "has-label" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isBusy}
      onClick={() => void handleClick()}
      title={isSaved ? "Remove from favourites" : "Save to favourites"}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill={isSaved ? "currentColor" : "none"}
        height="19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
        viewBox="0 0 24 24"
        width="19"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>

      {withLabel && (
        <span>{isBusy ? "Saving..." : isSaved ? "Saved" : "Save"}</span>
      )}
    </button>
  );
}

export default FavouriteButton;
