import uuid

from fastapi import APIRouter, Response, status

from app.core.auth import CurrentUserDependency
from app.schemas.address import (
    AddressCreate,
    AddressResponse,
    AddressUpdate,
)
from app.services.dependencies import (
    AddressServiceDependency,
)


router = APIRouter(
    prefix="/addresses",
    tags=["Addresses"],
)


@router.post(
    "",
    response_model=AddressResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create delivery address",
)
async def create_address(
    data: AddressCreate,
    service: AddressServiceDependency,
    current_user: CurrentUserDependency,
) -> AddressResponse:
    """Create an address for the authenticated user."""

    address = await service.create_address(
        current_user.id,
        data,
    )

    return AddressResponse.model_validate(address)


@router.get(
    "",
    response_model=list[AddressResponse],
    summary="List delivery addresses",
)
async def list_addresses(
    service: AddressServiceDependency,
    current_user: CurrentUserDependency,
) -> list[AddressResponse]:
    """Return all addresses belonging to the user."""

    addresses = await service.list_addresses(
        current_user.id,
    )

    return [AddressResponse.model_validate(address) for address in addresses]


@router.patch(
    "/{address_id}",
    response_model=AddressResponse,
    summary="Update delivery address",
)
async def update_address(
    address_id: uuid.UUID,
    data: AddressUpdate,
    service: AddressServiceDependency,
    current_user: CurrentUserDependency,
) -> AddressResponse:
    """Update one address owned by the user."""

    address = await service.update_address(
        user_id=current_user.id,
        address_id=address_id,
        data=data,
    )

    return AddressResponse.model_validate(address)


@router.delete(
    "/{address_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete delivery address",
)
async def delete_address(
    address_id: uuid.UUID,
    service: AddressServiceDependency,
    current_user: CurrentUserDependency,
) -> Response:
    """Delete one address owned by the user."""

    await service.delete_address(
        user_id=current_user.id,
        address_id=address_id,
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )
