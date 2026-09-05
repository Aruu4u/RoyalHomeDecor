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
    AdminOrderStatusUpdate,
    OrderItemResponse,
    OrderResponse,
)
from app.services.dependencies import get_order_service


USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

ORDER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")

ORDER_ITEM_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")

PRODUCT_ID = uuid.UUID("da636bc9-ddb1-4fa0-82d9-a9fd97585242")

VARIANT_ID = uuid.UUID("06976290-312d-4d31-833c-4ecc1034f306")

MISSING_ORDER_ID = uuid.UUID("99999999-9999-9999-9999-999999999999")

PRICE_PAISE = 1_299_900


def build_order_response(
    *,
    status: OrderStatus = OrderStatus.PENDING,
) -> OrderResponse:
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
        status=status,
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
        items=[order_item],
        created_at=current_time,
        updated_at=current_time,
    )


def build_order_model(
    *,
    status: OrderStatus = OrderStatus.PENDING,
) -> Order:
    """Create one fake ORM order for admin list responses."""

    current_time = datetime.now(UTC)

    return Order(
        id=ORDER_ID,
        user_id=USER_ID,
        status=status,
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


class FakeAdminOrderService:
    """Fake admin order service without database access."""

    async def list_all_orders(
        self,
    ) -> list[Order]:
        """Return all fake customer orders."""

        return [build_order_model()]

    async def get_order_admin(
        self,
        order_id: uuid.UUID,
    ) -> OrderResponse:
        """Return one order for an administrator."""

        if order_id == MISSING_ORDER_ID:
            raise ResourceNotFoundError(f"Order '{order_id}' was not found.")

        return build_order_response()

    async def update_order_status(
        self,
        *,
        order_id: uuid.UUID,
        data: AdminOrderStatusUpdate,
    ) -> OrderResponse:
        """Return an order with an updated status."""

        if order_id == MISSING_ORDER_ID:
            raise ResourceNotFoundError(f"Order '{order_id}' was not found.")

        if data.status == OrderStatus.DELIVERED:
            raise ResourceConflictError("Order status cannot change from 'pending' to 'delivered'.")

        return build_order_response(
            status=data.status,
        )


def override_order_service() -> FakeAdminOrderService:
    """Provide the fake admin order service."""

    return FakeAdminOrderService()


@pytest.fixture(
    autouse=True,
)
def use_fake_order_service() -> Generator[None, None, None]:
    """Override the real order service during admin tests."""

    app.dependency_overrides[get_order_service] = override_order_service

    yield

    app.dependency_overrides.pop(
        get_order_service,
        None,
    )


client = TestClient(app)


def test_admin_can_list_all_orders() -> None:
    """An administrator should receive all orders."""

    response = client.get(
        "/api/v1/admin/orders",
    )

    assert response.status_code == 200

    response_body = response.json()

    assert len(response_body) == 1
    assert response_body[0]["id"] == str(ORDER_ID)
    assert response_body[0]["status"] == "pending"
    assert response_body[0]["payment_status"] == "pending"
    assert response_body[0]["total_paise"] == PRICE_PAISE


def test_admin_can_get_one_order() -> None:
    """An administrator should receive a complete order."""

    response = client.get(
        f"/api/v1/admin/orders/{ORDER_ID}",
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["id"] == str(ORDER_ID)
    assert response_body["recipient_name"] == "Arsal Masood"
    assert response_body["items"][0]["sku"] == ("MIR-ARCH-GOLD-L")


def test_admin_can_confirm_pending_order() -> None:
    """A pending order may become confirmed."""

    response = client.patch(
        f"/api/v1/admin/orders/{ORDER_ID}/status",
        json={
            "status": "confirmed",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


def test_admin_can_cancel_pending_order() -> None:
    """A pending order may become cancelled."""

    response = client.patch(
        f"/api/v1/admin/orders/{ORDER_ID}/status",
        json={
            "status": "cancelled",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_admin_cannot_skip_directly_to_delivered() -> None:
    """A pending order cannot become delivered directly."""

    response = client.patch(
        f"/api/v1/admin/orders/{ORDER_ID}/status",
        json={
            "status": "delivered",
        },
    )

    assert response.status_code == 409

    assert response.json() == {
        "detail": ("Order status cannot change from 'pending' to 'delivered'.")
    }


def test_admin_order_rejects_invalid_status() -> None:
    """Unknown order statuses should return HTTP 422."""

    response = client.patch(
        f"/api/v1/admin/orders/{ORDER_ID}/status",
        json={
            "status": "on_the_way",
        },
    )

    assert response.status_code == 422


def test_admin_status_update_rejects_extra_fields() -> None:
    """Admins cannot modify payment state through this endpoint."""

    response = client.patch(
        f"/api/v1/admin/orders/{ORDER_ID}/status",
        json={
            "status": "confirmed",
            "payment_status": "paid",
        },
    )

    assert response.status_code == 422


def test_admin_get_missing_order_returns_404() -> None:
    """An unknown order should return HTTP 404."""

    response = client.get(
        f"/api/v1/admin/orders/{MISSING_ORDER_ID}",
    )

    assert response.status_code == 404

    assert response.json() == {"detail": (f"Order '{MISSING_ORDER_ID}' was not found.")}


def test_admin_update_missing_order_returns_404() -> None:
    """Updating an unknown order should return HTTP 404."""

    response = client.patch(
        f"/api/v1/admin/orders/{MISSING_ORDER_ID}/status",
        json={
            "status": "confirmed",
        },
    )

    assert response.status_code == 404

    assert response.json() == {"detail": (f"Order '{MISSING_ORDER_ID}' was not found.")}


def test_admin_order_rejects_invalid_uuid() -> None:
    """An invalid order ID should return HTTP 422."""

    response = client.get(
        "/api/v1/admin/orders/not-a-valid-uuid",
    )

    assert response.status_code == 422
