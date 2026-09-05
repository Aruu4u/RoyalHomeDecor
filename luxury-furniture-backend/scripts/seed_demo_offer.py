"""Create a demo "Diwali Special" offer section for manual checking.

Picks the first few active products and puts them in a themed section at
staggered discounts, so the storefront section and the admin screens have
something real to display.

Idempotent: re-running updates the existing section rather than creating a
duplicate. Pass --remove to delete it again and leave the catalogue exactly
as it was.

    python scripts/seed_demo_offer.py
    python scripts/seed_demo_offer.py --remove
"""

import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionFactory
from app.models.offer import OfferItem, OfferSection
from app.models.product import Product


SECTION_SLUG = "diwali-special-offer"

# Discounts applied to the first three products found, in order.
DEMO_DISCOUNTS = (30, 40, 25)


async def remove_section() -> None:
    """Delete the demo section. Products are left untouched."""

    async with AsyncSessionFactory() as session:
        result = await session.execute(
            select(OfferSection).where(OfferSection.slug == SECTION_SLUG),
        )

        section = result.scalar_one_or_none()

        if section is None:
            print("Demo section not present; nothing to remove.")
            return

        await session.delete(section)
        await session.commit()

        print(f"Removed offer section '{SECTION_SLUG}'.")


async def seed_section() -> None:
    """Create or refresh the demo offer section."""

    async with AsyncSessionFactory() as session:
        result = await session.execute(
            select(OfferSection)
            .where(OfferSection.slug == SECTION_SLUG)
            .options(selectinload(OfferSection.items)),
        )

        section = result.scalar_one_or_none()

        if section is None:
            section = OfferSection(
                title="Diwali Special Offer",
                slug=SECTION_SLUG,
                subtitle=(
                    "Handpicked marble and brass pieces at festive prices, "
                    "while stocks last."
                ),
                # Free text; "diwali" happens to have a colour preset.
                theme="diwali",
                background_color="#2A1206",
                accent_color="#E8B54D",
                text_color="#FFF8EC",
                badge_label="Diwali Special",
                display_order=0,
                is_active=True,
            )

            session.add(section)
            await session.commit()

            print(f"Created offer section '{SECTION_SLUG}'.")

            # Re-read with items eagerly loaded. Touching section.items on
            # the freshly inserted object would trigger a lazy load outside
            # the async context and raise MissingGreenlet.
            result = await session.execute(
                select(OfferSection)
                .where(OfferSection.slug == SECTION_SLUG)
                .options(selectinload(OfferSection.items)),
            )

            section = result.scalar_one()
        else:
            print(f"Offer section '{SECTION_SLUG}' already exists; refreshing.")

        products_result = await session.execute(
            select(Product)
            .where(Product.is_active.is_(True))
            .order_by(Product.created_at.desc())
            .limit(len(DEMO_DISCOUNTS)),
        )

        products = list(products_result.scalars().all())

        if not products:
            print("No active products found; cannot populate the section.")
            return

        existing_product_ids = {item.product_id for item in section.items}

        for product, discount_percent in zip(products, DEMO_DISCOUNTS):
            if product.id in existing_product_ids:
                print(f"  already in section: {product.name}")
                continue

            session.add(
                OfferItem(
                    section_id=section.id,
                    product_id=product.id,
                    discount_percent=discount_percent,
                    display_order=len(existing_product_ids),
                )
            )

            existing_product_ids.add(product.id)

            print(
                f"  added {product.name} at {discount_percent}% off "
                f"(was {product.base_price_paise} paise)"
            )

        await session.commit()


async def main() -> None:
    if "--remove" in sys.argv:
        await remove_section()
    else:
        await seed_section()


if __name__ == "__main__":
    asyncio.run(main())
