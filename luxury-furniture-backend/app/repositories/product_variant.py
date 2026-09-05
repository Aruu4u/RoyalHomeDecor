import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product
from app.models.product_variant import ProductVariant


class ProductVariantRepository:
    """Database operations for product variants."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def product_exists(
        self,
        product_id: uuid.UUID,
    ) -> bool:
        """Check whether a product exists."""

        query = select(select(Product.id).where(Product.id == product_id).exists())

        result = await self.session.execute(query)

        return bool(result.scalar())

    async def get_by_id(
        self,
        variant_id: uuid.UUID,
        *,
        include_inventory: bool = False,
    ) -> ProductVariant | None:
        """Find one variant using its UUID."""

        query = select(ProductVariant).where(
            ProductVariant.id == variant_id,
        )

        if include_inventory:
            query = query.options(selectinload(ProductVariant.inventory))

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def get_by_sku(
        self,
        sku: str,
    ) -> ProductVariant | None:
        """Find a variant using its SKU."""

        query = select(ProductVariant).where(
            ProductVariant.sku == sku.upper(),
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def list_for_product(
        self,
        product_id: uuid.UUID,
    ) -> Sequence[ProductVariant]:
        """Return all variants belonging to one product."""

        query = (
            select(ProductVariant)
            .where(
                ProductVariant.product_id == product_id,
            )
            .order_by(
                ProductVariant.created_at.asc(),
            )
        )

        result = await self.session.execute(query)

        return result.scalars().all()

    async def count_for_product(
        self,
        product_id: uuid.UUID,
    ) -> int:
        """Count variants belonging to one product."""

        query = select(func.count(ProductVariant.id)).where(
            ProductVariant.product_id == product_id,
        )

        result = await self.session.execute(query)

        return int(result.scalar_one())

    async def create(
        self,
        variant: ProductVariant,
    ) -> ProductVariant:
        """Add one variant and its inventory row."""

        self.session.add(variant)

        await self.session.flush()

        created_variant = await self.get_by_id(
            variant.id,
            include_inventory=True,
        )

        if created_variant is None:
            raise RuntimeError("Variant could not be reloaded after creation.")

        return created_variant

    async def reload_with_inventory(
        self,
        variant_id: uuid.UUID,
    ) -> ProductVariant | None:
        """Reload a variant with its inventory relationship."""

        existing_variant = await self.get_by_id(
            variant_id,
        )

        if existing_variant is not None:
            self.session.expire(
                existing_variant,
                attribute_names=["inventory"],
            )

        return await self.get_by_id(
            variant_id,
            include_inventory=True,
        )

    async def delete(
        self,
        variant: ProductVariant,
    ) -> None:
        """Mark a variant for deletion."""

        await self.session.delete(variant)
