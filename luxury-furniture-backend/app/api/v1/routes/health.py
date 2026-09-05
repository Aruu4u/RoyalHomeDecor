from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.db.dependencies import DatabaseSession


router = APIRouter(
    prefix="/health",
    tags=["Health"],
)


class HealthResponse(BaseModel):
    """Response returned by a health endpoint."""

    status: Literal["ok"]
    service: str
    environment: str


class ReadinessResponse(BaseModel):
    """Response returned when application dependencies are ready."""

    status: Literal["ready"]
    database: Literal["connected"]


@router.get(
    "/live",
    response_model=HealthResponse,
    summary="Check whether the API process is running",
)
async def check_liveness() -> HealthResponse:
    """Return a successful response when the API process is alive."""

    settings = get_settings()

    return HealthResponse(
        status="ok",
        service=settings.app_name,
        environment=settings.app_env,
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Check whether the API can reach its dependencies",
)
async def check_readiness(
    db: DatabaseSession,
) -> ReadinessResponse:
    """Check that PostgreSQL is reachable."""

    try:
        await db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable",
        ) from exc

    return ReadinessResponse(
        status="ready",
        database="connected",
    )
