import uuid
from collections.abc import Sequence

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.offer import OfferItem, OfferSection


def offer_item_is_live() -> ColumnElement[bool]:
    """SQL for "this offer entry has not expired".

    A null ``ends_at`` never expires. ``func.now()`` is evaluated by
    Postgres, so the cut-off is the database clock rather than the
    application server's, and every query in one transaction agrees.
    """

    return or_(
        OfferItem.ends_at.is_(None),
        OfferItem.ends_at > func.now(),
    )


class OfferRepository:
    """Database operations for special offer sections and their products."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ---------- Sections ----------

    async def create_section(
        self,
        section: OfferSection,
    ) -> OfferSection:
        """Add an offer section to the current transaction."""

        self.session.add(section)

        await self.session.flush()
        await self.session.refresh(section)

        return section

    async def get_section_by_id(
        self,
        section_id: uuid.UUID,
        *,
        include_items: bool = False,
    ) -> OfferSection | None:
        """Find an offer section using its UUID."""

        query = select(OfferSection).where(
            OfferSection.id == section_id,
        )

        if include_items:
            query = query.options(
                selectinload(OfferSection.items).selectinload(
                    OfferItem.product,
                ),
            )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def get_section_by_slug(
        self,
        slug: str,
        *,
        include_items: bool = False,
    ) -> OfferSection | None:
        """Find an offer section using its URL slug."""

        query = select(OfferSection).where(
            OfferSection.slug == slug,
        )

        if include_items:
            query = query.options(
                selectinload(OfferSection.items).selectinload(
                    OfferItem.product,
                ),
            )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def list_sections(
        self,
        *,
        active_only: bool,
        include_items: bool = False,
    ) -> Sequence[OfferSection]:
        """Return offer sections in storefront display order."""

        query = select(OfferSection)

        if active_only:
            query = query.where(
                OfferSection.is_active.is_(True),
            )

        if include_items:
            query = query.options(
                selectinload(OfferSection.items).selectinload(
                    OfferItem.product,
                ),
            )

        query = query.order_by(
            OfferSection.display_order.asc(),
            OfferSection.created_at.asc(),
        )

        result = await self.session.execute(query)

        return result.scalars().unique().all()

    async def count_items(
        self,
        section_id: uuid.UUID,
    ) -> int:
        """Return how many products are in a section."""

        query = select(func.count()).select_from(OfferItem).where(
            OfferItem.section_id == section_id,
        )

        result = await self.session.execute(query)

        return int(result.scalar_one())

    async def delete_section(
        self,
        section: OfferSection,
    ) -> None:
        """Mark an offer section for deletion."""

        await self.session.delete(section)

    # ---------- Items ----------

    async def add_item(
        self,
        item: OfferItem,
    ) -> OfferItem:
        """Add a product to an offer section."""

        self.session.add(item)

        await self.session.flush()
        await self.session.refresh(item)

        return item

    async def get_item(
        self,
        item_id: uuid.UUID,
    ) -> OfferItem | None:
        """Find one offer entry by its UUID."""

        return await self.session.get(OfferItem, item_id)

    async def get_item_by_product(
        self,
        *,
        section_id: uuid.UUID,
        product_id: uuid.UUID,
    ) -> OfferItem | None:
        """Find a product's entry within one section."""

        query = select(OfferItem).where(
            OfferItem.section_id == section_id,
            OfferItem.product_id == product_id,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def delete_item(
        self,
        item: OfferItem,
    ) -> None:
        """Mark an offer entry for deletion."""

        await self.session.delete(item)

    # ---------- Pricing support ----------

    async def get_active_discount_map(
        self,
        product_ids: Sequence[uuid.UUID],
    ) -> dict[uuid.UUID, int]:
        """Return the best live section discount for each product.

        Only sections marked active contribute, so hiding a section also
        withdraws its prices immediately. An entry whose ``ends_at`` has
        passed is excluded, so an expired offer stops discounting the
        basket rather than merely disappearing from the storefront. A
        product appearing in several live sections takes the largest
        percentage.

        Returns an empty mapping when no product ids are supplied, which
        avoids issuing a query with an empty ``IN`` clause.
        """

        if not product_ids:
            return {}

        query = (
            select(
                OfferItem.product_id,
                func.max(OfferItem.discount_percent),
            )
            .join(
                OfferSection,
                OfferSection.id == OfferItem.section_id,
            )
            .where(
                OfferSection.is_active.is_(True),
                offer_item_is_live(),
                OfferItem.product_id.in_(list(product_ids)),
            )
            .group_by(OfferItem.product_id)
        )

        result = await self.session.execute(query)

        return {
            product_id: int(discount_percent)
            for product_id, discount_percent in result.all()
        }

    async def list_product_memberships(
        self,
        product_ids: Sequence[uuid.UUID],
    ) -> dict[uuid.UUID, list[tuple[OfferSection, OfferItem]]]:
        """Return which sections each product currently sits in.

        Includes hidden sections and expired entries, because the point of
        this lookup is to tell an administrator what already exists before
        they add a second, conflicting offer.
        """

        if not product_ids:
            return {}

        query = (
            select(OfferItem, OfferSection)
            .join(
                OfferSection,
                OfferSection.id == OfferItem.section_id,
            )
            .where(
                OfferItem.product_id.in_(list(product_ids)),
            )
            .order_by(
                OfferSection.display_order.asc(),
                OfferSection.created_at.asc(),
            )
        )

        result = await self.session.execute(query)

        memberships: dict[uuid.UUID, list[tuple[OfferSection, OfferItem]]] = {}

        for item, section in result.all():
            memberships.setdefault(item.product_id, []).append((section, item))

        return memberships
