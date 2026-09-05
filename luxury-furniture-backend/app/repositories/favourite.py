import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.favourite import Favourite


class FavouriteRepository:
    """Database operations for customer favourites."""

    def __init__(
        self,
        session: AsyncSession,
    ) -> None:
        self.session = session

    async def list_by_user_id(
        self,
        user_id: uuid.UUID,
    ) -> Sequence[Favourite]:
        """Return all products saved by one customer."""

        statement = (
            select(Favourite)
            .where(
                Favourite.user_id == user_id,
            )
            .options(
                selectinload(
                    Favourite.product,
                ),
            )
            .order_by(
                Favourite.created_at.desc(),
            )
            .execution_options(
                populate_existing=True,
            )
        )

        result = await self.session.execute(
            statement,
        )

        return result.scalars().all()

    async def get_by_user_and_product(
        self,
        *,
        user_id: uuid.UUID,
        product_id: uuid.UUID,
    ) -> Favourite | None:
        """Return one saved product belonging to a customer."""

        statement = (
            select(Favourite)
            .where(
                Favourite.user_id == user_id,
                Favourite.product_id == product_id,
            )
            .options(
                selectinload(
                    Favourite.product,
                ),
            )
            .execution_options(
                populate_existing=True,
            )
        )

        result = await self.session.execute(
            statement,
        )

        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        product_id: uuid.UUID,
    ) -> Favourite:
        """Save a product for a customer."""

        favourite = Favourite(
            user_id=user_id,
            product_id=product_id,
        )

        self.session.add(favourite)

        await self.session.flush()

        created_favourite = (
            await self.get_by_user_and_product(
                user_id=user_id,
                product_id=product_id,
            )
        )

        if created_favourite is None:
            raise RuntimeError(
                "Favourite could not be loaded after creation.",
            )

        return created_favourite

    async def delete(
        self,
        favourite: Favourite,
    ) -> None:
        """Remove one product from favourites."""

        await self.session.delete(
            favourite,
        )

        await self.session.flush()