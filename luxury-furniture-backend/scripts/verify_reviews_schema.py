"""Check the live database matches revision e5a71c3d9b40.

Verifies the material split, the offer expiry columns and the
product_reviews table, then reports how much live data is affected.

Run with:  .\\venv\\Scripts\\python.exe scripts\\verify_reviews_schema.py
"""

import asyncio

from sqlalchemy import text

from app.db.session import AsyncSessionFactory


EXPECTED_PRODUCT_COLUMNS = (
    "top_material",
    "base_material",
    "finish",
    "offer_ends_at",
)

EXPECTED_REVIEW_COLUMNS = (
    "product_id",
    "user_id",
    "author_name",
    "author_email",
    "rating",
    "title",
    "body",
    "photo_urls",
    "is_approved",
    "is_verified_purchase",
)


async def main() -> None:
    """Report on the schema and the data now sitting in it."""

    async with AsyncSessionFactory() as session:
        version = await session.scalar(
            text("SELECT version_num FROM alembic_version"),
        )

        print(f"alembic version: {version}")

        product_columns = set(
            (
                await session.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = 'products'",
                    ),
                )
            )
            .scalars()
            .all()
        )

        print("\nproducts")

        for column in EXPECTED_PRODUCT_COLUMNS:
            present = column in product_columns
            print(f"  {'ok  ' if present else 'MISSING'} {column}")

        # The rename must have removed the old name, otherwise the model
        # and the table have quietly diverged.
        if "material" in product_columns:
            print("  WARNING: old 'material' column still present")

        offer_columns = set(
            (
                await session.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = 'offer_items'",
                    ),
                )
            )
            .scalars()
            .all()
        )

        print("\noffer_items")
        print(f"  {'ok  ' if 'ends_at' in offer_columns else 'MISSING'} ends_at")

        review_columns = set(
            (
                await session.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = 'product_reviews'",
                    ),
                )
            )
            .scalars()
            .all()
        )

        print("\nproduct_reviews")

        if not review_columns:
            print("  MISSING table")
        else:
            for column in EXPECTED_REVIEW_COLUMNS:
                present = column in review_columns
                print(f"  {'ok  ' if present else 'MISSING'} {column}")

        # ---------- Live data ----------

        print("\ndata")

        counts = await session.execute(
            text(
                """
                SELECT
                    (SELECT COUNT(*) FROM products) AS products,
                    (SELECT COUNT(*) FROM products
                     WHERE top_material IS NOT NULL) AS with_top_material,
                    (SELECT COUNT(*) FROM products
                     WHERE base_material IS NOT NULL) AS with_base_material,
                    (SELECT COUNT(*) FROM products
                     WHERE finish IS NOT NULL) AS with_finish,
                    (SELECT COUNT(*) FROM products
                     WHERE offer_percent IS NOT NULL) AS discounted,
                    (SELECT COUNT(*) FROM products
                     WHERE offer_ends_at IS NOT NULL) AS expiring,
                    (SELECT COUNT(*) FROM offer_items) AS offer_items,
                    (SELECT COUNT(*) FROM offer_items
                     WHERE ends_at IS NOT NULL) AS expiring_items,
                    (SELECT COUNT(*) FROM product_reviews) AS reviews
                """,
            ),
        )

        row = counts.mappings().one()

        for key, value in row.items():
            print(f"  {key}: {value}")


if __name__ == "__main__":
    asyncio.run(main())
