import uuid
from collections.abc import Sequence

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.product_image import ProductImage


class ProductImageRepository:
    """Database operations for product gallery images."""

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
        image_id: uuid.UUID,
    ) -> ProductImage | None:
        """Find one product image using its UUID."""

        return await self.session.get(
            ProductImage,
            image_id,
        )

    async def list_for_product(
        self,
        product_id: uuid.UUID,
    ) -> Sequence[ProductImage]:
        """Return all images belonging to a product."""

        query = (
            select(ProductImage)
            .where(ProductImage.product_id == product_id)
            .order_by(
                ProductImage.display_order.asc(),
                ProductImage.created_at.asc(),
            )
        )

        result = await self.session.execute(query)

        return result.scalars().all()

    async def get_by_display_order(
        self,
        *,
        product_id: uuid.UUID,
        display_order: int,
    ) -> ProductImage | None:
        """Find an image using its product and gallery position."""

        query = select(ProductImage).where(
            ProductImage.product_id == product_id,
            ProductImage.display_order == display_order,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def create(
        self,
        image: ProductImage,
    ) -> ProductImage:
        """Add one image to the current transaction."""

        self.session.add(image)

        await self.session.flush()
        await self.session.refresh(image)

        return image

    async def clear_primary_image(
        self,
        product_id: uuid.UUID,
    ) -> None:
        """Remove primary status from all images of a product."""

        statement = (
            update(ProductImage)
            .where(
                ProductImage.product_id == product_id,
                ProductImage.is_primary.is_(True),
            )
            .values(is_primary=False)
        )

        await self.session.execute(statement)

    async def delete(
        self,
        image: ProductImage,
    ) -> None:
        """Mark an image for deletion."""

        await self.session.delete(image)
