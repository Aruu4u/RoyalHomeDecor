import uuid
from collections.abc import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.address import Address
from app.models.profile import Profile


class AddressRepository:
    """Database operations for customer delivery addresses."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def profile_exists(
        self,
        user_id: uuid.UUID,
    ) -> bool:
        """Check whether the authenticated user has a profile."""

        query = select(select(Profile.id).where(Profile.id == user_id).exists())

        result = await self.session.execute(query)

        return bool(result.scalar())

    async def get_by_id_for_user(
        self,
        *,
        address_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Address | None:
        """Return an address only when it belongs to the user."""

        query = select(Address).where(
            Address.id == address_id,
            Address.user_id == user_id,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
    ) -> Sequence[Address]:
        """Return all addresses belonging to one user."""

        query = (
            select(Address)
            .where(Address.user_id == user_id)
            .order_by(
                Address.is_default.desc(),
                Address.created_at.asc(),
            )
        )

        result = await self.session.execute(query)

        return result.scalars().all()

    async def count_for_user(
        self,
        user_id: uuid.UUID,
    ) -> int:
        """Count addresses belonging to a user."""

        query = select(func.count(Address.id)).where(
            Address.user_id == user_id,
        )

        result = await self.session.execute(query)

        return int(result.scalar_one())

    async def clear_default_addresses(
        self,
        user_id: uuid.UUID,
    ) -> None:
        """Remove default status from all addresses of a user."""

        statement = (
            update(Address)
            .where(
                Address.user_id == user_id,
                Address.is_default.is_(True),
            )
            .values(is_default=False)
            .execution_options(synchronize_session="fetch")
        )

        await self.session.execute(statement)

    async def create(
        self,
        address: Address,
    ) -> Address:
        """Add an address to the current transaction."""

        self.session.add(address)

        await self.session.flush()
        await self.session.refresh(address)

        return address

    async def delete(
        self,
        address: Address,
    ) -> None:
        """Mark an address for deletion."""

        await self.session.delete(address)
