import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.models.order_enums import OrderStatus
from app.models.order_item import OrderItem
from app.models.review import ProductReview


# States in which the customer can be said to have actually bought the
# piece. A pending or cancelled order is not a purchase.
PURCHASED_ORDER_STATUSES = (
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
)


class ReviewRepository:
    """Database operations for product reviews."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, review: ProductReview) -> ProductReview:
        """Add a review to the current transaction."""

        self.session.add(review)

        await self.session.flush()
        await self.session.refresh(review)

        return review

    async def get_by_id(
        self,
        review_id: uuid.UUID,
    ) -> ProductReview | None:
        """Find one review by its UUID."""

        return await self.session.get(ProductReview, review_id)

    async def list_for_product(
        self,
        product_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        approved_only: bool = True,
    ) -> Sequence[ProductReview]:
        """Return a product's reviews, newest first."""

        query = select(ProductReview).where(
            ProductReview.product_id == product_id,
        )

        if approved_only:
            query = query.where(
                ProductReview.is_approved.is_(True),
            )

        query = (
            query.order_by(ProductReview.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await self.session.execute(query)

        return result.scalars().all()

    async def summarise(
        self,
        product_id: uuid.UUID,
        *,
        approved_only: bool = True,
    ) -> tuple[int, float | None, dict[int, int]]:
        """Return the count, average and per-star breakdown for a product.

        The breakdown always has all five keys, including zeros, so the
        storefront can draw the distribution bars without filling gaps
        itself.
        """

        query = select(
            ProductReview.rating,
            func.count(ProductReview.id),
        ).where(
            ProductReview.product_id == product_id,
        )

        if approved_only:
            query = query.where(
                ProductReview.is_approved.is_(True),
            )

        query = query.group_by(ProductReview.rating)

        result = await self.session.execute(query)

        breakdown = {star: 0 for star in range(1, 6)}

        total_count = 0
        weighted_total = 0

        for rating, count in result.all():
            breakdown[int(rating)] = int(count)

            total_count += int(count)
            weighted_total += int(rating) * int(count)

        if total_count == 0:
            return 0, None, breakdown

        return total_count, round(weighted_total / total_count, 2), breakdown

    async def get_existing_for_user(
        self,
        *,
        product_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> ProductReview | None:
        """Find a signed-in customer's existing review of one product."""

        query = select(ProductReview).where(
            ProductReview.product_id == product_id,
            ProductReview.user_id == user_id,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def has_purchased(
        self,
        *,
        product_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        """Check whether this customer has actually bought the product.

        Used to stamp ``is_verified_purchase`` on the server. It is never
        taken from the request body, so the badge cannot be self-awarded.
        """

        query = (
            select(OrderItem.id)
            .join(
                Order,
                Order.id == OrderItem.order_id,
            )
            .where(
                OrderItem.product_id == product_id,
                Order.user_id == user_id,
                Order.status.in_(PURCHASED_ORDER_STATUSES),
            )
            .exists()
        )

        result = await self.session.execute(select(query))

        return bool(result.scalar())

    async def delete(self, review: ProductReview) -> None:
        """Mark a review for deletion."""

        await self.session.delete(review)
