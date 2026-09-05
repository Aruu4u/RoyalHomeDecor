import uuid

from fastapi import APIRouter, Response, status
from app.core.auth import AdminUserDependency
from app.schemas.product import (
    ProductVariantCreate,
    ProductVariantResponse,
    ProductVariantUpdate,
)
from app.services.dependencies import (
    ProductVariantServiceDependency,
)


router = APIRouter(
    tags=["Product Variants"],
)


@router.post(
    "/products/{product_id}/variants",
    response_model=ProductVariantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a variant to a product",
)
async def add_product_variant(
    product_id: uuid.UUID,
    data: ProductVariantCreate,
    service: ProductVariantServiceDependency,
    admin: AdminUserDependency,
) -> ProductVariantResponse:
    """Add a variant and inventory row to a product."""

    variant = await service.add_variant(
        product_id,
        data,
    )

    return ProductVariantResponse.model_validate(variant)


@router.patch(
    "/product-variants/{variant_id}",
    response_model=ProductVariantResponse,
    summary="Update a product variant",
)
async def update_product_variant(
    variant_id: uuid.UUID,
    data: ProductVariantUpdate,
    service: ProductVariantServiceDependency,
    admin: AdminUserDependency,
) -> ProductVariantResponse:
    """Partially update one product variant."""

    variant = await service.update_variant(
        variant_id,
        data,
    )

    return ProductVariantResponse.model_validate(variant)


@router.delete(
    "/product-variants/{variant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product variant",
)
async def delete_product_variant(
    variant_id: uuid.UUID,
    service: ProductVariantServiceDependency,
    admin: AdminUserDependency,
) -> Response:
    """Delete a variant while keeping at least one variant."""

    await service.delete_variant(variant_id)

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )
