import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.inventory import Inventory
from app.repositories.inventory import InventoryRepository
from app.schemas.product import InventoryUpdate


class InventoryService:
    """Business logic for variant inventory."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = InventoryRepository(session)

    async def update_inventory(
        self,
        variant_id: uuid.UUID,
        data: InventoryUpdate,
    ) -> Inventory:
        """Partially update inventory for one product variant."""

        inventory = await self.repository.get_by_variant_id(
            variant_id,
        )

        if inventory is None:
            variant_exists = await self.repository.variant_exists(
                variant_id,
            )

            if not variant_exists:
                raise ResourceNotFoundError(f"Product variant '{variant_id}' was not found.")

            raise ResourceNotFoundError(
                f"Inventory for product variant '{variant_id}' was not found."
            )

        update_data = data.model_dump(
            exclude_unset=True,
        )

        new_quantity_on_hand = update_data.get(
            "quantity_on_hand",
            inventory.quantity_on_hand,
        )

        new_reserved_quantity = update_data.get(
            "reserved_quantity",
            inventory.reserved_quantity,
        )

        if new_reserved_quantity > new_quantity_on_hand:
            raise ResourceConflictError("Reserved quantity cannot exceed quantity on hand.")

        for field_name, field_value in update_data.items():
            setattr(
                inventory,
                field_name,
                field_value,
            )

        try:
            await self.session.commit()
            await self.session.refresh(inventory)

        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The inventory update conflicts with the current stock values."
            ) from exception

        updated_inventory = await self.repository.reload(
            variant_id,
        )

        if updated_inventory is None:
            raise RuntimeError("Inventory was updated but could not be reloaded.")

        return updated_inventory
