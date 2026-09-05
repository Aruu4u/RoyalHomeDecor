import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.main import app
from app.models.product_image import ProductImage
from app.services.dependencies import get_product_image_service


PRODUCT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

MISSING_PRODUCT_ID = uuid.UUID("99999999-9999-9999-9999-999999999999")

PRIMARY_IMAGE_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")

SECONDARY_IMAGE_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")

NEW_IMAGE_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")

MISSING_IMAGE_ID = uuid.UUID("88888888-8888-8888-8888-888888888888")


def build_fake_image(
    *,
    image_id: uuid.UUID = PRIMARY_IMAGE_ID,
    display_order: int = 0,
    is_primary: bool = True,
) -> ProductImage:
    """Create one fake product image."""

    current_time = datetime.now(UTC)

    return ProductImage(
        id=image_id,
        product_id=PRODUCT_ID,
        image_url="https://example.com/mirror-main.webp",
        alt_text="Arched brass mirror front view",
        display_order=display_order,
        is_primary=is_primary,
        created_at=current_time,
        updated_at=current_time,
    )


class FakeProductImageService:
    """Fake image service that avoids database access."""

    async def add_image(
        self,
        product_id,
        data,
    ):
        """Create a fake image."""

        if product_id == MISSING_PRODUCT_ID:
            raise ResourceNotFoundError(f"Product '{product_id}' was not found.")

        if data.display_order == 1:
            raise ResourceConflictError("Another product image already uses display order 1.")

        image = build_fake_image(
            image_id=NEW_IMAGE_ID,
            display_order=data.display_order,
            is_primary=data.is_primary,
        )

        image.image_url = str(data.image_url)
        image.alt_text = data.alt_text

        return image

    async def update_image(
        self,
        image_id,
        data,
    ):
        """Update a fake image."""

        if image_id == MISSING_IMAGE_ID:
            raise ResourceNotFoundError(f"Product image '{image_id}' was not found.")

        if data.display_order == 0 and image_id == SECONDARY_IMAGE_ID:
            raise ResourceConflictError("Another product image already uses display order 0.")

        image = build_fake_image(
            image_id=image_id,
            display_order=(1 if image_id == SECONDARY_IMAGE_ID else 0),
            is_primary=image_id == PRIMARY_IMAGE_ID,
        )

        update_data = data.model_dump(
            exclude_unset=True,
            mode="json",
        )

        if update_data.get("is_primary") is False and image.is_primary:
            raise ResourceConflictError(
                "The current primary image cannot be unset directly. "
                "Set another image as primary instead."
            )

        for field_name, field_value in update_data.items():
            setattr(
                image,
                field_name,
                field_value,
            )

        image.updated_at = datetime.now(UTC)

        return image

    async def delete_image(
        self,
        image_id,
    ):
        """Delete a fake image."""

        if image_id == MISSING_IMAGE_ID:
            raise ResourceNotFoundError(f"Product image '{image_id}' was not found.")

        if image_id == PRIMARY_IMAGE_ID:
            raise ResourceConflictError("A product must contain at least one image.")


def override_product_image_service() -> FakeProductImageService:
    """Provide the fake image service."""

    return FakeProductImageService()


app.dependency_overrides[get_product_image_service] = override_product_image_service

client = TestClient(app)


def valid_image_payload() -> dict:
    """Return valid image request data."""

    return {
        "image_url": "https://example.com/mirror-detail.webp",
        "alt_text": "Close-up view of the brass mirror frame",
        "display_order": 2,
        "is_primary": False,
    }


def test_add_product_image_returns_201() -> None:
    """A valid image should be added successfully."""

    response = client.post(
        f"/api/v1/products/{PRODUCT_ID}/images",
        json=valid_image_payload(),
    )

    assert response.status_code == 201

    response_body = response.json()

    assert response_body["id"] == str(NEW_IMAGE_ID)
    assert response_body["product_id"] == str(PRODUCT_ID)
    assert response_body["display_order"] == 2
    assert response_body["is_primary"] is False
    assert response_body["alt_text"] == ("Close-up view of the brass mirror frame")


def test_add_image_to_missing_product_returns_404() -> None:
    """An image cannot be added to a missing product."""

    response = client.post(
        f"/api/v1/products/{MISSING_PRODUCT_ID}/images",
        json=valid_image_payload(),
    )

    assert response.status_code == 404

    assert response.json() == {"detail": f"Product '{MISSING_PRODUCT_ID}' was not found."}


def test_add_image_with_duplicate_display_order_returns_409() -> None:
    """Gallery positions must be unique within a product."""

    payload = valid_image_payload()
    payload["display_order"] = 1

    response = client.post(
        f"/api/v1/products/{PRODUCT_ID}/images",
        json=payload,
    )

    assert response.status_code == 409

    assert response.json() == {"detail": ("Another product image already uses display order 1.")}


def test_update_product_image_returns_updated_fields() -> None:
    """PATCH should update only supplied image fields."""

    response = client.patch(
        f"/api/v1/product-images/{SECONDARY_IMAGE_ID}",
        json={
            "alt_text": "Detailed antique brass frame",
            "display_order": 3,
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["id"] == str(SECONDARY_IMAGE_ID)
    assert response_body["alt_text"] == ("Detailed antique brass frame")
    assert response_body["display_order"] == 3
    assert response_body["is_primary"] is False


def test_set_another_image_as_primary() -> None:
    """A secondary image can be promoted to primary."""

    response = client.patch(
        f"/api/v1/product-images/{SECONDARY_IMAGE_ID}",
        json={
            "is_primary": True,
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["id"] == str(SECONDARY_IMAGE_ID)
    assert response_body["is_primary"] is True


def test_primary_image_cannot_be_unset_directly() -> None:
    """The current primary image cannot simply become secondary."""

    response = client.patch(
        f"/api/v1/product-images/{PRIMARY_IMAGE_ID}",
        json={
            "is_primary": False,
        },
    )

    assert response.status_code == 409

    assert response.json() == {
        "detail": (
            "The current primary image cannot be unset directly. "
            "Set another image as primary instead."
        )
    }


def test_update_to_existing_display_order_returns_409() -> None:
    """An image cannot take another image's gallery position."""

    response = client.patch(
        f"/api/v1/product-images/{SECONDARY_IMAGE_ID}",
        json={
            "display_order": 0,
        },
    )

    assert response.status_code == 409

    assert response.json() == {"detail": ("Another product image already uses display order 0.")}


def test_update_missing_image_returns_404() -> None:
    """Updating an unknown image should return HTTP 404."""

    response = client.patch(
        f"/api/v1/product-images/{MISSING_IMAGE_ID}",
        json={
            "alt_text": "Updated mirror image",
        },
    )

    assert response.status_code == 404

    assert response.json() == {"detail": (f"Product image '{MISSING_IMAGE_ID}' was not found.")}


def test_delete_product_image_returns_204() -> None:
    """A removable image should return HTTP 204."""

    response = client.delete(
        f"/api/v1/product-images/{SECONDARY_IMAGE_ID}",
    )

    assert response.status_code == 204
    assert response.content == b""


def test_delete_only_product_image_returns_409() -> None:
    """A product must keep at least one gallery image."""

    response = client.delete(
        f"/api/v1/product-images/{PRIMARY_IMAGE_ID}",
    )

    assert response.status_code == 409

    assert response.json() == {"detail": "A product must contain at least one image."}


def test_add_image_rejects_invalid_display_order() -> None:
    """Display order cannot be negative."""

    payload = valid_image_payload()
    payload["display_order"] = -1

    response = client.post(
        f"/api/v1/products/{PRODUCT_ID}/images",
        json=payload,
    )

    assert response.status_code == 422
