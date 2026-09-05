"""API tests for product reviews.

Follows the pattern used elsewhere in this suite: the service layer is
replaced through a dependency override, so the routes, schemas and
serialisation are exercised without a database.
"""

import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_optional_user
from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.schemas.review import (
    ProductReviewListResponse,
    ProductReviewResponse,
    ProductReviewSummary,
)
from app.services.dependencies import get_review_service


PRODUCT_SLUG = "arched-brass-mirror"
PRODUCT_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
REVIEW_ID = uuid.UUID("66666666-6666-6666-6666-666666666666")

SIGNED_IN_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")


def build_review(
    *,
    is_verified_purchase: bool = False,
) -> ProductReviewResponse:
    """Create a fake stored review."""

    current_time = datetime.now(UTC)

    return ProductReviewResponse(
        id=REVIEW_ID,
        product_id=PRODUCT_ID,
        author_name="Ananya Iyer",
        rating=5,
        title="Exactly as photographed",
        body="The marble veining is beautiful and the brass has a warm finish.",
        photo_urls=["https://images.example.com/review-1.webp"],
        is_verified_purchase=is_verified_purchase,
        created_at=current_time,
        updated_at=current_time,
    )


class FakeReviewService:
    """Fake review service used without a real database."""

    def __init__(self) -> None:
        self.review = build_review()

        # Records what the route passed through, so the tests can assert
        # that identity is taken from the token rather than the body.
        self.last_user_id: uuid.UUID | None = None
        self.last_user_email: str | None = None

        # Set to simulate a customer who has already reviewed the piece.
        self.already_reviewed = False

    async def list_for_slug(self, slug, *, offset, limit, approved_only=True):
        if slug != PRODUCT_SLUG:
            raise ResourceNotFoundError(f"Product with slug '{slug}' was not found.")

        return ProductReviewListResponse(
            summary=ProductReviewSummary(
                review_count=3,
                average_rating=4.33,
                breakdown={1: 0, 2: 0, 3: 1, 4: 0, 5: 2},
            ),
            reviews=[self.review][offset : offset + limit],
        )

    async def create_for_slug(self, slug, *, data, user_id, user_email):
        if slug != PRODUCT_SLUG:
            raise ResourceNotFoundError(f"Product with slug '{slug}' was not found.")

        if self.already_reviewed and user_id is not None:
            raise ResourceConflictError("You have already reviewed this piece.")

        self.last_user_id = user_id
        self.last_user_email = user_email

        stored = build_review(is_verified_purchase=user_id is not None)

        stored.author_name = data.author_name
        stored.rating = data.rating
        stored.title = data.title
        stored.body = data.body
        stored.photo_urls = [str(url) for url in data.photo_urls]

        return stored

    async def set_approval(self, review_id, *, is_approved):
        if review_id != REVIEW_ID:
            raise ResourceNotFoundError(f"Review '{review_id}' was not found.")

        return self.review

    async def delete_review(self, review_id) -> None:
        if review_id != REVIEW_ID:
            raise ResourceNotFoundError(f"Review '{review_id}' was not found.")


@pytest.fixture(autouse=True)
def override_review_service():
    """Swap the real review service for the fake one."""

    service = FakeReviewService()

    app.dependency_overrides[get_review_service] = lambda: service

    yield service

    app.dependency_overrides.pop(get_review_service, None)


@pytest.fixture
def signed_in():
    """Make the optional-user dependency report a signed-in customer."""

    async def override() -> AuthenticatedUser:
        return AuthenticatedUser(
            id=SIGNED_IN_USER_ID,
            email="customer@example.com",
            app_metadata={"role": "customer"},
            user_metadata={},
        )

    app.dependency_overrides[get_optional_user] = override

    yield

    app.dependency_overrides.pop(get_optional_user, None)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def valid_review_payload() -> dict:
    """Return a valid review submission."""

    return {
        "rating": 5,
        "author_name": "Ananya Iyer",
        "author_email": "ananya@example.com",
        "title": "Exactly as photographed",
        "body": "The marble veining is beautiful and the brass has a warm finish.",
        "photo_urls": ["https://images.example.com/review-1.webp"],
    }


class TestReadingReviews:
    """What the product page shows."""

    def test_list_returns_reviews_and_the_aggregate_score(
        self,
        client: TestClient,
    ) -> None:
        response = client.get(f"/api/v1/products/{PRODUCT_SLUG}/reviews")

        assert response.status_code == 200

        payload = response.json()

        assert payload["summary"]["review_count"] == 3
        assert payload["summary"]["average_rating"] == 4.33
        assert len(payload["reviews"]) == 1

    def test_the_breakdown_covers_all_five_stars(
        self,
        client: TestClient,
    ) -> None:
        """So the storefront can draw the bars without filling gaps."""

        response = client.get(f"/api/v1/products/{PRODUCT_SLUG}/reviews")

        breakdown = response.json()["summary"]["breakdown"]

        assert sorted(breakdown) == ["1", "2", "3", "4", "5"]

    def test_the_reviewer_email_is_never_returned(
        self,
        client: TestClient,
    ) -> None:
        """A public review list is the last place a customer's email goes."""

        response = client.get(f"/api/v1/products/{PRODUCT_SLUG}/reviews")

        review = response.json()["reviews"][0]

        assert "author_email" not in review

    def test_unknown_product_returns_404(self, client: TestClient) -> None:
        response = client.get("/api/v1/products/no-such-piece/reviews")

        assert response.status_code == 404


class TestWritingReviews:
    """Submitting the form on the product page."""

    def test_a_guest_can_leave_a_review(self, client: TestClient) -> None:
        """Which is why the form collects a name and an email address."""

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=valid_review_payload(),
        )

        assert response.status_code == 201
        assert response.json()["author_name"] == "Ananya Iyer"

    def test_a_guest_review_is_not_marked_as_a_verified_purchase(
        self,
        client: TestClient,
        override_review_service: FakeReviewService,
    ) -> None:
        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=valid_review_payload(),
        )

        assert response.json()["is_verified_purchase"] is False
        assert override_review_service.last_user_id is None

    def test_a_signed_in_review_is_linked_to_that_account(
        self,
        client: TestClient,
        override_review_service: FakeReviewService,
        signed_in: None,
    ) -> None:
        """Identity comes from the token, never from the request body."""

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=valid_review_payload(),
        )

        assert response.status_code == 201
        assert override_review_service.last_user_id == SIGNED_IN_USER_ID
        assert override_review_service.last_user_email == "customer@example.com"

    def test_verified_purchase_cannot_be_claimed_in_the_body(
        self,
        client: TestClient,
    ) -> None:
        """The badge is decided by the server from order history."""

        payload = valid_review_payload()
        payload["is_verified_purchase"] = True

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=payload,
        )

        assert response.status_code == 422

    def test_a_second_review_from_the_same_customer_returns_409(
        self,
        client: TestClient,
        override_review_service: FakeReviewService,
        signed_in: None,
    ) -> None:
        override_review_service.already_reviewed = True

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=valid_review_payload(),
        )

        assert response.status_code == 409

    @pytest.mark.parametrize("rating", [0, -1, 6, 100])
    def test_a_rating_outside_one_to_five_is_rejected(
        self,
        client: TestClient,
        rating: int,
    ) -> None:
        """An out-of-range rating would corrupt every average using it."""

        payload = valid_review_payload()
        payload["rating"] = rating

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=payload,
        )

        assert response.status_code == 422

    def test_a_very_short_review_is_rejected(self, client: TestClient) -> None:
        payload = valid_review_payload()
        payload["body"] = "Nice"

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=payload,
        )

        assert response.status_code == 422

    def test_a_whitespace_only_review_is_rejected(
        self,
        client: TestClient,
    ) -> None:
        payload = valid_review_payload()
        payload["body"] = "              "

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=payload,
        )

        assert response.status_code == 422

    def test_a_malformed_email_is_rejected(self, client: TestClient) -> None:
        payload = valid_review_payload()
        payload["author_email"] = "not-an-address"

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=payload,
        )

        assert response.status_code == 422

    def test_the_email_is_optional(self, client: TestClient) -> None:
        payload = valid_review_payload()
        payload.pop("author_email")

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=payload,
        )

        assert response.status_code == 201

    def test_too_many_photographs_are_rejected(
        self,
        client: TestClient,
    ) -> None:
        payload = valid_review_payload()

        payload["photo_urls"] = [
            f"https://images.example.com/review-{index}.webp"
            for index in range(20)
        ]

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=payload,
        )

        assert response.status_code == 422

    def test_photographs_are_optional(self, client: TestClient) -> None:
        payload = valid_review_payload()
        payload.pop("photo_urls")

        response = client.post(
            f"/api/v1/products/{PRODUCT_SLUG}/reviews",
            json=payload,
        )

        assert response.status_code == 201
        assert response.json()["photo_urls"] == []

    def test_reviewing_an_unknown_product_returns_404(
        self,
        client: TestClient,
    ) -> None:
        response = client.post(
            "/api/v1/products/no-such-piece/reviews",
            json=valid_review_payload(),
        )

        assert response.status_code == 404


class TestModeratingReviews:
    """Taking a review down without destroying it."""

    def test_hiding_a_review_returns_200(self, client: TestClient) -> None:
        response = client.patch(
            f"/api/v1/reviews/{REVIEW_ID}/approval",
            params={"is_approved": "false"},
        )

        assert response.status_code == 200

    def test_hiding_an_unknown_review_returns_404(
        self,
        client: TestClient,
    ) -> None:
        response = client.patch(
            f"/api/v1/reviews/{uuid.uuid4()}/approval",
            params={"is_approved": "false"},
        )

        assert response.status_code == 404

    def test_delete_returns_204(self, client: TestClient) -> None:
        response = client.delete(f"/api/v1/reviews/{REVIEW_ID}")

        assert response.status_code == 204

    def test_deleting_an_unknown_review_returns_404(
        self,
        client: TestClient,
    ) -> None:
        response = client.delete(f"/api/v1/reviews/{uuid.uuid4()}")

        assert response.status_code == 404
