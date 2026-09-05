import uuid

from fastapi import APIRouter, status

from app.core.auth import CurrentUserDependency
from app.schemas.order import (
    CheckoutCreate,
    OrderListResponse,
    OrderResponse,
)
from app.services.dependencies import OrderServiceDependency


router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)


@router.post(
    "/checkout",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def checkout(
    data: CheckoutCreate,
    current_user: CurrentUserDependency,
    service: OrderServiceDependency,
) -> OrderResponse:
    """Create an order from the authenticated user's cart."""

    return await service.checkout(
        user_id=current_user.id,
        data=data,
    )


@router.get(
    "",
    response_model=list[OrderListResponse],
)
async def list_orders(
    current_user: CurrentUserDependency,
    service: OrderServiceDependency,
) -> list[OrderListResponse]:
    """Return all orders belonging to the authenticated user."""

    orders = await service.list_orders(
        current_user.id,
    )

    return [OrderListResponse.model_validate(order) for order in orders]


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
)
async def get_order(
    order_id: uuid.UUID,
    current_user: CurrentUserDependency,
    service: OrderServiceDependency,
) -> OrderResponse:
    """Return one order belonging to the authenticated user."""

    return await service.get_order(
        user_id=current_user.id,
        order_id=order_id,
    )
