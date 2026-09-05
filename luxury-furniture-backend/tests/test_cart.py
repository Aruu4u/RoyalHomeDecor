import uuid
from collections.abc import Generator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import ResourceNotFoundError
from app.main import app
from app.schemas.cart import (
    CartItemCreate,
    CartItemUpdate,
    CartResponse,
    CartVariantResponse,
)
from app.services.dependencies import get_cart_service


USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

CART_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")

ITEM_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")

VARIANT_ID = uuid.UUID("06976290-312d-4d31-833c-4ecc1034f306")

PRODUCT_ID = uuid.UUID("da636bc9-ddb1-4fa0-82d9-a9fd97585242")

MISSING_ITEM_ID = uuid.UUID("99999999-9999-9999-9999-999999999999")

PRICE_PAISE = 1_299_900


def build_cart_response(
    *,
    quantity: int = 0,
) -> CartResponse:
    """Create a fake populated or empty cart response."""

    current_time = datetime.now(UTC)

    items = []

    if quantity > 0:
        variant = CartVariantResponse(
            id=VARIANT_ID,
            product_id=PRODUCT_ID,
            sku="MIR-ARCH-GOLD-L",
            name="Large",
            size_label="90 × 120 cm",
            colour="Antique gold",
            material="Brass and glass",
            price_paise=PRICE_PAISE,
            is_active=True,
        )

        items.append(
            {
                "id": ITEM_ID,
                "cart_id": CART_ID,
                "variant_id": VARIANT_ID,
                "quantity": quantity,
                "variant": variant,
                # No offer applies in this fixture, so the charged price
                # matches the list price.
                "list_unit_price_paise": PRICE_PAISE,
                "unit_price_paise": PRICE_PAISE,
                "discount_percent": None,
                "line_total_paise": PRICE_PAISE * quantity,
                "created_at": current_time,
                "updated_at": current_time,
            }
        )

    return CartResponse(
        id=CART_ID,
        user_id=USER_ID,
        items=items,
        subtotal_paise=PRICE_PAISE * quantity,
        list_subtotal_paise=PRICE_PAISE * quantity,
        total_saving_paise=0,
        total_quantity=quantity,
        created_at=current_time,
        updated_at=current_time,
    )


class FakeCartService:
    """Fake cart service without database access."""

    async def get_cart(
        self,
        user_id: uuid.UUID,
    ) -> CartResponse:
        """Return an empty fake cart."""

        assert user_id == USER_ID

        return build_cart_response()

    async def add_item(
        self,
        *,
        user_id: uuid.UUID,
        data: CartItemCreate,
    ) -> CartResponse:
        """Return a cart containing the added item."""

        assert user_id == USER_ID

        return build_cart_response(
            quantity=data.quantity,
        )

    async def update_item(
        self,
        *,
        user_id: uuid.UUID,
        item_id: uuid.UUID,
        data: CartItemUpdate,
    ) -> CartResponse:
        """Return a cart with an updated quantity."""

        assert user_id == USER_ID

        if item_id == MISSING_ITEM_ID:
            raise ResourceNotFoundError(f"Cart item '{item_id}' was not found.")

        return build_cart_response(
            quantity=data.quantity,
        )

    async def delete_item(
        self,
        *,
        user_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> None:
        """Pretend to delete one cart item."""

        assert user_id == USER_ID

        if item_id == MISSING_ITEM_ID:
            raise ResourceNotFoundError(f"Cart item '{item_id}' was not found.")

    async def clear_cart(
        self,
        user_id: uuid.UUID,
    ) -> None:
        """Pretend to clear the cart."""

        assert user_id == USER_ID


def override_cart_service() -> FakeCartService:
    """Provide the fake cart service."""

    return FakeCartService()


@pytest.fixture(
    autouse=True,
)
def use_fake_cart_service() -> Generator[None, None, None]:
    """Override the real cart service during these tests."""

    app.dependency_overrides[get_cart_service] = override_cart_service

    yield

    app.dependency_overrides.pop(
        get_cart_service,
        None,
    )


client = TestClient(app)


def test_get_cart_returns_empty_cart() -> None:
    """An authenticated user should receive their cart."""

    response = client.get(
        "/api/v1/cart",
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["id"] == str(CART_ID)
    assert response_body["user_id"] == str(USER_ID)
    assert response_body["items"] == []
    assert response_body["subtotal_paise"] == 0
    assert response_body["total_quantity"] == 0


def test_add_cart_item_returns_201() -> None:
    """Adding a valid variant should return HTTP 201."""

    response = client.post(
        "/api/v1/cart/items",
        json={
            "variant_id": str(VARIANT_ID),
            "quantity": 2,
        },
    )

    assert response.status_code == 201

    response_body = response.json()

    assert len(response_body["items"]) == 1
    assert response_body["items"][0]["variant_id"] == str(VARIANT_ID)
    assert response_body["items"][0]["quantity"] == 2
    assert response_body["items"][0]["line_total_paise"] == PRICE_PAISE * 2
    assert response_body["subtotal_paise"] == PRICE_PAISE * 2
    assert response_body["total_quantity"] == 2


def test_add_cart_item_uses_default_quantity() -> None:
    """Quantity should default to one when omitted."""

    response = client.post(
        "/api/v1/cart/items",
        json={
            "variant_id": str(VARIANT_ID),
        },
    )

    assert response.status_code == 201
    assert response.json()["items"][0]["quantity"] == 1


def test_update_cart_item_quantity() -> None:
    """PATCH should replace the cart-item quantity."""

    response = client.patch(
        f"/api/v1/cart/items/{ITEM_ID}",
        json={
            "quantity": 3,
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["items"][0]["quantity"] == 3
    assert response_body["items"][0]["line_total_paise"] == PRICE_PAISE * 3
    assert response_body["total_quantity"] == 3


def test_cart_rejects_zero_quantity() -> None:
    """Cart quantity must be at least one."""

    response = client.post(
        "/api/v1/cart/items",
        json={
            "variant_id": str(VARIANT_ID),
            "quantity": 0,
        },
    )

    assert response.status_code == 422


def test_cart_rejects_quantity_above_limit() -> None:
    """Cart quantity cannot exceed ninety-nine."""

    response = client.patch(
        f"/api/v1/cart/items/{ITEM_ID}",
        json={
            "quantity": 100,
        },
    )

    assert response.status_code == 422


def test_add_cart_item_rejects_extra_fields() -> None:
    """Unexpected request fields should be rejected."""

    response = client.post(
        "/api/v1/cart/items",
        json={
            "variant_id": str(VARIANT_ID),
            "quantity": 1,
            "price_paise": 1,
        },
    )

    assert response.status_code == 422


def test_add_cart_item_rejects_invalid_variant_uuid() -> None:
    """An invalid variant UUID should return HTTP 422."""

    response = client.post(
        "/api/v1/cart/items",
        json={
            "variant_id": "not-a-valid-uuid",
            "quantity": 1,
        },
    )

    assert response.status_code == 422


def test_delete_cart_item_returns_204() -> None:
    """Deleting an existing item should return HTTP 204."""

    response = client.delete(
        f"/api/v1/cart/items/{ITEM_ID}",
    )

    assert response.status_code == 204
    assert response.content == b""


def test_update_missing_cart_item_returns_404() -> None:
    """Updating an unknown item should return HTTP 404."""

    response = client.patch(
        f"/api/v1/cart/items/{MISSING_ITEM_ID}",
        json={
            "quantity": 2,
        },
    )

    assert response.status_code == 404

    assert response.json() == {"detail": (f"Cart item '{MISSING_ITEM_ID}' was not found.")}


def test_delete_missing_cart_item_returns_404() -> None:
    """Deleting an unknown item should return HTTP 404."""

    response = client.delete(
        f"/api/v1/cart/items/{MISSING_ITEM_ID}",
    )

    assert response.status_code == 404

    assert response.json() == {"detail": (f"Cart item '{MISSING_ITEM_ID}' was not found.")}


def test_clear_cart_returns_204() -> None:
    """Clearing the cart should return HTTP 204."""

    response = client.delete(
        "/api/v1/cart",
    )

    assert response.status_code == 204
    assert response.content == b""
