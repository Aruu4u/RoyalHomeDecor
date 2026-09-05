"""Check the favourites response still builds after the material split.

``FavouriteProductResponse`` reads its fields straight off the ORM object.
It referenced ``product.material``, which the split renamed, so this would
have raised at serialisation time rather than at import time: exactly the
kind of break a type checker cannot see and no unit test with a fake
service would catch.

Exercises the real service against the live database. Read-only: it
creates a favourite only if none exist, and removes it again afterwards.

Run with:  .\\venv\\Scripts\\python.exe scripts\\check_favourites_shape.py
"""

import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionFactory
from app.models.favourite import Favourite
from app.models.product import Product
from app.services.favourite import FavouriteService


EXPECTED_FIELDS = (
    "top_material",
    "base_material",
    "finish",
    "in_stock",
    "available_quantity",
    "offer_discount_percent",
    "offer_price_paise",
    "review_count",
    "review_average",
)


async def main() -> None:
    """Serialise a real favourite and report the fields it carries."""

    async with AsyncSessionFactory() as session:
        service = FavouriteService(session)

        existing = (
            await session.execute(select(Favourite).limit(1))
        ).scalar_one_or_none()

        temporary_user_id = None
        temporary_product_id = None

        if existing is None:
            product = (
                await session.execute(
                    select(Product).where(Product.is_active.is_(True)).limit(1),
                )
            ).scalar_one_or_none()

            if product is None:
                print("No products to favourite. Nothing to check.")
                return

            # A favourite needs a real profile, because of the foreign key
            # on the table. Reuse any existing one rather than inventing a
            # customer just for this check.
            from app.models.profile import Profile

            profile = (
                await session.execute(select(Profile).limit(1))
            ).scalar_one_or_none()

            if profile is None:
                print(
                    "No customer profiles exist yet, so a favourite cannot "
                    "be created to test with.",
                )
                return

            temporary_user_id = profile.id
            temporary_product_id = product.id

            await service.add_favourite(
                user_id=temporary_user_id,
                product_id=temporary_product_id,
            )

            print(f"Created a temporary favourite for profile {profile.id}")

            user_id = temporary_user_id
        else:
            user_id = existing.user_id

        # ---------- The actual check ----------

        favourites = await service.list_favourites(user_id)

        print(f"Serialised {len(favourites)} favourite(s) without error")

        if favourites:
            payload = favourites[0].product.model_dump()

            print("\nfields on the product:")

            for field in EXPECTED_FIELDS:
                present = field in payload
                print(
                    f"  {'ok  ' if present else 'MISSING'} {field}"
                    f" = {payload.get(field)!r}",
                )

            if "material" in payload:
                print("  WARNING: the old merged 'material' field is still sent")

        # ---------- Clean up ----------

        if temporary_user_id is not None and temporary_product_id is not None:
            await service.delete_favourite(
                user_id=temporary_user_id,
                product_id=temporary_product_id,
            )

            print("\nRemoved the temporary favourite.")


if __name__ == "__main__":
    asyncio.run(main())
