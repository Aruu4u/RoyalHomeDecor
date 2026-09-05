"""One-off check that the offers migration landed correctly.

Read-only: inspects the live schema and prints what it finds. Safe to run
at any time and makes no changes.
"""

import asyncio

from sqlalchemy import inspect

from app.db.session import engine


EXPECTED_SECTION_COLUMNS = {
    "id",
    "title",
    "slug",
    "subtitle",
    "theme",
    "background_image_url",
    "background_color",
    "accent_color",
    "text_color",
    "badge_label",
    "display_order",
    "is_active",
    "created_at",
    "updated_at",
}

EXPECTED_ITEM_COLUMNS = {
    "id",
    "section_id",
    "product_id",
    "discount_percent",
    "display_order",
    "created_at",
    "updated_at",
}


def describe(connection) -> None:
    """Print the state of the offer tables and product offer columns."""

    inspector = inspect(connection)

    tables = set(inspector.get_table_names())

    for table_name, expected in (
        ("offer_sections", EXPECTED_SECTION_COLUMNS),
        ("offer_items", EXPECTED_ITEM_COLUMNS),
    ):
        if table_name not in tables:
            print(f"MISSING TABLE: {table_name}")
            continue

        found = {column["name"] for column in inspector.get_columns(table_name)}

        missing = expected - found
        extra = found - expected

        status = "OK" if not missing else "INCOMPLETE"

        print(f"{table_name}: {status} ({len(found)} columns)")

        if missing:
            print(f"  missing: {sorted(missing)}")

        if extra:
            print(f"  unexpected: {sorted(extra)}")

    product_columns = {
        column["name"]: column
        for column in inspector.get_columns("products")
    }

    for column_name in ("offer_percent", "offer_label"):
        column = product_columns.get(column_name)

        if column is None:
            print(f"products.{column_name}: MISSING")
        else:
            print(
                f"products.{column_name}: OK "
                f"(nullable={column['nullable']})"
            )


async def main() -> None:
    async with engine.connect() as connection:
        await connection.run_sync(describe)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
