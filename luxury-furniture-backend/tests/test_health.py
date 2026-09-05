from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.db.dependencies import get_db_session
from app.main import app


class FakeDatabaseSession:
    """Minimal fake session used by the readiness test."""

    execute = AsyncMock(return_value=None)


async def override_database_session():
    """Provide a fake database session without contacting Supabase."""

    yield FakeDatabaseSession()


app.dependency_overrides[get_db_session] = override_database_session

client = TestClient(app)


def test_liveness_endpoint_returns_ok() -> None:
    """The liveness endpoint should confirm that FastAPI is running."""

    response = client.get("/api/v1/health/live")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "Luxury Furniture API",
        "environment": "local",
    }


def test_readiness_endpoint_returns_ready() -> None:
    """The readiness endpoint should confirm database availability."""

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "database": "connected",
    }
