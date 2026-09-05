from fastapi import APIRouter, status

from app.core.auth import CurrentUserDependency
from app.schemas.profile import (
    ProfileCreate,
    ProfileResponse,
    ProfileUpdate,
)
from app.services.dependencies import (
    ProfileServiceDependency,
)


router = APIRouter(
    prefix="/profile",
    tags=["Profile"],
)


@router.post(
    "",
    response_model=ProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create customer profile",
)
async def create_profile(
    data: ProfileCreate,
    service: ProfileServiceDependency,
    current_user: CurrentUserDependency,
) -> ProfileResponse:
    """Create a profile for the authenticated user."""

    profile = await service.create_profile(
        current_user.id,
        data,
    )

    return ProfileResponse.model_validate(profile)


@router.get(
    "",
    response_model=ProfileResponse,
    summary="Get customer profile",
)
async def get_profile(
    service: ProfileServiceDependency,
    current_user: CurrentUserDependency,
) -> ProfileResponse:
    """Return the authenticated user's profile."""

    profile = await service.get_profile(
        current_user.id,
    )

    return ProfileResponse.model_validate(profile)


@router.patch(
    "",
    response_model=ProfileResponse,
    summary="Update customer profile",
)
async def update_profile(
    data: ProfileUpdate,
    service: ProfileServiceDependency,
    current_user: CurrentUserDependency,
) -> ProfileResponse:
    """Partially update the authenticated user's profile."""

    profile = await service.update_profile(
        current_user.id,
        data,
    )

    return ProfileResponse.model_validate(profile)
