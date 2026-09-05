import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.core.auth import AdminUserDependency, OptionalUserDependency
from app.schemas.review import (
    ProductReviewCreate,
    ProductReviewListResponse,
    ProductReviewResponse,
)
from app.services.dependencies import ReviewServiceDependency


router = APIRouter(
    tags=["Reviews"],
)


# ---------- Public ----------


@router.get(
    "/products/{slug}/reviews",
    response_model=ProductReviewListResponse,
    summary="List a product's reviews",
)
async def list_product_reviews(
    slug: str,
    service: ReviewServiceDependency,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> ProductReviewListResponse:
    """Return published reviews for one product, newest first.

    The summary is calculated across every published review rather than
    only this page, so the headline score stays put while the shopper
    pages through.
    """

    return await service.list_for_slug(
        slug,
        offset=offset,
        limit=limit,
    )


@router.post(
    "/products/{slug}/reviews",
    response_model=ProductReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Write a review for a product",
)
async def create_product_review(
    slug: str,
    data: ProductReviewCreate,
    service: ReviewServiceDependency,
    current_user: OptionalUserDependency,
) -> ProductReviewResponse:
    """Store a review submitted from the product page.

    Signing in is not required, which is why the form collects a name and
    an email address. When the request does carry a valid token the review
    is linked to that account, limited to one per piece, and checked
    against the customer's orders for the verified-purchase badge.
    """

    return await service.create_for_slug(
        slug,
        data=data,
        user_id=current_user.id if current_user else None,
        user_email=current_user.email if current_user else None,
    )


# ---------- Admin: moderation ----------


@router.patch(
    "/reviews/{review_id}/approval",
    response_model=ProductReviewResponse,
    summary="Show or hide a review",
)
async def set_review_approval(
    review_id: uuid.UUID,
    service: ReviewServiceDependency,
    admin: AdminUserDependency,
    is_approved: Annotated[
        bool,
        Query(
            description=(
                "False hides the review from the storefront and removes it "
                "from the product's average, without deleting it."
            ),
        ),
    ] = True,
) -> ProductReviewResponse:
    """Take a review down, or put it back, without destroying it."""

    return await service.set_approval(review_id, is_approved=is_approved)


@router.delete(
    "/reviews/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a review",
)
async def delete_review(
    review_id: uuid.UUID,
    service: ReviewServiceDependency,
    admin: AdminUserDependency,
) -> Response:
    """Permanently delete a review.

    Hiding it is usually the better move, since a deleted review cannot
    be recovered if the decision is questioned later.
    """

    await service.delete_review(review_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
