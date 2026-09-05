import uuid

from fastapi import APIRouter, Response, status

from app.core.auth import CurrentUserDependency
from app.schemas.favourite import FavouriteResponse
from app.services.dependencies import (
    FavouriteServiceDependency,
)


router = APIRouter(
    prefix="/favourites",
    tags=["Favourites"],
)


@router.get(
    "",
    response_model=list[FavouriteResponse],
)
async def list_favourites(
    current_user: CurrentUserDependency,
    service: FavouriteServiceDependency,
) -> list[FavouriteResponse]:
    """Return the authenticated customer's favourites."""

    return await service.list_favourites(
        current_user.id,
    )


@router.post(
    "/{product_id}",
    response_model=FavouriteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_favourite(
    product_id: uuid.UUID,
    current_user: CurrentUserDependency,
    service: FavouriteServiceDependency,
) -> FavouriteResponse:
    """Save a product to the customer's favourites."""

    return await service.add_favourite(
        user_id=current_user.id,
        product_id=product_id,
    )


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_favourite(
    product_id: uuid.UUID,
    current_user: CurrentUserDependency,
    service: FavouriteServiceDependency,
) -> Response:
    """Remove a product from the customer's favourites."""

    await service.delete_favourite(
        user_id=current_user.id,
        product_id=product_id,
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )