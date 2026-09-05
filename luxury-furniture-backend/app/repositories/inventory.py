import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import Inventory
from app.models.product_variant import ProductVariant


class InventoryRepository:
    """Database operations for product inventory."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_variant_id(
        self,
        variant_id: uuid.UUID,
    ) -> Inventory | None:
        """Find inventory using its product variant UUID."""

        query = select(Inventory).where(
            Inventory.variant_id == variant_id,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def variant_exists(
        self,
        variant_id: uuid.UUID,
    ) -> bool:
        """Check whether a product variant exists."""

        query = select(select(ProductVariant.id).where(ProductVariant.id == variant_id).exists())

        result = await self.session.execute(query)

        return bool(result.scalar())

    async def reload(
        self,
        variant_id: uuid.UUID,
    ) -> Inventory | None:
        """Reload inventory from PostgreSQL."""

        query = (
            select(Inventory)
            .where(
                Inventory.variant_id == variant_id,
            )
            .options(selectinload(Inventory.variant))
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()
