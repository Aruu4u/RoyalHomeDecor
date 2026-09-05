import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { formatPrice } from "../lib/currency";
import { getCollections } from "../services/collections";
import { getProducts } from "../services/products";
import type { Collection } from "../types/collection";
import type { Product } from "../types/product";
import ProductFavouriteButton from "../components/ProductFavouriteButton";
import AboutUsSection from "../components/about-card-swap/AboutUsSection";
import "../styles/HomeUnifiedBackground.css";

function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const controller = new AbortController();
  let isActive = true;

  async function loadCatalogue() {
    try {
      const [productData, collectionData] = await Promise.all([
        getProducts(controller.signal),
        getCollections(controller.signal),
      ]);

      if (!isActive) {
        return;
      }

      setProducts(
        productData.filter((product) => product.is_active),
      );

      setCollections(
        collectionData
          .filter((collection) => collection.is_active)
          .sort(
            (firstCollection, secondCollection) =>
              firstCollection.display_order -
              secondCollection.display_order,
          ),
      );
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
          : "Unable to load the catalogue.",
      );
    } finally {
      if (isActive) {
        setIsLoading(false);
      }
    }
  }

  void loadCatalogue();

  return () => {
    isActive = false;
    controller.abort();
  };
}, []);

  const productsByCollection = useMemo(() => {
    const groupedProducts = new Map<string, Product[]>();

    for (const product of products) {
      const currentProducts =
        groupedProducts.get(product.collection_id) ?? [];

      groupedProducts.set(product.collection_id, [
        ...currentProducts,
        product,
      ]);
    }

    return groupedProducts;
  }, [products]);

  return (
    <main className="home-page">
      <section className="hero">
  <div className="hero-content">
    <p className="eyebrow">
      Timeless furniture for refined interiors
    </p>

    <h1>Royal Home Decor</h1>

    <p className="hero-copy">
      Discover thoughtfully designed mirrors, wall décor,
      side tables and centre tables made for elegant homes.
    </p>

    <Link
  className="primary-button"
  to="/shop"
>
  Shop all products
</Link>
  </div>
</section>

<AboutUsSection
  collections={collections}
/>

<section
  aria-labelledby="home-collections-heading"
  className="home-collections-title"
>
  <h2 id="home-collections-heading">
    Collections
  </h2>
</section>

      <section className="collections-showcase" id="collections">
        {isLoading && (
          <p className="catalogue-message">
            Loading collections...
          </p>
        )}

        {error && (
          <p className="catalogue-message error-message">
            {error}
          </p>
        )}

        {!isLoading &&
          !error &&
          collections.slice(0, 6).map((collection) => {
            const collectionProducts =
              productsByCollection.get(collection.id) ?? [];
              const visibleCollectionProducts =
              collectionProducts.slice(0, 6);

            return (
              <section
                className="collection-section"
                id={`collection-${collection.slug}`}
                key={collection.id}
              >
                {collection.hero_image_url && (
  <div
    aria-hidden="true"
    className="collection-section-background"
    style={{
      backgroundImage: `url("${collection.hero_image_url}")`,
    }}
  />
)}

<div
  aria-hidden="true"
  className="collection-section-overlay"
/>

<div className="collection-section-content">
                <div className="collection-introduction">
                  

                  <h2>{collection.name}</h2>

                  <p className="collection-description">
                    {collection.description ??
                      collection.short_description ??
                      "Explore our carefully selected pieces for elegant interiors."}
                  </p>
                </div>

                {visibleCollectionProducts.length === 0 ? (
                  <p className="empty-collection-message">
                    Products will be added to this collection soon.
                  </p>
                ) : (
                  <div className="collection-products">
                    {visibleCollectionProducts.map((product) => (
  <article
    className="product-card-shell"
    key={product.id}
  >
    <ProductFavouriteButton
      className="product-card-favourite-button"
      productId={product.id}
      productName={product.name}
    />

    <Link
      className="hover-product-card"
      to={`/products/${product.slug}`}
    >
      <div className="hover-product-image">
        {product.thumbnail_url ? (
          <img
  alt={product.name}
  decoding="async"
  loading="eager"
  onLoad={(event) => {
    event.currentTarget
      .closest(".hover-product-image")
      ?.classList.add(
        "product-image-loaded",
      );
  }}
  src={product.thumbnail_url}
/>
        ) : (
          <div className="product-placeholder">
            No image available
          </div>
        )}

        <div className="product-hover-overlay">
          <div className="product-hover-content">
            <p className="product-hover-style">
              {product.style ??
                "Luxury décor"}
            </p>

            <h3>
              {product.name}
            </h3>

            <p className="product-hover-description">
              {product.short_description ??
                "A refined piece for beautiful interiors."}
            </p>

            <strong>
              {formatPrice(
                product.base_price_paise,
              )}
            </strong>

            <span className="view-product-text">
              View product
            </span>
          </div>
        </div>
      </div>

      {/* <div className="product-card-summary">
        <h3>
          {product.name}
        </h3>

        <strong>
          {formatPrice(
            product.base_price_paise,
          )}
        </strong>
      </div> */}
    </Link>
  </article>
))}
                       

                      
                  </div>
                )}
                </div>
              </section>
            );
          })}
      </section>
    </main>
  );
}

export default HomePage;