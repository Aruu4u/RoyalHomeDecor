"""Read-only: show column types so a migration can be written accurately."""

import asyncio

from sqlalchemy import text

from app.db.session import engine


QUERY = text(
    """
    SELECT table_name, column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE (table_name = 'offer_sections' AND column_name = 'theme')
       OR (table_name = 'products' AND column_name IN ('is_featured', 'is_recommended'))
    ORDER BY table_name, column_name
    """
)


async def main() -> None:
    async with engine.connect() as connection:
        result = await connection.execute(QUERY)

        for table_name, column_name, data_type, max_length in result.all():
            width = f"({max_length})" if max_length else ""
            print(f"{table_name}.{column_name}: {data_type}{width}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
