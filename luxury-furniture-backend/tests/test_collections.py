import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.main import app
from app.models.collection import Collection
from app.services.dependencies import get_collection_service


class FakeCollectionService:
    """Fake collection service used without a real database."""

    def __init__(self) -> None:
        self.collection_id = uuid.UUID("11111111-1111-1111-1111-111111111111")

        self.collection = Collection(
            id=self.collection_id,
            name="Mirrors",
            slug="mirrors",
            short_description="Elegant mirrors designed for refined interiors.",
            description="A collection of decorative and functional mirrors.",
            hero_image_url="https://images.example.com/mirrors.webp",
            display_order=0,
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    async def create_collection(self, data):
        """Return a newly created collection."""

        if data.slug == "mirrors":
            raise ResourceConflictError("A collection with slug 'mirrors' already exists.")

        return Collection(
            id=uuid.uuid4(),
            **data.model_dump(mode="json"),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    async def list_collections(
        self,
        *,
        offset: int,
        limit: int,
        active_only: bool,
    ):
        """Return a fake collection list."""

        collections = [self.collection]

        if active_only:
            collections = [collection for collection in collections if collection.is_active]

        return collections[offset : offset + limit]

    async def get_collection_by_slug(self, slug: str):
        """Return a collection using its slug."""

        if slug != self.collection.slug:
            raise ResourceNotFoundError(f"Collection with slug '{slug}' was not found.")

        return self.collection

    async def update_collection(self, collection_id, data):
        """Apply supplied values to the fake collection."""

        if collection_id != self.collection_id:
            raise ResourceNotFoundError(f"Collection '{collection_id}' was not found.")

        update_data = data.model_dump(
            exclude_unset=True,
            mode="json",
        )

        for field_name, field_value in update_data.items():
            setattr(
                self.collection,
                field_name,
                field_value,
            )

        self.collection.updated_at = datetime.now(UTC)

        return self.collection

    async def delete_collection(self, collection_id):
        """Pretend to delete the fake collection."""

        if collection_id != self.collection_id:
            raise ResourceNotFoundError(f"Collection '{collection_id}' was not found.")


def override_collection_service() -> FakeCollectionService:
    """Give every request a fresh fake collection service."""

    return FakeCollectionService()


app.dependency_overrides[get_collection_service] = override_collection_service

client = TestClient(app)


def test_create_collection_returns_created_collection() -> None:
    """Creating a valid collection should return HTTP 201."""

    response = client.post(
        "/api/v1/collections",
        json={
            "name": "Wall Decor",
            "slug": "wall-decor",
            "short_description": ("Artistic wall decor designed for modern interiors."),
            "description": ("Decorative wall pieces made for elegant living spaces."),
            "hero_image_url": ("https://images.example.com/wall-decor.webp"),
            "display_order": 1,
            "is_active": True,
        },
    )

    assert response.status_code == 201

    response_body = response.json()

    assert response_body["name"] == "Wall Decor"
    assert response_body["slug"] == "wall-decor"
    assert response_body["display_order"] == 1
    assert response_body["is_active"] is True
    assert "id" in response_body
    assert "created_at" in response_body


def test_list_collections_returns_active_collections() -> None:
    """The list endpoint should return homepage collections."""

    response = client.get(
        "/api/v1/collections",
        params={
            "offset": 0,
            "limit": 20,
            "active_only": True,
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert len(response_body) == 1
    assert response_body[0]["name"] == "Mirrors"
    assert response_body[0]["slug"] == "mirrors"


def test_get_collection_by_slug_returns_collection() -> None:
    """An existing collection slug should return HTTP 200."""

    response = client.get(
        "/api/v1/collections/mirrors",
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["name"] == "Mirrors"
    assert response_body["slug"] == "mirrors"


def test_get_missing_collection_returns_404() -> None:
    """An unknown collection slug should return HTTP 404."""

    response = client.get(
        "/api/v1/collections/unknown-collection",
    )

    assert response.status_code == 404

    assert response.json() == {
        "detail": ("Collection with slug 'unknown-collection' was not found.")
    }


def test_create_duplicate_collection_returns_409() -> None:
    """A duplicate collection slug should return HTTP 409."""

    response = client.post(
        "/api/v1/collections",
        json={
            "name": "Another Mirrors Collection",
            "slug": "mirrors",
            "short_description": ("Another elegant mirror collection for interiors."),
            "description": None,
            "hero_image_url": None,
            "display_order": 2,
            "is_active": True,
        },
    )

    assert response.status_code == 409

    assert response.json() == {"detail": ("A collection with slug 'mirrors' already exists.")}


def test_update_collection_changes_supplied_fields() -> None:
    """PATCH should update only the fields sent by the client."""

    response = client.patch(
        ("/api/v1/collections/11111111-1111-1111-1111-111111111111"),
        json={
            "short_description": ("Premium mirrors created for sophisticated spaces."),
            "display_order": 2,
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["name"] == "Mirrors"
    assert response_body["slug"] == "mirrors"
    assert response_body["display_order"] == 2
    assert response_body["short_description"] == (
        "Premium mirrors created for sophisticated spaces."
    )


def test_delete_collection_returns_no_content() -> None:
    """Deleting an existing collection should return HTTP 204."""

    response = client.delete(
        ("/api/v1/collections/11111111-1111-1111-1111-111111111111"),
    )

    assert response.status_code == 204
    assert response.content == b""


def test_create_collection_rejects_invalid_slug() -> None:
    """Collection slugs must be lowercase and URL-safe."""

    response = client.post(
        "/api/v1/collections",
        json={
            "name": "Side Tables",
            "slug": "Side Tables",
            "short_description": ("Compact side tables for stylish modern interiors."),
            "description": None,
            "hero_image_url": None,
            "display_order": 2,
            "is_active": True,
        },
    )

    assert response.status_code == 422


def test_create_collection_rejects_negative_display_order() -> None:
    """Display order cannot be negative."""

    response = client.post(
        "/api/v1/collections",
        json={
            "name": "Center Tables",
            "slug": "center-tables",
            "short_description": ("Statement center tables designed for living spaces."),
            "description": None,
            "hero_image_url": None,
            "display_order": -1,
            "is_active": True,
        },
    )

    assert response.status_code == 422
