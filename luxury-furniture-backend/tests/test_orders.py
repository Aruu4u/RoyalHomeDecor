import uuid
from collections.abc import Generator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.main import app
from app.models.order import Order
from app.models.order_enums import OrderStatus, PaymentStatus
from app.schemas.order import (
    CheckoutCreate,
    OrderItemResponse,
    OrderResponse,
)
from app.services.dependencies import get_order_service


USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

ADDRESS_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")

ORDER_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")

ORDER_ITEM_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")

PRODUCT_ID = uuid.UUID("da636bc9-ddb1-4fa0-82d9-a9fd97585242")

VARIANT_ID = uuid.UUID("06976290-312d-4d31-833c-4ecc1034f306")

MISSING_ADDRESS_ID = uuid.UUID("88888888-8888-8888-8888-888888888888")

MISSING_ORDER_ID = uuid.UUID("99999999-9999-9999-9999-999999999999")

PRICE_PAISE = 1_299_900


def build_order_response() -> OrderResponse:
    """Create one complete fake order response."""

    current_time = datetime.now(UTC)

    order_item = OrderItemResponse(
        id=ORDER_ITEM_ID,
        order_id=ORDER_ID,
        product_id=PRODUCT_ID,
        variant_id=VARIANT_ID,
        product_name="Luxury Arch Mirror",
        variant_name="Large",
        sku="MIR-ARCH-GOLD-L",
        size_label="90 × 120 cm",
        colour="Antique gold",
        material="Brass and glass",
        quantity=1,
        unit_price_paise=PRICE_PAISE,
        line_total_paise=PRICE_PAISE,
        created_at=current_time,
        updated_at=current_time,
    )

    return OrderResponse(
        id=ORDER_ID,
        user_id=USER_ID,
        status=OrderStatus.PENDING,
        payment_status=PaymentStatus.PENDING,
        recipient_name="Arsal Masood",
        recipient_phone="9557156626",
        address_line_1="House 12, Example Colony",
        address_line_2=None,
        landmark="Near Main Market",
        city="Moradabad",
        state="Uttar Pradesh",
        postal_code="244001",
        country="India",
        customer_note="Please handle the mirror carefully.",
        subtotal_paise=PRICE_PAISE,
        shipping_paise=0,
        total_paise=PRICE_PAISE,
        razorpay_order_id=None,
        razorpay_payment_id=None,
        items=[order_item],
        created_at=current_time,
        updated_at=current_time,
    )


def build_order_model() -> Order:
    """Create one fake ORM order for list responses."""

    current_time = datetime.now(UTC)

    return Order(
        id=ORDER_ID,
        user_id=USER_ID,
        status=OrderStatus.PENDING,
        payment_status=PaymentStatus.PENDING,
        recipient_name="Arsal Masood",
        recipient_phone="9557156626",
        address_line_1="House 12, Example Colony",
        address_line_2=None,
        landmark="Near Main Market",
        city="Moradabad",
        state="Uttar Pradesh",
        postal_code="244001",
        country="India",
        customer_note=None,
        subtotal_paise=PRICE_PAISE,
        shipping_paise=0,
        total_paise=PRICE_PAISE,
        razorpay_order_id=None,
        razorpay_payment_id=None,
        created_at=current_time,
        updated_at=current_time,
    )


class FakeOrderService:
    """Fake order service without database access."""

    async def checkout(
        self,
        *,
        user_id: uuid.UUID,
        data: CheckoutCreate,
    ) -> OrderResponse:
        """Return a newly created fake order."""

        assert user_id == USER_ID

        if data.address_id == MISSING_ADDRESS_ID:
            raise ResourceNotFoundError(f"Address '{data.address_id}' was not found.")

        if data.customer_note == "EMPTY_CART":
            raise ResourceConflictError("Your cart is empty.")

        return build_order_response()

    async def list_orders(
        self,
        user_id: uuid.UUID,
    ) -> list[Order]:
        """Return the authenticated user's orders."""

        assert user_id == USER_ID

        return [build_order_model()]

    async def get_order(
        self,
        *,
        user_id: uuid.UUID,
        order_id: uuid.UUID,
    ) -> OrderResponse:
        """Return one order belonging to the user."""

        assert user_id == USER_ID

        if order_id == MISSING_ORDER_ID:
            raise ResourceNotFoundError(f"Order '{order_id}' was not found.")

        return build_order_response()


def override_order_service() -> FakeOrderService:
    """Provide the fake order service."""

    return FakeOrderService()


@pytest.fixture(
    autouse=True,
)
def use_fake_order_service() -> Generator[None, None, None]:
    """Override the real order service during these tests."""

    app.dependency_overrides[get_order_service] = override_order_service

    yield

    app.dependency_overrides.pop(
        get_order_service,
        None,
    )


client = TestClient(app)


def test_checkout_returns_201() -> None:
    """A valid checkout should create an order."""

    response = client.post(
        "/api/v1/orders/checkout",
        json={
            "address_id": str(ADDRESS_ID),
            "customer_note": ("Please handle the mirror carefully."),
        },
    )

    assert response.status_code == 201

    response_body = response.json()

    assert response_body["id"] == str(ORDER_ID)
    assert response_body["user_id"] == str(USER_ID)
    assert response_body["status"] == "pending"
    assert response_body["payment_status"] == "pending"
    assert response_body["subtotal_paise"] == PRICE_PAISE
    assert response_body["shipping_paise"] == 0
    assert response_body["total_paise"] == PRICE_PAISE

    assert len(response_body["items"]) == 1

    item = response_body["items"][0]

    assert item["variant_id"] == str(VARIANT_ID)
    assert item["quantity"] == 1
    assert item["unit_price_paise"] == PRICE_PAISE
    assert item["line_total_paise"] == PRICE_PAISE


def test_checkout_with_missing_address_returns_404() -> None:
    """Checkout should reject an address not owned by the user."""

    response = client.post(
        "/api/v1/orders/checkout",
        json={
            "address_id": str(MISSING_ADDRESS_ID),
            "customer_note": None,
        },
    )

    assert response.status_code == 404

    assert response.json() == {"detail": (f"Address '{MISSING_ADDRESS_ID}' was not found.")}


def test_checkout_with_empty_cart_returns_409() -> None:
    """Checkout should reject an empty shopping cart."""

    response = client.post(
        "/api/v1/orders/checkout",
        json={
            "address_id": str(ADDRESS_ID),
            "customer_note": "EMPTY_CART",
        },
    )

    assert response.status_code == 409

    assert response.json() == {"detail": "Your cart is empty."}


def test_checkout_rejects_invalid_address_uuid() -> None:
    """An invalid address UUID should return HTTP 422."""

    response = client.post(
        "/api/v1/orders/checkout",
        json={
            "address_id": "not-a-valid-uuid",
        },
    )

    assert response.status_code == 422


def test_checkout_rejects_extra_fields() -> None:
    """Clients cannot provide order totals themselves."""

    response = client.post(
        "/api/v1/orders/checkout",
        json={
            "address_id": str(ADDRESS_ID),
            "total_paise": 1,
        },
    )

    assert response.status_code == 422


def test_checkout_rejects_long_customer_note() -> None:
    """Customer notes cannot exceed one thousand characters."""

    response = client.post(
        "/api/v1/orders/checkout",
        json={
            "address_id": str(ADDRESS_ID),
            "customer_note": "A" * 1001,
        },
    )

    assert response.status_code == 422


def test_list_orders_returns_customer_orders() -> None:
    """The authenticated user should receive their orders."""

    response = client.get(
        "/api/v1/orders",
    )

    assert response.status_code == 200

    response_body = response.json()

    assert len(response_body) == 1
    assert response_body[0]["id"] == str(ORDER_ID)
    assert response_body[0]["status"] == "pending"
    assert response_body[0]["payment_status"] == "pending"
    assert response_body[0]["total_paise"] == PRICE_PAISE


def test_get_order_returns_full_order() -> None:
    """A customer should receive their complete order."""

    response = client.get(
        f"/api/v1/orders/{ORDER_ID}",
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["id"] == str(ORDER_ID)
    assert response_body["recipient_name"] == "Arsal Masood"
    assert response_body["items"][0]["sku"] == ("MIR-ARCH-GOLD-L")


def test_get_missing_order_returns_404() -> None:
    """An unknown or unowned order should return HTTP 404."""

    response = client.get(
        f"/api/v1/orders/{MISSING_ORDER_ID}",
    )

    assert response.status_code == 404

    assert response.json() == {"detail": (f"Order '{MISSING_ORDER_ID}' was not found.")}


def test_get_order_rejects_invalid_uuid() -> None:
    """An invalid order ID should return HTTP 422."""

    response = client.get(
        "/api/v1/orders/not-a-valid-uuid",
    )

    assert response.status_code == 422
