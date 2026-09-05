import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.product_image import ProductImage
from app.repositories.product_image import ProductImageRepository
from app.schemas.product import (
    ProductImageCreate,
    ProductImageUpdate,
)


class ProductImageService:
    """Business logic for product gallery images."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = ProductImageRepository(session)

    async def add_image(
        self,
        product_id: uuid.UUID,
        data: ProductImageCreate,
    ) -> ProductImage:
        """Add an image to an existing product."""

        product_exists = await self.repository.product_exists(
            product_id,
        )

        if not product_exists:
            raise ResourceNotFoundError(f"Product '{product_id}' was not found.")

        existing_position = await self.repository.get_by_display_order(
            product_id=product_id,
            display_order=data.display_order,
        )

        if existing_position is not None:
            raise ResourceConflictError(
                f"Another product image already uses display order {data.display_order}."
            )

        if data.is_primary:
            await self.repository.clear_primary_image(
                product_id,
            )

        image = ProductImage(
            product_id=product_id,
            **data.model_dump(mode="json"),
        )

        try:
            created_image = await self.repository.create(image)
            await self.session.commit()
            await self.session.refresh(created_image)

        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The product image conflicts with an existing record."
            ) from exception

        return created_image

    async def update_image(
        self,
        image_id: uuid.UUID,
        data: ProductImageUpdate,
    ) -> ProductImage:
        """Update one product gallery image."""

        image = await self.repository.get_by_id(image_id)

        if image is None:
            raise ResourceNotFoundError(f"Product image '{image_id}' was not found.")

        update_data = data.model_dump(
            exclude_unset=True,
            mode="json",
        )

        new_display_order = update_data.get("display_order")

        if new_display_order is not None and new_display_order != image.display_order:
            existing_position = await self.repository.get_by_display_order(
                product_id=image.product_id,
                display_order=new_display_order,
            )

            if existing_position is not None:
                raise ResourceConflictError(
                    f"Another product image already uses display order {new_display_order}."
                )

        new_primary_status = update_data.get("is_primary")

        if new_primary_status is False and image.is_primary:
            raise ResourceConflictError(
                "The current primary image cannot be unset directly. "
                "Set another image as primary instead."
            )

        if new_primary_status is True and not image.is_primary:
            await self.repository.clear_primary_image(
                image.product_id,
            )

        for field_name, field_value in update_data.items():
            setattr(
                image,
                field_name,
                field_value,
            )

        try:
            await self.session.commit()
            await self.session.refresh(image)

        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The updated product image conflicts with an existing record."
            ) from exception

        return image

    async def delete_image(
        self,
        image_id: uuid.UUID,
    ) -> None:
        """Delete an image while preserving gallery rules."""

        image = await self.repository.get_by_id(image_id)

        if image is None:
            raise ResourceNotFoundError(f"Product image '{image_id}' was not found.")

        product_images = list(
            await self.repository.list_for_product(
                image.product_id,
            )
        )

        if len(product_images) == 1:
            raise ResourceConflictError("A product must contain at least one image.")

        remaining_images = [
            product_image for product_image in product_images if product_image.id != image.id
        ]

        if image.is_primary:
            next_primary_image = min(
                remaining_images,
                key=lambda product_image: (
                    product_image.display_order,
                    product_image.created_at,
                ),
            )

            next_primary_image.is_primary = True

        await self.repository.delete(image)
        await self.session.commit()
