import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.session import engine
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)


logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown resources."""

    settings = get_settings()

    logger.info(
        "Starting %s in %s environment",
        settings.app_name,
        settings.app_env,
    )

    yield

    await engine.dispose()

    logger.info("Stopping %s", settings.app_name)


async def resource_not_found_handler(
    _: Request,
    exception: ResourceNotFoundError,
) -> JSONResponse:
    """Convert a missing resource error into HTTP 404."""

    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "detail": str(exception),
        },
    )


async def resource_conflict_handler(
    _: Request,
    exception: ResourceConflictError,
) -> JSONResponse:
    """Convert a duplicate resource error into HTTP 409."""

    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "detail": str(exception),
        },
    )


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""

    settings = get_settings()

    docs_enabled = settings.app_env != "production"

    application = FastAPI(
        title=settings.app_name,
        version="0.3.0",
        description="Backend API for the luxury furniture store.",
        debug=settings.app_debug,
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )

    application.add_middleware(
        CORSMiddleware,
       allow_origins=[
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
        # allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.add_exception_handler(
        ResourceNotFoundError,
        resource_not_found_handler,
    )

    application.add_exception_handler(
        ResourceConflictError,
        resource_conflict_handler,
    )

    application.include_router(
        api_router,
        prefix=settings.api_v1_prefix,
    )

    return application


app = create_application()

# Instead of directly writing:app = FastAPI() we use an application factory: def create_application() -> FastAPI
# This makes the application easier to test and configure
