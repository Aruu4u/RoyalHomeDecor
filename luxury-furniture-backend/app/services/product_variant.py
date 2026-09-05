import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.inventory import Inventory
from app.models.product_variant import ProductVariant
from app.repositories.product_variant import (
    ProductVariantRepository,
)
from app.schemas.product import (
    ProductVariantCreate,
    ProductVariantUpdate,
)


class ProductVariantService:
    """Business logic for product variants."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = ProductVariantRepository(session)

    async def add_variant(
        self,
        product_id: uuid.UUID,
        data: ProductVariantCreate,
    ) -> ProductVariant:
        """Add a variant and inventory to an existing product."""

        product_exists = await self.repository.product_exists(
            product_id,
        )

        if not product_exists:
            raise ResourceNotFoundError(f"Product '{product_id}' was not found.")

        existing_sku = await self.repository.get_by_sku(
            data.sku,
        )

        if existing_sku is not None:
            raise ResourceConflictError(f"A product variant with SKU '{data.sku}' already exists.")

        inventory_data = data.inventory

        variant_fields = data.model_dump(
            exclude={"inventory"},
            mode="json",
        )

        variant = ProductVariant(
            product_id=product_id,
            **variant_fields,
        )

        variant.inventory = Inventory(**inventory_data.model_dump(mode="json"))

        try:
            created_variant = await self.repository.create(
                variant,
            )

            await self.session.commit()

        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The product variant conflicts with an existing record."
            ) from exception

        refreshed_variant = await self.repository.reload_with_inventory(
            created_variant.id,
        )

        if refreshed_variant is None:
            raise RuntimeError("Variant was created but could not be reloaded.")

        return refreshed_variant

    async def update_variant(
        self,
        variant_id: uuid.UUID,
        data: ProductVariantUpdate,
    ) -> ProductVariant:
        """Partially update one product variant."""

        variant = await self.repository.get_by_id(
            variant_id,
        )

        if variant is None:
            raise ResourceNotFoundError(f"Product variant '{variant_id}' was not found.")

        update_data = data.model_dump(
            exclude_unset=True,
            mode="json",
        )

        new_sku = update_data.get("sku")

        if new_sku is not None and new_sku != variant.sku:
            existing_sku = await self.repository.get_by_sku(
                new_sku,
            )

            if existing_sku is not None:
                raise ResourceConflictError(
                    f"A product variant with SKU '{new_sku}' already exists."
                )

        for field_name, field_value in update_data.items():
            setattr(
                variant,
                field_name,
                field_value,
            )

        try:
            await self.session.commit()
            await self.session.refresh(variant)

        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The updated product variant conflicts with an existing record."
            ) from exception

        updated_variant = await self.repository.reload_with_inventory(
            variant.id,
        )

        if updated_variant is None:
            raise RuntimeError("Variant was updated but could not be reloaded.")

        return updated_variant

    async def delete_variant(
        self,
        variant_id: uuid.UUID,
    ) -> None:
        """Delete a variant while preserving product rules."""

        variant = await self.repository.get_by_id(
            variant_id,
        )

        if variant is None:
            raise ResourceNotFoundError(f"Product variant '{variant_id}' was not found.")

        variant_count = await self.repository.count_for_product(
            variant.product_id,
        )

        if variant_count <= 1:
            raise ResourceConflictError("A product must contain at least one variant.")

        await self.repository.delete(variant)
        await self.session.commit()
