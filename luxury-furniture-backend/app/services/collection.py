import uuid
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.collection import Collection
from app.repositories.collection import CollectionRepository
from app.schemas.collection import (
    CollectionCreate,
    CollectionUpdate,
)


class CollectionService:
    """Business logic for furniture collections."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = CollectionRepository(session)

    async def create_collection(
        self,
        data: CollectionCreate,
    ) -> Collection:
        """Create a collection after checking unique fields."""

        existing_slug = await self.repository.get_by_slug(
            data.slug,
        )

        if existing_slug is not None:
            raise ResourceConflictError(f"A collection with slug '{data.slug}' already exists.")

        existing_name = await self.repository.get_by_name(
            data.name,
        )

        if existing_name is not None:
            raise ResourceConflictError(f"A collection named '{data.name}' already exists.")

        collection = Collection(
            **data.model_dump(
                mode="json",
            ),
        )

        try:
            await self.repository.create(collection)
            await self.session.commit()
        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The collection conflicts with an existing record."
            ) from exception

        return collection

    async def list_collections(
        self,
        *,
        offset: int,
        limit: int,
        active_only: bool,
    ) -> Sequence[Collection]:
        """Return collections visible to the requesting user."""

        return await self.repository.list(
            offset=offset,
            limit=limit,
            active_only=active_only,
        )

    async def get_collection_by_slug(
        self,
        slug: str,
    ) -> Collection:
        """Return one collection or raise a not-found error."""

        collection = await self.repository.get_by_slug(slug)

        if collection is None:
            raise ResourceNotFoundError(f"Collection with slug '{slug}' was not found.")

        return collection

    async def update_collection(
        self,
        collection_id: uuid.UUID,
        data: CollectionUpdate,
    ) -> Collection:
        """Update only the supplied collection fields."""

        collection = await self.repository.get_by_id(
            collection_id,
        )

        if collection is None:
            raise ResourceNotFoundError(f"Collection '{collection_id}' was not found.")

        update_data = data.model_dump(
            exclude_unset=True,
            mode="json",
        )

        new_slug = update_data.get("slug")

        if new_slug is not None and new_slug != collection.slug:
            existing_slug = await self.repository.get_by_slug(
                new_slug,
            )

            if existing_slug is not None:
                raise ResourceConflictError(f"A collection with slug '{new_slug}' already exists.")

        new_name = update_data.get("name")

        if new_name is not None and new_name.lower() != collection.name.lower():
            existing_name = await self.repository.get_by_name(
                new_name,
            )

            if existing_name is not None:
                raise ResourceConflictError(f"A collection named '{new_name}' already exists.")

        for field_name, field_value in update_data.items():
            setattr(
                collection,
                field_name,
                field_value,
            )

        try:
            await self.session.commit()
            await self.session.refresh(collection)
        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The updated collection conflicts with an existing record."
            ) from exception

        return collection

    async def delete_collection(
        self,
        collection_id: uuid.UUID,
    ) -> None:
        """Permanently delete a collection."""

        collection = await self.repository.get_by_id(
            collection_id,
        )

        if collection is None:
            raise ResourceNotFoundError(f"Collection '{collection_id}' was not found.")

        await self.repository.delete(collection)
        await self.session.commit()
