import uuid
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.core.auth as auth_module
from app.core.auth import (
    AdminUserDependency,
    CurrentUserDependency,
)


ADMIN_USER_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

CUSTOMER_USER_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


auth_test_app = FastAPI()


@auth_test_app.get("/current-user")
async def current_user_route(
    current_user: CurrentUserDependency,
) -> dict[str, Any]:
    """Return the authenticated user for testing."""

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "is_admin": current_user.is_admin,
    }


@auth_test_app.get("/admin-only")
async def admin_only_route(
    admin_user: AdminUserDependency,
) -> dict[str, Any]:
    """Return the authenticated administrator."""

    return {
        "id": str(admin_user.id),
        "email": admin_user.email,
        "is_admin": admin_user.is_admin,
    }


client = TestClient(auth_test_app)


class FakeResponse:
    """Minimal fake HTTP response returned by Supabase."""

    def __init__(
        self,
        *,
        status_code: int,
        payload: dict[str, Any],
    ) -> None:
        self.status_code = status_code
        self.payload = payload

    @property
    def is_error(self) -> bool:
        """Return whether the response represents an error."""

        return self.status_code >= 400

    def json(self) -> dict[str, Any]:
        """Return the configured JSON response."""

        return self.payload


def make_fake_async_client(
    response: FakeResponse,
):
    """Create an async HTTP client returning one fake response."""

    class FakeAsyncClient:
        def __init__(
            self,
            *args,
            **kwargs,
        ) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(
            self,
            exc_type,
            exc_value,
            traceback,
        ) -> None:
            return None

        async def get(
            self,
            url: str,
            *,
            headers: dict[str, str],
        ) -> FakeResponse:
            return response

    return FakeAsyncClient


def test_missing_token_returns_401() -> None:
    """Protected routes should reject missing credentials."""

    response = client.get("/admin-only")

    assert response.status_code == 401

    assert response.json() == {"detail": "Authentication is required."}

    assert response.headers["www-authenticate"] == "Bearer"


def test_invalid_token_returns_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Supabase-rejected tokens should return HTTP 401."""

    fake_response = FakeResponse(
        status_code=401,
        payload={
            "message": "Invalid JWT",
        },
    )

    monkeypatch.setattr(
        auth_module.httpx,
        "AsyncClient",
        make_fake_async_client(fake_response),
    )

    response = client.get(
        "/admin-only",
        headers={
            "Authorization": "Bearer invalid-token",
        },
    )

    assert response.status_code == 401

    assert response.json() == {"detail": "The access token is invalid or expired."}

    assert response.headers["www-authenticate"] == "Bearer"


def test_non_admin_user_returns_403(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Authenticated users without admin role are forbidden."""

    fake_response = FakeResponse(
        status_code=200,
        payload={
            "id": str(CUSTOMER_USER_ID),
            "email": "customer@example.com",
            "app_metadata": {
                "role": "customer",
            },
            "user_metadata": {},
        },
    )

    monkeypatch.setattr(
        auth_module.httpx,
        "AsyncClient",
        make_fake_async_client(fake_response),
    )

    response = client.get(
        "/admin-only",
        headers={
            "Authorization": "Bearer valid-customer-token",
        },
    )

    assert response.status_code == 403

    assert response.json() == {"detail": "Administrator access is required."}


def test_admin_user_can_access_protected_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A verified administrator should access protected routes."""

    fake_response = FakeResponse(
        status_code=200,
        payload={
            "id": str(ADMIN_USER_ID),
            "email": "admin@example.com",
            "app_metadata": {
                "role": "admin",
            },
            "user_metadata": {},
        },
    )

    monkeypatch.setattr(
        auth_module.httpx,
        "AsyncClient",
        make_fake_async_client(fake_response),
    )

    response = client.get(
        "/admin-only",
        headers={
            "Authorization": "Bearer valid-admin-token",
        },
    )

    assert response.status_code == 200

    assert response.json() == {
        "id": str(ADMIN_USER_ID),
        "email": "admin@example.com",
        "is_admin": True,
    }


def test_authenticated_user_can_access_user_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Authentication alone should not require admin role."""

    fake_response = FakeResponse(
        status_code=200,
        payload={
            "id": str(CUSTOMER_USER_ID),
            "email": "customer@example.com",
            "app_metadata": {
                "role": "customer",
            },
            "user_metadata": {},
        },
    )

    monkeypatch.setattr(
        auth_module.httpx,
        "AsyncClient",
        make_fake_async_client(fake_response),
    )

    response = client.get(
        "/current-user",
        headers={
            "Authorization": "Bearer valid-customer-token",
        },
    )

    assert response.status_code == 200

    assert response.json() == {
        "id": str(CUSTOMER_USER_ID),
        "email": "customer@example.com",
        "is_admin": False,
    }


class FailingAsyncClient:
    """Fake HTTP client that simulates a network outage."""

    def __init__(
        self,
        *args,
        **kwargs,
    ) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(
        self,
        exc_type,
        exc_value,
        traceback,
    ) -> None:
        return None

    async def get(
        self,
        url: str,
        *,
        headers: dict[str, str],
    ) -> FakeResponse:
        request = httpx.Request(
            "GET",
            url,
        )

        raise httpx.ConnectError(
            "Supabase is unavailable.",
            request=request,
        )


def test_authentication_service_outage_returns_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Network failures should return HTTP 503."""

    monkeypatch.setattr(
        auth_module.httpx,
        "AsyncClient",
        FailingAsyncClient,
    )

    response = client.get(
        "/admin-only",
        headers={
            "Authorization": "Bearer valid-token",
        },
    )

    assert response.status_code == 503

    assert response.json() == {"detail": ("Authentication service is currently unavailable.")}


def test_unexpected_auth_response_returns_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unexpected upstream errors should return HTTP 503."""

    fake_response = FakeResponse(
        status_code=500,
        payload={
            "message": "Internal server error",
        },
    )

    monkeypatch.setattr(
        auth_module.httpx,
        "AsyncClient",
        make_fake_async_client(fake_response),
    )

    response = client.get(
        "/admin-only",
        headers={
            "Authorization": "Bearer valid-token",
        },
    )

    assert response.status_code == 503

    assert response.json() == {
        "detail": ("Authentication service returned an unexpected response.")
    }
