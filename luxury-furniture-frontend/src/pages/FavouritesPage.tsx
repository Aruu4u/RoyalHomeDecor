import {
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import {
  useFavourites,
} from "../hooks/useFavourites";
import {
  formatPrice,
} from "../lib/currency";

function FavouritesPage() {
  const {
    favourites,
    isLoading,
    error: loadError,
    isProductBusy,
    removeFavourite,
  } = useFavourites();

  const [actionError, setActionError] =
    useState<string | null>(null);

  async function handleRemove(
    productId: string,
  ): Promise<void> {
    setActionError(null);

    try {
      await removeFavourite(
        productId,
      );
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove this favourite.",
      );
    }
  }

  if (isLoading) {
    return (
      <main className="favourites-page">
        <p>
          Loading your favourites...
        </p>
      </main>
    );
  }

  return (
    <main className="favourites-page">
      <header className="favourites-heading">
        <div>
          <p className="eyebrow">
            Your saved collection
          </p>

          <h1>Favourites</h1>

          <p>
            Keep your favourite pieces
            together and return to them
            anytime.
          </p>
        </div>

        <span>
          {favourites.length} saved
          {favourites.length === 1
            ? " product"
            : " products"}
        </span>
      </header>

      {(loadError || actionError) && (
        <p
          className="error-message"
          role="alert"
        >
          {actionError ??
            loadError}
        </p>
      )}

      {favourites.length === 0 ? (
        <section className="favourites-empty">
          <h2>
            No favourites yet
          </h2>

          <p>
            Use the heart button on a
            product to save it here.
          </p>

          <Link
            className="primary-button"
            to="/#collections"
          >
            Explore collections
          </Link>
        </section>
      ) : (
        <div className="favourites-grid">
          {favourites.map(
            (favourite) => {
              const {
                product,
              } = favourite;

              const isBusy =
                isProductBusy(
                  product.id,
                );

              return (
                <article
                  className="favourite-card"
                  key={favourite.id}
                >
                  <Link
                    className="favourite-card-link"
                    to={`/products/${product.slug}`}
                  >
                    <div className="favourite-card-image">
                      {product.thumbnail_url ? (
                        <img
                          alt={product.name}
                          src={
                            product.thumbnail_url
                          }
                        />
                      ) : (
                        <span>
                          No image available
                        </span>
                      )}
                    </div>

                    <div className="favourite-card-content">
                      <p>
                        {product.style ??
                          "Luxury décor"}
                      </p>

                      <h2>
                        {product.name}
                      </h2>

                      <span>
                        {[
                          product.top_material,
                          product.colour,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>

                      <strong>
                        {formatPrice(
                          product.base_price_paise,
                        )}
                      </strong>
                    </div>
                  </Link>

                  <button
                    className="remove-favourite-button"
                    disabled={isBusy}
                    onClick={() =>
                      void handleRemove(
                        product.id,
                      )
                    }
                    type="button"
                  >
                    {isBusy
                      ? "Removing..."
                      : "Remove"}
                  </button>
                </article>
              );
            },
          )}
        </div>
      )}
    </main>
  );
}

export default FavouritesPage;