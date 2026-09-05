"""Delete reviews left behind by API smoke tests.

Matches on the exact author name used by the smoke test, so a real
customer review can never be caught by it.

Run with:  .\\venv\\Scripts\\python.exe scripts\\remove_test_reviews.py
"""

import asyncio

from sqlalchemy import text

from app.db.session import AsyncSessionFactory


SMOKE_TEST_AUTHOR = "Kiro Test"


async def main() -> None:
    """Remove smoke-test reviews and report what was deleted."""

    async with AsyncSessionFactory() as session:
        result = await session.execute(
            text(
                "DELETE FROM product_reviews WHERE author_name = :author",
            ),
            {"author": SMOKE_TEST_AUTHOR},
        )

        await session.commit()

        print(f"deleted {result.rowcount} review(s) by '{SMOKE_TEST_AUTHOR}'")

        remaining = await session.scalar(
            text("SELECT COUNT(*) FROM product_reviews"),
        )

        print(f"reviews remaining: {remaining}")


if __name__ == "__main__":
    asyncio.run(main())
