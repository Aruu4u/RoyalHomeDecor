import uuid
from collections.abc import Generator

import pytest

from app.core.auth import (
    get_current_user,
    require_admin,
)
from app.main import app
from app.schemas.auth import AuthenticatedUser


TEST_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")


async def override_current_user() -> AuthenticatedUser:
    """Return a fake authenticated user for API tests."""

    return AuthenticatedUser(
        id=TEST_USER_ID,
        email="customer@example.com",
        app_metadata={
            "role": "customer",
        },
        user_metadata={},
    )


async def override_require_admin() -> AuthenticatedUser:
    """Return a fake authenticated administrator for admin tests."""

    return AuthenticatedUser(
        id=TEST_USER_ID,
        email="admin@example.com",
        app_metadata={
            "role": "admin",
        },
        user_metadata={},
    )


@pytest.fixture(
    scope="session",
    autouse=True,
)
def override_authentication() -> Generator[None, None, None]:
    """Bypass external Supabase authentication during tests."""

    app.dependency_overrides[get_current_user] = override_current_user

    app.dependency_overrides[require_admin] = override_require_admin

    yield

    app.dependency_overrides.pop(
        get_current_user,
        None,
    )

    app.dependency_overrides.pop(
        require_admin,
        None,
    )
