import uuid

from fastapi import APIRouter

from app.core.auth import AdminUserDependency
from app.models.order import Order
from app.schemas.order import (
    AdminOrderStatusUpdate,
    OrderListResponse,
    OrderResponse,
)
from app.services.dependencies import OrderServiceDependency


router = APIRouter(
    prefix="/admin/orders",
    tags=["Admin Orders"],
)


@router.get(
    "",
    response_model=list[OrderListResponse],
)
async def list_all_orders(
    _admin: AdminUserDependency,
    service: OrderServiceDependency,
) -> list[OrderListResponse]:
    """Return all customer orders."""

    orders: list[Order] = await service.list_all_orders()

    return [OrderListResponse.model_validate(order) for order in orders]


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
)
async def get_order_admin(
    order_id: uuid.UUID,
    _admin: AdminUserDependency,
    service: OrderServiceDependency,
) -> OrderResponse:
    """Return one customer order."""

    return await service.get_order_admin(order_id)


@router.patch(
    "/{order_id}/status",
    response_model=OrderResponse,
)
async def update_order_status(
    order_id: uuid.UUID,
    data: AdminOrderStatusUpdate,
    _admin: AdminUserDependency,
    service: OrderServiceDependency,
) -> OrderResponse:
    """Update an order's fulfilment status."""

    return await service.update_order_status(
        order_id=order_id,
        data=data,
    )
