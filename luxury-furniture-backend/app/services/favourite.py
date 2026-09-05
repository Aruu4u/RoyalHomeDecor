import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.repositories.favourite import FavouriteRepository
from app.repositories.product import ProductRepository
from app.schemas.favourite import FavouriteResponse
from app.services.product import ProductService


class FavouriteService:
    """Business logic for customer favourites."""

    def __init__(
        self,
        session: AsyncSession,
    ) -> None:
        self.session = session
        self.favourite_repository = FavouriteRepository(
            session,
        )
        self.product_repository = ProductRepository(
            session,
        )

        # Reused rather than reimplemented, so a saved piece shows exactly
        # the same offer price and stock state as it does everywhere else.
        self.product_service = ProductService(
            session,
        )

    async def list_favourites(
        self,
        user_id: uuid.UUID,
    ) -> list[FavouriteResponse]:
        """Return every product saved by the customer."""

        favourites = (
            await self.favourite_repository.list_by_user_id(
                user_id,
            )
        )

        await self.product_service.annotate(
            [
                favourite.product
                for favourite in favourites
                if favourite.product is not None
            ],
        )

        return [
            FavouriteResponse.model_validate(
                favourite,
            )
            for favourite in favourites
        ]

    async def add_favourite(
        self,
        *,
        user_id: uuid.UUID,
        product_id: uuid.UUID,
    ) -> FavouriteResponse:
        """Save one active product for the customer."""

        product = await self.product_repository.get_by_id(
            product_id,
        )

        if product is None:
            raise ResourceNotFoundError(
                f"Product '{product_id}' was not found.",
            )

        if not product.is_active:
            raise ResourceConflictError(
                "This product is not currently available.",
            )

        existing_favourite = (
            await self.favourite_repository
            .get_by_user_and_product(
                user_id=user_id,
                product_id=product_id,
            )
        )

        if existing_favourite is not None:
            raise ResourceConflictError(
                "This product is already in your favourites.",
            )

        await self.favourite_repository.create(
            user_id=user_id,
            product_id=product_id,
        )

        await self.session.commit()

        created_favourite = (
            await self.favourite_repository
            .get_by_user_and_product(
                user_id=user_id,
                product_id=product_id,
            )
        )

        if created_favourite is None:
            raise RuntimeError(
                "Favourite could not be loaded after creation.",
            )

        if created_favourite.product is not None:
            await self.product_service.annotate(
                [created_favourite.product],
            )

        return FavouriteResponse.model_validate(
            created_favourite,
        )

    async def delete_favourite(
        self,
        *,
        user_id: uuid.UUID,
        product_id: uuid.UUID,
    ) -> None:
        """Remove one saved product from the customer account."""

        favourite = (
            await self.favourite_repository
            .get_by_user_and_product(
                user_id=user_id,
                product_id=product_id,
            )
        )

        if favourite is None:
            raise ResourceNotFoundError(
                f"Favourite product '{product_id}' was not found.",
            )

        await self.favourite_repository.delete(
            favourite,
        )

        await self.session.commit()