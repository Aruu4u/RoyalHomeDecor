import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.main import app
from app.models.inventory import Inventory
from app.services.dependencies import get_inventory_service


VARIANT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

MISSING_VARIANT_ID = uuid.UUID("99999999-9999-9999-9999-999999999999")

VARIANT_WITHOUT_INVENTORY_ID = uuid.UUID("88888888-8888-8888-8888-888888888888")

INVENTORY_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def build_fake_inventory() -> Inventory:
    """Create one fake inventory record."""

    current_time = datetime.now(UTC)

    return Inventory(
        id=INVENTORY_ID,
        variant_id=VARIANT_ID,
        quantity_on_hand=10,
        reserved_quantity=2,
        low_stock_threshold=3,
        created_at=current_time,
        updated_at=current_time,
    )


class FakeInventoryService:
    """Fake inventory service that avoids database access."""

    async def update_inventory(
        self,
        variant_id,
        data,
    ):
        """Update fake inventory values."""

        if variant_id == MISSING_VARIANT_ID:
            raise ResourceNotFoundError(f"Product variant '{variant_id}' was not found.")

        if variant_id == VARIANT_WITHOUT_INVENTORY_ID:
            raise ResourceNotFoundError(
                f"Inventory for product variant '{variant_id}' was not found."
            )

        inventory = build_fake_inventory()

        update_data = data.model_dump(
            exclude_unset=True,
        )

        new_quantity_on_hand = update_data.get(
            "quantity_on_hand",
            inventory.quantity_on_hand,
        )

        new_reserved_quantity = update_data.get(
            "reserved_quantity",
            inventory.reserved_quantity,
        )

        if new_reserved_quantity > new_quantity_on_hand:
            raise ResourceConflictError("Reserved quantity cannot exceed quantity on hand.")

        for field_name, field_value in update_data.items():
            setattr(
                inventory,
                field_name,
                field_value,
            )

        inventory.updated_at = datetime.now(UTC)

        return inventory


def override_inventory_service() -> FakeInventoryService:
    """Provide the fake inventory service."""

    return FakeInventoryService()


app.dependency_overrides[get_inventory_service] = override_inventory_service

client = TestClient(app)


def test_update_inventory_returns_updated_stock() -> None:
    """A complete valid update should return HTTP 200."""

    response = client.patch(
        f"/api/v1/inventory/{VARIANT_ID}",
        json={
            "quantity_on_hand": 15,
            "reserved_quantity": 3,
            "low_stock_threshold": 4,
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["variant_id"] == str(VARIANT_ID)
    assert response_body["quantity_on_hand"] == 15
    assert response_body["reserved_quantity"] == 3
    assert response_body["low_stock_threshold"] == 4
    assert response_body["available_quantity"] == 12


def test_partial_inventory_update_keeps_existing_values() -> None:
    """PATCH should preserve fields that were not supplied."""

    response = client.patch(
        f"/api/v1/inventory/{VARIANT_ID}",
        json={
            "quantity_on_hand": 20,
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["quantity_on_hand"] == 20
    assert response_body["reserved_quantity"] == 2
    assert response_body["low_stock_threshold"] == 3
    assert response_body["available_quantity"] == 18


def test_update_reserved_quantity_only() -> None:
    """Reserved stock can be updated independently."""

    response = client.patch(
        f"/api/v1/inventory/{VARIANT_ID}",
        json={
            "reserved_quantity": 4,
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["quantity_on_hand"] == 10
    assert response_body["reserved_quantity"] == 4
    assert response_body["available_quantity"] == 6


def test_update_inventory_for_missing_variant_returns_404() -> None:
    """An unknown variant should return HTTP 404."""

    response = client.patch(
        f"/api/v1/inventory/{MISSING_VARIANT_ID}",
        json={
            "quantity_on_hand": 5,
        },
    )

    assert response.status_code == 404

    assert response.json() == {"detail": (f"Product variant '{MISSING_VARIANT_ID}' was not found.")}


def test_missing_inventory_record_returns_404() -> None:
    """A variant without inventory should return HTTP 404."""

    response = client.patch(
        f"/api/v1/inventory/{VARIANT_WITHOUT_INVENTORY_ID}",
        json={
            "quantity_on_hand": 5,
        },
    )

    assert response.status_code == 404

    assert response.json() == {
        "detail": (f"Inventory for product variant '{VARIANT_WITHOUT_INVENTORY_ID}' was not found.")
    }


def test_reserved_quantity_above_stock_returns_422() -> None:
    """The schema should reject invalid supplied stock values."""

    response = client.patch(
        f"/api/v1/inventory/{VARIANT_ID}",
        json={
            "quantity_on_hand": 5,
            "reserved_quantity": 8,
        },
    )

    assert response.status_code == 422


def test_reducing_stock_below_existing_reservations_returns_409() -> None:
    """New stock cannot be lower than current reserved stock."""

    response = client.patch(
        f"/api/v1/inventory/{VARIANT_ID}",
        json={
            "quantity_on_hand": 1,
        },
    )

    assert response.status_code == 409

    assert response.json() == {"detail": ("Reserved quantity cannot exceed quantity on hand.")}


def test_negative_quantity_on_hand_returns_422() -> None:
    """Stock values cannot be negative."""

    response = client.patch(
        f"/api/v1/inventory/{VARIANT_ID}",
        json={
            "quantity_on_hand": -1,
        },
    )

    assert response.status_code == 422


def test_negative_reserved_quantity_returns_422() -> None:
    """Reserved stock cannot be negative."""

    response = client.patch(
        f"/api/v1/inventory/{VARIANT_ID}",
        json={
            "reserved_quantity": -1,
        },
    )

    assert response.status_code == 422


def test_negative_low_stock_threshold_returns_422() -> None:
    """The low-stock threshold cannot be negative."""

    response = client.patch(
        f"/api/v1/inventory/{VARIANT_ID}",
        json={
            "low_stock_threshold": -1,
        },
    )

    assert response.status_code == 422


def test_inventory_update_rejects_extra_fields() -> None:
    """Unexpected request fields should return HTTP 422."""

    response = client.patch(
        f"/api/v1/inventory/{VARIANT_ID}",
        json={
            "quantity_on_hand": 10,
            "unknown_field": 123,
        },
    )

    assert response.status_code == 422
