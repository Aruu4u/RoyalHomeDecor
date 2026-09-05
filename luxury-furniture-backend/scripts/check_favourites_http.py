"""End-to-end check of the favourites endpoints over HTTP.

Uses the real router, the real service and the real database, with only
authentication stubbed out. That combination is the one that broke: the
route and the service were both fine, and the failure was in serialising
the response, which a fake-service test cannot reach.

Read-only apart from one favourite it adds and then removes again.

Run with:  .\\venv\\Scripts\\python.exe scripts\\check_favourites_http.py
"""

import asyncio
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.auth import get_current_user, require_admin
from app.db.session import AsyncSessionFactory, engine
from app.main import app
from app.models.favourite import Favourite
from app.models.product import Product
from app.models.profile import Profile
from app.schemas.auth import AuthenticatedUser


async def pick_test_identity() -> tuple[uuid.UUID, uuid.UUID] | None:
    """Return a real profile id and a product it has not favourited."""

    async with AsyncSessionFactory() as session:
        profile = (
            await session.execute(select(Profile).limit(1))
        ).scalar_one_or_none()

        if profile is None:
            return None

        already = set(
            (
                await session.execute(
                    select(Favourite.product_id).where(
                        Favourite.user_id == profile.id,
                    ),
                )
            )
            .scalars()
            .all()
        )

        products = (
            (
                await session.execute(
                    select(Product.id).where(Product.is_active.is_(True)),
                )
            )
            .scalars()
            .all()
        )

        spare = next(
            (
                product_id
                for product_id in products
                if product_id not in already
            ),
            None,
        )

        if spare is None:
            return None

        return profile.id, spare


async def find_identity() -> tuple[uuid.UUID, uuid.UUID] | None:
    """Look up the test identity, then release every pooled connection.

    The engine is process-wide and its pooled connections belong to the
    event loop that opened them. TestClient runs the app on a *different*
    loop, and reusing a connection across the two fails with "event loop is
    closed". Disposing here means the app opens its own connections.
    """

    try:
        return await pick_test_identity()
    finally:
        await engine.dispose()


def main() -> None:
    """Exercise list, add and remove over HTTP."""

    identity = asyncio.run(find_identity())

    if identity is None:
        print("Not enough live data to run this check.")
        return

    user_id, product_id = identity

    async def override_user() -> AuthenticatedUser:
        return AuthenticatedUser(
            id=user_id,
            email="checker@example.com",
            app_metadata={"role": "customer"},
            user_metadata={},
        )

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[require_admin] = override_user

    failures = 0

    def check(description: str, condition: bool, detail: str = "") -> None:
        nonlocal failures

        if not condition:
            failures += 1

        suffix = f"  ({detail})" if detail else ""
        print(f"  [{'pass' if condition else 'FAIL'}] {description}{suffix}")

    try:
        with TestClient(app) as client:
            print("GET /favourites")

            listed = client.get("/api/v1/favourites")

            check(
                "returns 200",
                listed.status_code == 200,
                f"got {listed.status_code}",
            )

            if listed.status_code == 200 and listed.json():
                product = listed.json()[0]["product"]

                for field in (
                    "top_material",
                    "base_material",
                    "finish",
                    "in_stock",
                    "available_quantity",
                    "offer_discount_percent",
                    "offer_price_paise",
                ):
                    check(f"carries {field}", field in product)

                check(
                    "no longer sends the merged 'material'",
                    "material" not in product,
                )

            print("\nPOST /favourites/{product_id}")

            added = client.post(f"/api/v1/favourites/{product_id}")

            check(
                "adding a favourite succeeds",
                added.status_code in {200, 201},
                f"got {added.status_code}"
                + (
                    f" {added.text[:180]}"
                    if added.status_code >= 400
                    else ""
                ),
            )

            if added.status_code in {200, 201}:
                check(
                    "the response carries the product",
                    "product" in added.json(),
                )

            print("\nDELETE /favourites/{product_id}")

            removed = client.delete(f"/api/v1/favourites/{product_id}")

            check(
                "removing it succeeds",
                removed.status_code in {200, 204},
                f"got {removed.status_code}",
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(require_admin, None)

    print(
        "\nAll checks passed."
        if failures == 0
        else f"\n{failures} check(s) FAILED.",
    )


if __name__ == "__main__":
    main()
