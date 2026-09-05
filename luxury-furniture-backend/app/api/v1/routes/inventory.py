import uuid

from fastapi import APIRouter
from app.core.auth import AdminUserDependency
from app.schemas.product import (
    InventoryResponse,
    InventoryUpdate,
)
from app.services.dependencies import (
    InventoryServiceDependency,
)


router = APIRouter(
    tags=["Inventory"],
)


@router.patch(
    "/inventory/{variant_id}",
    response_model=InventoryResponse,
    summary="Update variant inventory",
)
async def update_inventory(
    variant_id: uuid.UUID,
    data: InventoryUpdate,
    service: InventoryServiceDependency,
    admin: AdminUserDependency,
) -> InventoryResponse:
    """Partially update stock values for one variant."""

    inventory = await service.update_inventory(
        variant_id,
        data,
    )

    return InventoryResponse.model_validate(inventory)
