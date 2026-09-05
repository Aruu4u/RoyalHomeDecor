import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile


class ProfileRepository:
    """Database operations for customer profiles."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(
        self,
        user_id: uuid.UUID,
    ) -> Profile | None:
        """Return a profile using its Supabase user ID."""

        return await self.session.get(
            Profile,
            user_id,
        )

    async def create(
        self,
        profile: Profile,
    ) -> Profile:
        """Add a customer profile to the transaction."""

        self.session.add(profile)

        await self.session.flush()
        await self.session.refresh(profile)

        return profile
