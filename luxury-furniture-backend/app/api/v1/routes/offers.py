import uuid

from fastapi import APIRouter, Response, status

from app.core.auth import AdminUserDependency
from app.schemas.offer import (
    OfferItemCreate,
    OfferItemUpdate,
    OfferSectionCreate,
    OfferSectionDetailResponse,
    OfferSectionUpdate,
    ProductOfferStatusResponse,
    ProductOfferUpdate,
)
from app.schemas.product import ProductDetailResponse
from app.services.dependencies import (
    OfferServiceDependency,
    ProductServiceDependency,
)


router = APIRouter(
    prefix="/offers",
    tags=["Offers"],
)


# ---------- Public ----------


@router.get(
    "/sections",
    response_model=list[OfferSectionDetailResponse],
    summary="List special offer sections",
)
async def list_offer_sections(
    service: OfferServiceDependency,
    active_only: bool = True,
) -> list[OfferSectionDetailResponse]:
    """Return offer sections with their discounted products.

    The storefront calls this with the default ``active_only=true``, so a
    section the administrator has hidden disappears from the site while
    remaining editable in the dashboard.
    """

    return await service.list_sections(active_only=active_only)


@router.get(
    "/sections/{slug}",
    response_model=OfferSectionDetailResponse,
    summary="Get one special offer section",
)
async def get_offer_section(
    slug: str,
    service: OfferServiceDependency,
) -> OfferSectionDetailResponse:
    """Find an offer section using its URL slug."""

    return await service.get_section_by_slug(slug)


# ---------- Admin: sections ----------


@router.post(
    "/sections",
    response_model=OfferSectionDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a special offer section",
)
async def create_offer_section(
    data: OfferSectionCreate,
    service: OfferServiceDependency,
    admin: AdminUserDependency,
) -> OfferSectionDetailResponse:
    """Create a themed offer section, such as a Diwali sale."""

    return await service.create_section(data)


@router.patch(
    "/sections/{section_id}",
    response_model=OfferSectionDetailResponse,
    summary="Update a special offer section",
)
async def update_offer_section(
    section_id: uuid.UUID,
    data: OfferSectionUpdate,
    service: OfferServiceDependency,
    admin: AdminUserDependency,
) -> OfferSectionDetailResponse:
    """Partially update an offer section, including hiding it."""

    return await service.update_section(section_id, data)


@router.delete(
    "/sections/{section_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a special offer section",
)
async def delete_offer_section(
    section_id: uuid.UUID,
    service: OfferServiceDependency,
    admin: AdminUserDependency,
) -> Response:
    """Delete an offer section. The products themselves are kept."""

    await service.delete_section(section_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Admin: products within a section ----------


@router.post(
    "/sections/{section_id}/items",
    response_model=OfferSectionDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a product to an offer section",
)
async def add_offer_item(
    section_id: uuid.UUID,
    data: OfferItemCreate,
    service: OfferServiceDependency,
    admin: AdminUserDependency,
) -> OfferSectionDetailResponse:
    """Put an existing product in the section at a discount."""

    return await service.add_item(section_id=section_id, data=data)


@router.patch(
    "/items/{item_id}",
    response_model=OfferSectionDetailResponse,
    summary="Update a product's offer entry",
)
async def update_offer_item(
    item_id: uuid.UUID,
    data: OfferItemUpdate,
    service: OfferServiceDependency,
    admin: AdminUserDependency,
) -> OfferSectionDetailResponse:
    """Change the discount percentage or ordering of one entry."""

    return await service.update_item(item_id=item_id, data=data)


@router.delete(
    "/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a product from an offer section",
)
async def remove_offer_item(
    item_id: uuid.UUID,
    service: OfferServiceDependency,
    admin: AdminUserDependency,
) -> Response:
    """Take a product out of an offer section."""

    await service.remove_item(item_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Admin: individual product offer ----------


@router.get(
    "/products/{product_id}",
    response_model=ProductOfferStatusResponse,
    summary="See every offer attached to one product",
)
async def get_product_offer_status(
    product_id: uuid.UUID,
    service: OfferServiceDependency,
    admin: AdminUserDependency,
) -> ProductOfferStatusResponse:
    """Report the product's own offer and its section memberships.

    Used by the dashboard for two things: showing which special offers a
    product already belongs to on its edit page, and warning before a
    second, conflicting offer is added on top of a running one.

    Hidden sections and expired entries are included, with ``is_live``
    saying which of them a customer is actually getting.
    """

    return await service.get_product_offer_status(product_id)


@router.patch(
    "/products/{product_id}",
    response_model=ProductDetailResponse,
    summary="Set or clear a product's own offer",
)
async def set_product_offer(
    product_id: uuid.UUID,
    data: ProductOfferUpdate,
    offer_service: OfferServiceDependency,
    product_service: ProductServiceDependency,
    admin: AdminUserDependency,
) -> ProductDetailResponse:
    """Apply a discount to one product, independent of any section.

    Send ``offer_percent: null`` to remove it.
    """

    product = await offer_service.set_product_offer(
        product_id=product_id,
        data=data,
    )

    # Re-read through the product service so the response carries the
    # same resolved offer pricing as every other product endpoint.
    return await product_service.get_product_by_slug(product.slug)
