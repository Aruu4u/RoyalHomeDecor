import uuid

from fastapi import APIRouter, Response, status
from app.core.auth import AdminUserDependency
from app.schemas.product import (
    ProductImageCreate,
    ProductImageResponse,
    ProductImageUpdate,
)
from app.services.dependencies import (
    ProductImageServiceDependency,
)


router = APIRouter(
    tags=["Product Images"],
)


@router.post(
    "/products/{product_id}/images",
    response_model=ProductImageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an image to a product",
)
async def add_product_image(
    product_id: uuid.UUID,
    data: ProductImageCreate,
    service: ProductImageServiceDependency,
    _admin: AdminUserDependency,
) -> ProductImageResponse:
    """Add one gallery image to an existing product."""

    image = await service.add_image(
        product_id,
        data,
    )

    return ProductImageResponse.model_validate(image)


@router.patch(
    "/product-images/{image_id}",
    response_model=ProductImageResponse,
    summary="Update a product image",
)
async def update_product_image(
    image_id: uuid.UUID,
    data: ProductImageUpdate,
    service: ProductImageServiceDependency,
    admin: AdminUserDependency,
) -> ProductImageResponse:
    """Partially update an existing product image."""

    image = await service.update_image(
        image_id,
        data,
    )

    return ProductImageResponse.model_validate(image)


@router.delete(
    "/product-images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product image",
)
async def delete_product_image(
    image_id: uuid.UUID,
    service: ProductImageServiceDependency,
    admin: AdminUserDependency,
) -> Response:
    """Delete an image while keeping the gallery valid."""

    await service.delete_image(image_id)

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )
