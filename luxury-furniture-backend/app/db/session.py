from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


settings = get_settings()


engine: AsyncEngine = create_async_engine(  # The engine manages communication and connection pooling between FastAPI and PostgreSQL.
    settings.database_url,
    echo=settings.database_echo,
    pool_pre_ping=True,  # Before reusing a database connection, SQLAlchemy checks whether it is still alive.
)


AsyncSessionFactory = async_sessionmaker(  # A session represents one unit of database work.
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    expire_on_commit=False,
)
