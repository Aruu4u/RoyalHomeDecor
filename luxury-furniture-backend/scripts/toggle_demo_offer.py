"""Show or hide the demo offer section.

Used to confirm that hiding a section both removes it from the storefront
and withdraws its discounts from product prices.

    python scripts/toggle_demo_offer.py hide
    python scripts/toggle_demo_offer.py show
"""

import asyncio
import sys

from sqlalchemy import select

from app.db.session import AsyncSessionFactory
from app.models.offer import OfferSection


SECTION_SLUG = "diwali-special-offer"


async def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in {"hide", "show"}:
        print("Usage: toggle_demo_offer.py [hide|show]")
        return

    should_be_active = sys.argv[1] == "show"

    async with AsyncSessionFactory() as session:
        result = await session.execute(
            select(OfferSection).where(OfferSection.slug == SECTION_SLUG),
        )

        section = result.scalar_one_or_none()

        if section is None:
            print(f"Section '{SECTION_SLUG}' not found.")
            return

        section.is_active = should_be_active

        await session.commit()

        state = "visible" if should_be_active else "hidden"

        print(f"Section '{SECTION_SLUG}' is now {state}.")


if __name__ == "__main__":
    asyncio.run(main())
