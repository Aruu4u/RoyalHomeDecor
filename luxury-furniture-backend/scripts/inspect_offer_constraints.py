"""Read-only: list check constraints so a migration can target them by name."""

import asyncio

from sqlalchemy import text

from app.db.session import engine


QUERY = text(
    """
    SELECT conname, conrelid::regclass AS table_name
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid::regclass::text IN ('offer_sections', 'products')
    ORDER BY table_name, conname
    """
)


async def main() -> None:
    async with engine.connect() as connection:
        result = await connection.execute(QUERY)

        for name, table_name in result.all():
            print(f"{table_name}: {name}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
