import { useState } from "react";

import AccountNav from "../../components/account/AccountNav";
import ProductCard from "../../components/product/ProductCard";
import { EmptyState, PageLoader } from "../../components/ui/Feedback";
import Reveal from "../../components/ui/Reveal";
import { useCollectionNames, useCollections } from "../../hooks/useCatalogue";
import { useFavourites } from "../../hooks/useFavourites";
import type { FavouriteProduct } from "../../types/favourite";
import type { Product } from "../../types/product";

import "./account.css";

/*
 * FavouriteProductResponse carries the same offer, stock and review fields
 * as a catalogue product, so a saved piece shows the discount it is
 * actually on and says when it is sold out.
 *
 * The one difference is that it has no created_at/updated_at. Those are
 * filled in as empty strings and the card is told not to show a "new"
 * ribbon, which is the only thing that reads them.
 */
function toProduct(favouriteProduct: FavouriteProduct): Product {
  return {
    ...favouriteProduct,
    created_at: "",
    updated_at: "",
  };
}

function FavouritesPage() {
  const { favourites, favouriteCount, isLoading, error } = useFavourites();

  const { data: collections } = useCollections();
  const collectionNames = useCollectionNames(collections);

  const [feedback, setFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);

  if (isLoading && favourites.length === 0) {
    return <PageLoader label="Loading your favourites" />;
  }

  return (
    <div className="shell account-page page-enter">
      <header className="account-header">
        <p className="eyebrow">Your account</p>
        <h1 className="account-title">Favourites</h1>

        <p className="lede account-subtitle">
          Pieces you have saved for later. Nothing here is reserved, so
          popular items can sell out.
        </p>
      </header>

      <div className="account-layout">
        <AccountNav />

        <div className="account-content">
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}

          {feedback && (
            <p
              className={`notice ${
                feedback.isError ? "notice-error" : "notice-success"
              }`}
              role="status"
            >
              {feedback.message}
            </p>
          )}

          {favouriteCount === 0 ? (
            <EmptyState
              actionLabel="Browse the collection"
              actionTo="/shop"
              description="Tap the heart on any piece to keep it here."
              title="No favourites yet"
            />
          ) : (
            <section className="panel">
              <header className="account-panel-head">
                <div>
                  <h2 className="account-panel-title">
                    {favouriteCount} saved piece
                    {favouriteCount === 1 ? "" : "s"}
                  </h2>

                  <p className="account-panel-subtitle">
                    Remove a piece by tapping its heart again.
                  </p>
                </div>
              </header>

              <div className="favourites-grid">
                {favourites.map((favourite, index) => (
                  <Reveal delay={(index % 4) * 50} key={favourite.id}>
                    <ProductCard
                      collectionName={collectionNames.get(
                        favourite.product.collection_id,
                      )}
                      onFeedback={(message, isError) =>
                        setFeedback({ message, isError })
                      }
                      product={toProduct(favourite.product)}
                    />
                  </Reveal>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default FavouritesPage;
