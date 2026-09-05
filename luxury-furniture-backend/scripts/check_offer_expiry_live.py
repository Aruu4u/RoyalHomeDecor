"""Prove offer expiry withdraws a discount, against the live database.

Backdates one offer entry, re-reads the pricing the storefront would see,
then restores the original value. Nothing is left changed.

The point is that expiry has to reach the *price*, not just the display.
An offer that disappears from the storefront but still discounts the cart
would undercharge silently.

Run with:  .\\venv\\Scripts\\python.exe scripts\\check_offer_expiry_live.py
"""

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text

from app.db.session import AsyncSessionFactory
from app.models.offer import OfferItem
from app.services.product import ProductService


async def main() -> None:
    """Backdate one entry, check the effect, then put it back."""

    async with AsyncSessionFactory() as session:
        item = (
            await session.execute(
                select(OfferItem).order_by(OfferItem.created_at).limit(1),
            )
        ).scalar_one_or_none()

        if item is None:
            print("No offer items to test with.")
            return

        # Copied out before anything expires the instance. `expire_all()`
        # below would otherwise turn a later `item.id` into a lazy reload
        # from a non-async context, which asyncpg refuses.
        item_id = item.id
        original_ends_at = item.ends_at
        product_id = item.product_id

        service = ProductService(session)

        async def report(stage: str) -> int | None:
            """Print and return the discount the storefront would apply."""

            # Fresh read, so nothing is answered from the identity map.
            session.expire_all()

            product = await service.repository.get_by_id(product_id)

            if product is None:
                print(f"  {stage}: product missing")
                return None

            await service.annotate([product])

            percent = product.offer_discount_percent  # type: ignore[attr-defined]
            price = product.offer_price_paise  # type: ignore[attr-defined]

            print(
                f"  {stage}: discount={percent} "
                f"offer_price={price} list_price={product.base_price_paise}",
            )

            return percent

        print(f"Testing offer entry {item_id} on product {product_id}")
        print(f"Original ends_at: {original_ends_at}")

        before = await report("while running   ")

        # ---------- Backdate ----------

        await session.execute(
            text("UPDATE offer_items SET ends_at = :ends_at WHERE id = :id"),
            {
                "ends_at": datetime.now(UTC) - timedelta(minutes=5),
                "id": item_id,
            },
        )

        await session.commit()

        after = await report("after expiring  ")

        # ---------- Also check the public listing hides it ----------

        in_offer = await service.list_products(
            offset=0,
            limit=100,
            active_only=True,
            collection_id=None,
            top_material=None,
            base_material=None,
            finish=None,
            colour=None,
            style=None,
            recommended_only=False,
            in_offer=True,
            search=None,
        )

        still_listed = any(product.id == product_id for product in in_offer)

        print(f"  still in ?in_offer=true listing: {still_listed}")

        # ---------- Restore ----------

        await session.execute(
            text("UPDATE offer_items SET ends_at = :ends_at WHERE id = :id"),
            {"ends_at": original_ends_at, "id": item_id},
        )

        await session.commit()

        restored = await report("after restoring ")

        print("\nResult:")

        # The product may still be discounted by its own offer after the
        # section entry expires, which is correct. What must not happen is
        # the section's percentage surviving its own deadline.
        if after == before and before is not None:
            print(
                "  WARNING: the discount did not change. Check whether the "
                "product has its own offer at the same percentage.",
            )
        else:
            print("  ok: expiring the entry changed the price the customer pays")

        if restored == before:
            print("  ok: original state restored")
        else:
            print(f"  WARNING: not restored ({restored} vs {before})")


if __name__ == "__main__":
    asyncio.run(main())
