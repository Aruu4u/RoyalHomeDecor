import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collection import Collection


class CollectionRepository:
    """Database operations for furniture collections."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        collection: Collection,
    ) -> Collection:
        """Add a collection to the current database transaction."""

        self.session.add(collection)

        await self.session.flush()
        await self.session.refresh(collection)

        return collection

    async def get_by_id(
        self,
        collection_id: uuid.UUID,
    ) -> Collection | None:
        """Find a collection using its UUID."""

        return await self.session.get(
            Collection,
            collection_id,
        )

    async def get_by_slug(
        self,
        slug: str,
    ) -> Collection | None:
        """Find a collection using its URL slug."""

        query = select(Collection).where(
            Collection.slug == slug,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def get_by_name(
        self,
        name: str,
    ) -> Collection | None:
        """Find a collection using a case-insensitive name."""

        query = select(Collection).where(
            func.lower(Collection.name) == name.lower(),
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        offset: int,
        limit: int,
        active_only: bool,
    ) -> Sequence[Collection]:
        """Return collections in homepage display order."""

        query = select(Collection)

        if active_only:
            query = query.where(
                Collection.is_active.is_(True),
            )

        query = (
            query.order_by(
                Collection.display_order.asc(),
                Collection.created_at.asc(),
            )
            .offset(offset)
            .limit(limit)
        )

        result = await self.session.execute(query)

        return result.scalars().all()

    async def delete(
        self,
        collection: Collection,
    ) -> None:
        """Mark a collection for deletion in this transaction."""

        await self.session.delete(collection)
