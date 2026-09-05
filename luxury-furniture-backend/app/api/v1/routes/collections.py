import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status
from app.core.auth import AdminUserDependency
from app.schemas.collection import (
    CollectionCreate,
    CollectionResponse,
    CollectionUpdate,
)
from app.services.dependencies import CollectionServiceDependency


router = APIRouter(
    prefix="/collections",
    tags=["Collections"],
)


@router.post(
    "",
    response_model=CollectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a furniture collection",
)
async def create_collection(
    data: CollectionCreate,
    service: CollectionServiceDependency,
    admin: AdminUserDependency,
) -> CollectionResponse:
    """Create a new homepage furniture collection."""

    collection = await service.create_collection(data)

    return CollectionResponse.model_validate(collection)


@router.get(
    "",
    response_model=list[CollectionResponse],
    summary="List furniture collections",
)
async def list_collections(
    service: CollectionServiceDependency,
    offset: Annotated[
        int,
        Query(ge=0),
    ] = 0,
    limit: Annotated[
        int,
        Query(ge=1, le=100),
    ] = 20,
    active_only: bool = True,
) -> list[CollectionResponse]:
    """Return collections in homepage display order."""

    collections = await service.list_collections(
        offset=offset,
        limit=limit,
        active_only=active_only,
    )

    return [CollectionResponse.model_validate(collection) for collection in collections]


@router.get(
    "/{slug}",
    response_model=CollectionResponse,
    summary="Get one furniture collection",
)
async def get_collection(
    slug: str,
    service: CollectionServiceDependency,
) -> CollectionResponse:
    """Find a collection using its URL slug."""

    collection = await service.get_collection_by_slug(slug)

    return CollectionResponse.model_validate(collection)


@router.patch(
    "/{collection_id}",
    response_model=CollectionResponse,
    summary="Update a furniture collection",
)
async def update_collection(
    collection_id: uuid.UUID,
    data: CollectionUpdate,
    service: CollectionServiceDependency,
    admin: AdminUserDependency,
) -> CollectionResponse:
    """Partially update a collection."""

    collection = await service.update_collection(
        collection_id,
        data,
    )

    return CollectionResponse.model_validate(collection)


@router.delete(
    "/{collection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a furniture collection",
)
async def delete_collection(
    collection_id: uuid.UUID,
    service: CollectionServiceDependency,
    admin: AdminUserDependency,
) -> Response:
    """Permanently delete a collection."""

    await service.delete_collection(collection_id)

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )
