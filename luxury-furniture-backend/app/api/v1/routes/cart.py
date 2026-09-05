import uuid

from fastapi import APIRouter, Response, status

from app.core.auth import CurrentUserDependency
from app.schemas.cart import (
    CartItemCreate,
    CartItemUpdate,
    CartResponse,
)
from app.services.dependencies import CartServiceDependency


router = APIRouter(
    prefix="/cart",
    tags=["Cart"],
)


@router.get(
    "",
    response_model=CartResponse,
)
async def get_cart(
    current_user: CurrentUserDependency,
    service: CartServiceDependency,
) -> CartResponse:
    """Return the authenticated customer's cart."""

    return await service.get_cart(
        current_user.id,
    )


@router.post(
    "/items",
    response_model=CartResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_cart_item(
    data: CartItemCreate,
    current_user: CurrentUserDependency,
    service: CartServiceDependency,
) -> CartResponse:
    """Add a product variant to the customer's cart."""

    return await service.add_item(
        user_id=current_user.id,
        data=data,
    )


@router.patch(
    "/items/{item_id}",
    response_model=CartResponse,
)
async def update_cart_item(
    item_id: uuid.UUID,
    data: CartItemUpdate,
    current_user: CurrentUserDependency,
    service: CartServiceDependency,
) -> CartResponse:
    """Change the quantity of a cart item."""

    return await service.update_item(
        user_id=current_user.id,
        item_id=item_id,
        data=data,
    )


@router.delete(
    "/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_cart_item(
    item_id: uuid.UUID,
    current_user: CurrentUserDependency,
    service: CartServiceDependency,
) -> Response:
    """Remove one item from the customer's cart."""

    await service.delete_item(
        user_id=current_user.id,
        item_id=item_id,
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def clear_cart(
    current_user: CurrentUserDependency,
    service: CartServiceDependency,
) -> Response:
    """Remove all items from the customer's cart."""

    await service.clear_cart(
        current_user.id,
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )
