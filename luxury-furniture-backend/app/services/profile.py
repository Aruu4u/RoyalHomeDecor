import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.profile import Profile
from app.repositories.profile import ProfileRepository
from app.schemas.profile import (
    ProfileCreate,
    ProfileUpdate,
)


class ProfileService:
    """Business logic for customer profiles."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = ProfileRepository(session)

    async def create_profile(
        self,
        user_id: uuid.UUID,
        data: ProfileCreate,
    ) -> Profile:
        """Create a profile for the authenticated user."""

        existing_profile = await self.repository.get_by_id(
            user_id,
        )

        if existing_profile is not None:
            raise ResourceConflictError("A profile already exists for this user.")

        profile = Profile(
            id=user_id,
            **data.model_dump(),
        )

        try:
            created_profile = await self.repository.create(
                profile,
            )

            await self.session.commit()
            await self.session.refresh(created_profile)

        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError("A profile already exists for this user.") from exception

        return created_profile

    async def get_profile(
        self,
        user_id: uuid.UUID,
    ) -> Profile:
        """Return the authenticated user's profile."""

        profile = await self.repository.get_by_id(
            user_id,
        )

        if profile is None:
            raise ResourceNotFoundError("A profile has not been created for this user.")

        return profile

    async def update_profile(
        self,
        user_id: uuid.UUID,
        data: ProfileUpdate,
    ) -> Profile:
        """Partially update the authenticated user's profile."""

        profile = await self.repository.get_by_id(
            user_id,
        )

        if profile is None:
            raise ResourceNotFoundError("A profile has not been created for this user.")

        update_data = data.model_dump(
            exclude_unset=True,
        )

        for field_name, field_value in update_data.items():
            setattr(
                profile,
                field_name,
                field_value,
            )

        await self.session.commit()
        await self.session.refresh(profile)

        return profile
