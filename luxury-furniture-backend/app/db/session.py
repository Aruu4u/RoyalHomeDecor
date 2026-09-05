from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import get_settings


settings = get_settings()


def _with_query_param(url: str, key: str, value: str) -> str:
    """Return ``url`` with ``key=value`` added to its query string.

    Existing parameters are preserved, so a connection string that already
    carries something like ``sslmode`` is not damaged. An existing value
    for the same key is left alone, so anything set deliberately in the
    environment still wins.
    """

    parts = urlsplit(url)
    query = parse_qsl(parts.query, keep_blank_values=True)

    if any(existing_key == key for existing_key, _ in query):
        return url

    query.append((key, value))

    return urlunsplit(parts._replace(query=urlencode(query)))


def _create_engine() -> AsyncEngine:
    """Build the database engine for the environment we are running in.

    Two very different shapes are needed:

    **Persistent server** (local development, Render, a container). One
    long-lived process handles every request, so a connection pool is
    exactly right: connections are opened once and reused, and
    ``pool_pre_ping`` quietly discards one the database has closed.

    **Serverless** (Vercel). Each function instance is a separate process
    and the platform runs as many as traffic requires. A pool per instance
    multiplies: ten instances holding five connections each is fifty, and
    Supabase's smaller plans cap out around sixty. The failure shows up as
    intermittent "too many clients" errors that only appear under real
    traffic. So:

    * ``NullPool`` stops SQLAlchemy pooling at all and hands connection
      reuse to PgBouncer, which is the one component that can see every
      instance at once.

    * Prepared statements are switched off. PgBouncer in transaction mode
      gives a different backend connection per transaction, so a statement
      prepared on one is missing on the next. ``prepared_statement_cache_size``
      is a DBAPI argument and belongs in the URL; ``statement_cache_size``
      is asyncpg's own.

    * Statement names are randomised. asyncpg numbers them sequentially,
      which collides when a pooled backend has already used that name.
    """

    if not settings.db_serverless:
        return create_async_engine(
            settings.database_url,
            echo=settings.database_echo,
            pool_pre_ping=True,
        )

    return create_async_engine(
        _with_query_param(
            settings.database_url,
            "prepared_statement_cache_size",
            "0",
        ),
        echo=settings.database_echo,
        poolclass=NullPool,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
        },
    )


engine: AsyncEngine = _create_engine()


AsyncSessionFactory = async_sessionmaker(  # A session represents one unit of database work.
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    expire_on_commit=False,
)
