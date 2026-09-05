import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.review import ProductReview
from app.repositories.product import ProductRepository
from app.repositories.review import ReviewRepository
from app.schemas.review import (
    ProductReviewCreate,
    ProductReviewListResponse,
    ProductReviewResponse,
    ProductReviewSummary,
)


class ReviewService:
    """Business logic for customer product reviews."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = ReviewRepository(session)
        self.product_repository = ProductRepository(session)

    async def list_for_slug(
        self,
        slug: str,
        *,
        offset: int,
        limit: int,
        approved_only: bool = True,
    ) -> ProductReviewListResponse:
        """Return a page of reviews plus the product's overall score.

        The summary covers every review, not just this page, so the
        headline score does not change as the shopper pages through.
        """

        product = await self.product_repository.get_by_slug(slug)

        if product is None:
            raise ResourceNotFoundError(f"Product with slug '{slug}' was not found.")

        reviews = await self.repository.list_for_product(
            product.id,
            offset=offset,
            limit=limit,
            approved_only=approved_only,
        )

        count, average, breakdown = await self.repository.summarise(
            product.id,
            approved_only=approved_only,
        )

        return ProductReviewListResponse(
            summary=ProductReviewSummary(
                review_count=count,
                average_rating=average,
                breakdown=breakdown,
            ),
            reviews=[
                ProductReviewResponse.model_validate(review) for review in reviews
            ],
        )

    async def create_for_slug(
        self,
        slug: str,
        *,
        data: ProductReviewCreate,
        user_id: uuid.UUID | None,
        user_email: str | None,
    ) -> ProductReviewResponse:
        """Store a review written on the product page.

        A signed-in customer may review each piece once; a second attempt
        is refused rather than silently replacing the first, so their
        original words are never lost without them asking.
        """

        product = await self.product_repository.get_by_slug(slug)

        if product is None:
            raise ResourceNotFoundError(f"Product with slug '{slug}' was not found.")

        is_verified_purchase = False

        if user_id is not None:
            existing = await self.repository.get_existing_for_user(
                product_id=product.id,
                user_id=user_id,
            )

            if existing is not None:
                raise ResourceConflictError(
                    "You have already reviewed this piece."
                )

            # Decided here from the customer's own order history, never
            # taken from the request, so the badge cannot be claimed.
            is_verified_purchase = await self.repository.has_purchased(
                product_id=product.id,
                user_id=user_id,
            )

        review = ProductReview(
            product_id=product.id,
            user_id=user_id,
            author_name=data.author_name,
            # Fall back to the signed-in address so a customer does not
            # have to retype what the shop already knows.
            author_email=(
                str(data.author_email) if data.author_email else user_email
            ),
            rating=data.rating,
            title=data.title,
            body=data.body,
            photo_urls=[str(url) for url in data.photo_urls],
            is_verified_purchase=is_verified_purchase,
        )

        try:
            await self.repository.add(review)
            await self.session.commit()
        except IntegrityError as exception:
            await self.session.rollback()

            # The partial unique index catches a duplicate that slipped
            # past the check above, for instance two submissions racing.
            raise ResourceConflictError(
                "You have already reviewed this piece."
            ) from exception

        await self.session.refresh(review)

        return ProductReviewResponse.model_validate(review)

    async def delete_review(
        self,
        review_id: uuid.UUID,
    ) -> None:
        """Permanently delete a review. Administrators only."""

        review = await self.repository.get_by_id(review_id)

        if review is None:
            raise ResourceNotFoundError(f"Review '{review_id}' was not found.")

        await self.repository.delete(review)
        await self.session.commit()

    async def set_approval(
        self,
        review_id: uuid.UUID,
        *,
        is_approved: bool,
    ) -> ProductReviewResponse:
        """Show or hide a review without deleting it.

        Preferred over deletion for moderation: the record survives, so a
        decision can be reversed and the original text is still there if
        it is ever disputed.
        """

        review = await self.repository.get_by_id(review_id)

        if review is None:
            raise ResourceNotFoundError(f"Review '{review_id}' was not found.")

        review.is_approved = is_approved

        await self.session.commit()
        await self.session.refresh(review)

        return ProductReviewResponse.model_validate(review)
