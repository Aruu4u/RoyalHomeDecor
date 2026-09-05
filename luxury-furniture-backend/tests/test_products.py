import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi.testclient import TestClient

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.main import app
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.product_variant import ProductVariant
from app.services.dependencies import get_product_service


PRODUCT_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")

COLLECTION_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

IMAGE_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")

VARIANT_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")

INVENTORY_ID = uuid.UUID("55555555-5555-5555-5555-555555555555")


def build_fake_product() -> Product:
    """Create a complete fake product with nested records."""

    current_time = datetime.now(UTC)

    product = Product(
        id=PRODUCT_ID,
        collection_id=COLLECTION_ID,
        name="Arched Brass Mirror",
        slug="arched-brass-mirror",
        short_description=("A refined arched mirror with a brass frame."),
        description=("A decorative brass-framed mirror designed for elegant and modern interiors."),
        base_price_paise=1299900,
        top_material="Glass",
        base_material="Brass",
        finish="Antique polish",
        colour="Antique gold",
        style="Modern classic",
        thumbnail_url="https://example.com/mirror.webp",
        is_active=True,
        is_recommended=True,
        created_at=current_time,
        updated_at=current_time,
    )

    image = ProductImage(
        id=IMAGE_ID,
        product_id=PRODUCT_ID,
        image_url="https://example.com/mirror-main.webp",
        alt_text="Arched brass mirror front view",
        display_order=0,
        is_primary=True,
        created_at=current_time,
        updated_at=current_time,
    )

    inventory = Inventory(
        id=INVENTORY_ID,
        variant_id=VARIANT_ID,
        quantity_on_hand=10,
        reserved_quantity=0,
        low_stock_threshold=3,
        created_at=current_time,
        updated_at=current_time,
    )

    variant = ProductVariant(
        id=VARIANT_ID,
        product_id=PRODUCT_ID,
        sku="MIR-ARCH-GOLD-L",
        name="Large",
        size_label="90 Ã— 120 cm",
        colour="Antique gold",
        material="Brass and glass",
        price_paise=1299900,
        length_cm=Decimal("90.00"),
        width_cm=Decimal("4.00"),
        height_cm=Decimal("120.00"),
        weight_grams=8500,
        is_active=True,
        created_at=current_time,
        updated_at=current_time,
    )

    variant.inventory = inventory
    product.images = [image]
    product.variants = [variant]

    # Derived fields the real service annotates onto the ORM object before
    # serialising. Set here so the fake produces the same shape of
    # response the storefront actually receives.
    product.offer_discount_percent = None
    product.offer_price_paise = None
    product.available_quantity = 10
    product.in_stock = True
    product.review_count = 2
    product.review_average = 4.5

    return product


class FakeProductService:
    """Fake product service used without Supabase."""

    async def create_product(self, data):
        """Create a fake product response."""

        if data.collection_id != COLLECTION_ID:
            raise ResourceNotFoundError(f"Collection '{data.collection_id}' was not found.")

        if data.slug == "duplicate-product":
            raise ResourceConflictError("A product with slug 'duplicate-product' already exists.")

        submitted_skus = {variant.sku for variant in data.variants}

        if "EXISTING-SKU" in submitted_skus:
            raise ResourceConflictError("These SKUs already exist: EXISTING-SKU.")

        product = build_fake_product()

        product.name = data.name
        product.slug = data.slug
        product.collection_id = data.collection_id
        product.short_description = data.short_description
        product.description = data.description
        product.base_price_paise = data.base_price_paise
        product.top_material = data.top_material
        product.base_material = data.base_material
        product.finish = data.finish
        product.colour = data.colour
        product.style = data.style
        product.thumbnail_url = data.thumbnail_url
        product.is_active = data.is_active
        product.is_recommended = data.is_recommended

        return product

    async def list_products(
        self,
        *,
        offset,
        limit,
        active_only,
        collection_id,
        top_material,
        base_material,
        finish,
        colour,
        style,
        recommended_only,
        in_offer=False,
        order_by="curated",
        search,
    ):
        """Return a filtered fake product list."""

        products = [build_fake_product()]

        if active_only:
            products = [product for product in products if product.is_active]

        if collection_id is not None:
            products = [product for product in products if product.collection_id == collection_id]

        for field_name, wanted in (
            ("top_material", top_material),
            ("base_material", base_material),
            ("finish", finish),
        ):
            if wanted is None:
                continue

            products = [
                product
                for product in products
                if getattr(product, field_name)
                and getattr(product, field_name).lower() == wanted.lower()
            ]

        if in_offer:
            products = [
                product for product in products if product.offer_percent is not None
            ]

        if colour is not None:
            products = [
                product
                for product in products
                if product.colour and product.colour.lower() == colour.lower()
            ]

        if recommended_only:
            products = [product for product in products if product.is_recommended]

        if search:
            products = [product for product in products if search.lower() in product.name.lower()]

        return products[offset : offset + limit]

    async def get_product_by_slug(self, slug):
        """Return one fake product by slug."""

        if slug != "arched-brass-mirror":
            raise ResourceNotFoundError(f"Product with slug '{slug}' was not found.")

        return build_fake_product()

    async def update_product(self, product_id, data):
        """Update the supplied fake product fields."""

        if product_id != PRODUCT_ID:
            raise ResourceNotFoundError(f"Product '{product_id}' was not found.")

        product = build_fake_product()

        update_data = data.model_dump(
            exclude_unset=True,
            mode="json",
        )

        for field_name, field_value in update_data.items():
            setattr(product, field_name, field_value)

        product.updated_at = datetime.now(UTC)

        return product

    async def delete_product(self, product_id):
        """Pretend to delete a fake product."""

        if product_id != PRODUCT_ID:
            raise ResourceNotFoundError(f"Product '{product_id}' was not found.")


def override_product_service() -> FakeProductService:
    """Provide a fresh fake service for each request."""

    return FakeProductService()


app.dependency_overrides[get_product_service] = override_product_service

client = TestClient(app)


def valid_product_payload() -> dict:
    """Return valid nested product request data."""

    return {
        "name": "Arched Brass Mirror",
        "slug": "arched-brass-mirror",
        "collection_id": str(COLLECTION_ID),
        "short_description": ("A refined arched mirror with a brass frame."),
        "description": (
            "A decorative brass-framed mirror designed for elegant and modern interiors."
        ),
        "base_price_paise": 1299900,
        "top_material": "Glass",
        "base_material": "Brass",
        "finish": "Antique polish",
        "colour": "Antique gold",
        "style": "Modern classic",
        "thumbnail_url": "https://example.com/mirror.webp",
        "is_active": True,
        "is_recommended": True,
        "images": [
            {
                "image_url": ("https://example.com/mirror-main.webp"),
                "alt_text": ("Arched brass mirror front view"),
                "display_order": 0,
                "is_primary": True,
            }
        ],
        "variants": [
            {
                "sku": "MIR-ARCH-GOLD-L",
                "name": "Large",
                "size_label": "90 Ã— 120 cm",
                "colour": "Antique gold",
                "material": "Brass and glass",
                "price_paise": 1299900,
                "length_cm": 90,
                "width_cm": 4,
                "height_cm": 120,
                "weight_grams": 8500,
                "is_active": True,
                "inventory": {
                    "quantity_on_hand": 10,
                    "reserved_quantity": 0,
                    "low_stock_threshold": 3,
                },
            }
        ],
    }


def test_create_product_returns_nested_product() -> None:
    """A valid nested product should return HTTP 201."""

    response = client.post(
        "/api/v1/products",
        json=valid_product_payload(),
    )

    assert response.status_code == 201

    response_body = response.json()

    assert response_body["name"] == "Arched Brass Mirror"
    assert response_body["slug"] == "arched-brass-mirror"
    assert response_body["collection_id"] == str(COLLECTION_ID)

    assert len(response_body["images"]) == 1
    assert response_body["images"][0]["is_primary"] is True

    assert len(response_body["variants"]) == 1
    assert response_body["variants"][0]["sku"] == ("MIR-ARCH-GOLD-L")

    assert response_body["variants"][0]["inventory"]["available_quantity"] == 10


def test_list_products_returns_summary_data() -> None:
    """The product list should return lightweight card data."""

    response = client.get(
        "/api/v1/products",
        params={
            "offset": 0,
            "limit": 20,
            "active_only": True,
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert len(response_body) == 1
    assert response_body[0]["name"] == "Arched Brass Mirror"
    assert response_body[0]["slug"] == "arched-brass-mirror"

    assert "images" not in response_body[0]
    assert "variants" not in response_body[0]


def test_get_product_by_slug_returns_details() -> None:
    """An existing product slug should return nested data."""

    response = client.get(
        "/api/v1/products/arched-brass-mirror",
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["slug"] == "arched-brass-mirror"
    assert len(response_body["images"]) == 1
    assert len(response_body["variants"]) == 1
    assert response_body["variants"][0]["inventory"]["quantity_on_hand"] == 10


def test_get_missing_product_returns_404() -> None:
    """An unknown product slug should return HTTP 404."""

    response = client.get(
        "/api/v1/products/unknown-product",
    )

    assert response.status_code == 404

    assert response.json() == {"detail": ("Product with slug 'unknown-product' was not found.")}


def test_create_product_with_missing_collection_returns_404() -> None:
    """A product cannot use a nonexistent collection."""

    payload = valid_product_payload()

    missing_collection_id = uuid.UUID("99999999-9999-9999-9999-999999999999")

    payload["collection_id"] = str(missing_collection_id)

    response = client.post(
        "/api/v1/products",
        json=payload,
    )

    assert response.status_code == 404

    assert response.json() == {"detail": (f"Collection '{missing_collection_id}' was not found.")}


def test_create_duplicate_product_slug_returns_409() -> None:
    """A duplicate product slug should return HTTP 409."""

    payload = valid_product_payload()
    payload["slug"] = "duplicate-product"

    response = client.post(
        "/api/v1/products",
        json=payload,
    )

    assert response.status_code == 409

    assert response.json() == {
        "detail": ("A product with slug 'duplicate-product' already exists.")
    }


def test_create_product_with_existing_sku_returns_409() -> None:
    """A globally existing SKU should return HTTP 409."""

    payload = valid_product_payload()
    payload["variants"][0]["sku"] = "EXISTING-SKU"

    response = client.post(
        "/api/v1/products",
        json=payload,
    )

    assert response.status_code == 409

    assert response.json() == {"detail": ("These SKUs already exist: EXISTING-SKU.")}


def test_create_product_without_primary_image_returns_422() -> None:
    """Every product must contain exactly one primary image."""

    payload = valid_product_payload()
    payload["images"][0]["is_primary"] = False

    response = client.post(
        "/api/v1/products",
        json=payload,
    )

    assert response.status_code == 422


def test_create_product_rejects_duplicate_request_skus() -> None:
    """One request cannot contain two identical SKUs."""

    payload = valid_product_payload()

    duplicate_variant = payload["variants"][0].copy()
    payload["variants"].append(duplicate_variant)

    response = client.post(
        "/api/v1/products",
        json=payload,
    )

    assert response.status_code == 422


def test_update_product_changes_supplied_fields() -> None:
    """PATCH should update only supplied product fields."""

    response = client.patch(
        f"/api/v1/products/{PRODUCT_ID}",
        json={
            "name": "Premium Arched Brass Mirror",
            "base_price_paise": 1399900,
            "is_recommended": False,
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["name"] == ("Premium Arched Brass Mirror")
    assert response_body["base_price_paise"] == 1399900
    assert response_body["is_recommended"] is False

    assert response_body["slug"] == "arched-brass-mirror"
    assert len(response_body["images"]) == 1


def test_delete_product_returns_no_content() -> None:
    """Deleting an existing product should return HTTP 204."""

    response = client.delete(
        f"/api/v1/products/{PRODUCT_ID}",
    )

    assert response.status_code == 204
    assert response.content == b""


def test_product_summary_carries_the_material_split() -> None:
    """Cards and filters need the three fields separately, not merged."""

    response = client.get("/api/v1/products")

    summary = response.json()[0]

    assert summary["top_material"] == "Glass"
    assert summary["base_material"] == "Brass"
    assert summary["finish"] == "Antique polish"

    # The merged field is gone, so nothing can quietly keep reading it.
    assert "material" not in summary


def test_product_summary_carries_stock_information() -> None:
    """The list endpoint returns no variants, so cards need this.

    Without it a product card cannot tell a sold-out piece from an
    available one, and would offer an "Add to cart" button that always
    fails.
    """

    response = client.get("/api/v1/products")

    summary = response.json()[0]

    assert summary["in_stock"] is True
    assert summary["available_quantity"] == 10


def test_product_summary_carries_the_review_score() -> None:
    response = client.get("/api/v1/products")

    summary = response.json()[0]

    assert summary["review_count"] == 2
    assert summary["review_average"] == 4.5


def test_filtering_by_top_material_matches_case_insensitively() -> None:
    response = client.get(
        "/api/v1/products",
        params={"top_material": "glass"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_filtering_by_base_material_excludes_non_matches() -> None:
    response = client.get(
        "/api/v1/products",
        params={"base_material": "teak"},
    )

    assert response.status_code == 200
    assert response.json() == []


def test_filtering_by_finish_excludes_non_matches() -> None:
    response = client.get(
        "/api/v1/products",
        params={"finish": "matte"},
    )

    assert response.status_code == 200
    assert response.json() == []


def test_in_offer_filter_excludes_pieces_without_a_discount() -> None:
    """The fake product carries no offer, so the filter empties the list."""

    response = client.get(
        "/api/v1/products",
        params={"in_offer": "true"},
    )

    assert response.status_code == 200
    assert response.json() == []


def test_in_offer_defaults_to_off() -> None:
    """Browsing the catalogue must not silently hide full-price pieces."""

    response = client.get("/api/v1/products")

    assert len(response.json()) == 1


def test_most_sold_ordering_is_accepted() -> None:
    response = client.get(
        "/api/v1/products",
        params={"order_by": "most_sold"},
    )

    assert response.status_code == 200


def test_an_unknown_ordering_is_rejected() -> None:
    """A typo must not silently fall back to a different order."""

    response = client.get(
        "/api/v1/products",
        params={"order_by": "cheapest"},
    )

    assert response.status_code == 422


def test_update_can_set_an_offer_that_expires() -> None:
    """The duration is sent as days; the server owns the deadline."""

    response = client.patch(
        f"/api/v1/products/{PRODUCT_ID}",
        json={
            "offer_percent": 25,
            "offer_label": "Festive offer",
            "offer_duration_days": 14,
        },
    )

    assert response.status_code == 200
    assert response.json()["offer_percent"] == 25


def test_update_rejects_an_absurd_offer_duration() -> None:
    """A multi-year "limited time" offer is a data-entry mistake."""

    response = client.patch(
        f"/api/v1/products/{PRODUCT_ID}",
        json={
            "offer_percent": 25,
            "offer_duration_days": 5000,
        },
    )

    assert response.status_code == 422


def test_update_rejects_a_zero_day_offer_duration() -> None:
    """Zero days would create an offer that has already ended."""

    response = client.patch(
        f"/api/v1/products/{PRODUCT_ID}",
        json={
            "offer_percent": 25,
            "offer_duration_days": 0,
        },
    )

    assert response.status_code == 422
