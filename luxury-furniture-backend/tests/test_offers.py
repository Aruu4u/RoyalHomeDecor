"""API tests for special offer sections.

Follows the existing pattern in this suite: the service layer is replaced
with a fake through dependency overrides, so the routes, schemas and
serialisation are exercised without needing a database.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.main import app
from app.schemas.offer import (
    OfferItemResponse,
    OfferMembershipResponse,
    OfferProductResponse,
    OfferSectionDetailResponse,
    ProductOfferStatusResponse,
)
from app.services.dependencies import get_offer_service
from app.services.offer_pricing import apply_discount, saving_paise


SECTION_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
ITEM_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
PRODUCT_ID = uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
COLLECTION_ID = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

# A product that already carries its own running discount, used to
# exercise the conflict path when it is added to a section.
ALREADY_DISCOUNTED_PRODUCT_ID = uuid.UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")

BASE_PRICE_PAISE = 999_900
DISCOUNT_PERCENT = 30


def build_status(*, with_live_offer: bool) -> ProductOfferStatusResponse:
    """Create a fake offer-status report for one product."""

    if not with_live_offer:
        return ProductOfferStatusResponse(
            product_id=PRODUCT_ID,
            product_name="Gold Marble Centre Table",
            offer_percent=None,
            offer_label=None,
            offer_ends_at=None,
            own_offer_is_live=False,
            memberships=[],
            effective_discount_percent=None,
            has_live_offer=False,
        )

    return ProductOfferStatusResponse(
        product_id=ALREADY_DISCOUNTED_PRODUCT_ID,
        product_name="Marble Console",
        offer_percent=20,
        offer_label="Festive offer",
        offer_ends_at=datetime.now(UTC) + timedelta(days=5),
        own_offer_is_live=True,
        memberships=[
            OfferMembershipResponse(
                section_id=SECTION_ID,
                section_title="Diwali Special Offer",
                section_slug="diwali-special-offer",
                section_is_active=True,
                item_id=ITEM_ID,
                discount_percent=DISCOUNT_PERCENT,
                ends_at=None,
                is_live=True,
            ),
        ],
        effective_discount_percent=DISCOUNT_PERCENT,
        has_live_offer=True,
    )


def build_section(
    *,
    is_active: bool = True,
    with_item: bool = True,
) -> OfferSectionDetailResponse:
    """Create a fake offer section response."""

    current_time = datetime.now(UTC)

    items: list[OfferItemResponse] = []

    if with_item:
        product = OfferProductResponse(
            id=PRODUCT_ID,
            collection_id=COLLECTION_ID,
            name="Gold Marble Centre Table",
            slug="gold-marble-centre-table",
            short_description="A hand-polished marble top on a brass frame.",
            thumbnail_url="https://images.example.com/table.webp",
            top_material="Marble",
            base_material="Brass",
            finish="Hand-polished",
            colour="Gold",
            style="Classic",
            is_active=True,
            is_recommended=False,
            in_stock=True,
            available_quantity=6,
            base_price_paise=BASE_PRICE_PAISE,
            offer_price_paise=apply_discount(BASE_PRICE_PAISE, DISCOUNT_PERCENT),
            discount_percent=DISCOUNT_PERCENT,
            saving_paise=saving_paise(BASE_PRICE_PAISE, DISCOUNT_PERCENT),
        )

        items.append(
            OfferItemResponse(
                id=ITEM_ID,
                section_id=SECTION_ID,
                product_id=PRODUCT_ID,
                discount_percent=DISCOUNT_PERCENT,
                display_order=0,
                product=product,
                created_at=current_time,
                updated_at=current_time,
            )
        )

    return OfferSectionDetailResponse(
        id=SECTION_ID,
        title="Diwali Special Offer",
        slug="diwali-special-offer",
        subtitle="Up to 40% off on marble centrepieces.",
        theme="diwali",
        background_image_url="https://images.example.com/diwali.webp",
        background_color="#2A1206",
        accent_color="#E8B54D",
        text_color="#FFF8EC",
        badge_label="Diwali Special",
        display_order=0,
        is_active=is_active,
        item_count=len(items),
        items=items,
        created_at=current_time,
        updated_at=current_time,
    )


class FakeOfferService:
    """Fake offer service used without a real database."""

    def __init__(self) -> None:
        self.section = build_section()
        self.hidden_section = build_section(is_active=False)

        # Recorded so the tests can assert what the route passed through.
        self.last_duration_days: int | None = None
        self.replaced_for: list[uuid.UUID] = []

    async def list_sections(self, *, active_only: bool):
        """Return visible sections, or everything for the dashboard."""

        if active_only:
            return [self.section]

        return [self.section, self.hidden_section]

    async def get_section_by_slug(self, slug: str):
        if slug != self.section.slug:
            raise ResourceNotFoundError(f"Offer section '{slug}' was not found.")

        return self.section

    async def create_section(self, data):
        if data.slug == self.section.slug:
            raise ResourceConflictError(
                f"An offer section with slug '{data.slug}' already exists."
            )

        return self.section

    async def update_section(self, section_id, data):
        if section_id != SECTION_ID:
            raise ResourceNotFoundError(f"Offer section '{section_id}' was not found.")

        return self.section

    async def delete_section(self, section_id) -> None:
        if section_id != SECTION_ID:
            raise ResourceNotFoundError(f"Offer section '{section_id}' was not found.")

    async def add_item(self, *, section_id, data):
        if section_id != SECTION_ID:
            raise ResourceNotFoundError(f"Offer section '{section_id}' was not found.")

        if data.product_id == PRODUCT_ID:
            raise ResourceConflictError("This product is already in the offer section.")

        # A product discounted elsewhere is refused unless the caller
        # confirms the running offer should be withdrawn.
        if data.product_id == ALREADY_DISCOUNTED_PRODUCT_ID:
            if not data.replace_existing:
                raise ResourceConflictError(
                    "'Marble Console' already has a running offer: its own 20% "
                    "discount. Remove it first, or confirm that it should be "
                    "replaced."
                )

            self.replaced_for.append(data.product_id)

        self.last_duration_days = data.duration_days

        return self.section

    async def get_product_offer_status(self, product_id):
        if product_id == ALREADY_DISCOUNTED_PRODUCT_ID:
            return build_status(with_live_offer=True)

        if product_id == PRODUCT_ID:
            return build_status(with_live_offer=False)

        raise ResourceNotFoundError(f"Product '{product_id}' was not found.")

    async def update_item(self, *, item_id, data):
        if item_id != ITEM_ID:
            raise ResourceNotFoundError(f"Offer entry '{item_id}' was not found.")

        return self.section

    async def remove_item(self, item_id) -> None:
        if item_id != ITEM_ID:
            raise ResourceNotFoundError(f"Offer entry '{item_id}' was not found.")


@pytest.fixture(autouse=True)
def override_offer_service():
    """Swap the real offer service for the fake one."""

    service = FakeOfferService()

    app.dependency_overrides[get_offer_service] = lambda: service

    yield service

    app.dependency_overrides.pop(get_offer_service, None)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestPublicOfferEndpoints:
    """What the storefront sees."""

    def test_list_returns_only_active_sections_by_default(
        self,
        client: TestClient,
    ) -> None:
        """A hidden section must not reach the storefront."""

        response = client.get("/api/v1/offers/sections")

        assert response.status_code == 200

        payload = response.json()

        assert len(payload) == 1
        assert payload[0]["slug"] == "diwali-special-offer"
        assert payload[0]["is_active"] is True

    def test_list_can_include_hidden_sections_for_the_dashboard(
        self,
        client: TestClient,
    ) -> None:
        response = client.get(
            "/api/v1/offers/sections",
            params={"active_only": "false"},
        )

        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_section_exposes_server_calculated_offer_price(
        self,
        client: TestClient,
    ) -> None:
        """The storefront is handed the price, never a percentage to apply."""

        response = client.get("/api/v1/offers/sections")

        product = response.json()[0]["items"][0]["product"]

        assert product["base_price_paise"] == BASE_PRICE_PAISE
        assert product["discount_percent"] == DISCOUNT_PERCENT

        # 30% off Rs 9,999.00 is Rs 6,999.30
        assert product["offer_price_paise"] == 699_930
        assert product["saving_paise"] == BASE_PRICE_PAISE - 699_930

        # The figures must reconstruct the original exactly.
        assert product["offer_price_paise"] + product["saving_paise"] == (
            product["base_price_paise"]
        )

    def test_theme_and_custom_styling_round_trip(
        self,
        client: TestClient,
    ) -> None:
        section = client.get("/api/v1/offers/sections").json()[0]

        assert section["theme"] == "diwali"
        assert section["background_color"] == "#2A1206"
        assert section["accent_color"] == "#E8B54D"
        assert section["badge_label"] == "Diwali Special"

    def test_get_unknown_section_returns_404(self, client: TestClient) -> None:
        response = client.get("/api/v1/offers/sections/no-such-offer")

        assert response.status_code == 404


class TestAdminOfferEndpoints:
    """Managing sections from the dashboard."""

    def test_create_section_returns_201(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/offers/sections",
            json={
                "title": "Holi Special Offer",
                "slug": "holi-special-offer",
                "subtitle": "Bright pieces for a bright season.",
                "theme": "holi",
                "badge_label": "Holi Special",
            },
        )

        assert response.status_code == 201

    def test_duplicate_slug_returns_409(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/offers/sections",
            json={
                "title": "Diwali Again",
                "slug": "diwali-special-offer",
            },
        )

        assert response.status_code == 409

    def test_invalid_slug_is_rejected(self, client: TestClient) -> None:
        """Slugs must be url safe, matching collections and products."""

        response = client.post(
            "/api/v1/offers/sections",
            json={
                "title": "Bad Slug",
                "slug": "Not A Slug!",
            },
        )

        assert response.status_code == 422

    def test_a_custom_theme_name_is_accepted(self, client: TestClient) -> None:
        """Themes are free text, not a fixed list."""

        response = client.post(
            "/api/v1/offers/sections",
            json={
                "title": "Monsoon Clearance",
                "slug": "monsoon-clearance",
                "theme": "Monsoon Clearance 2026",
            },
        )

        assert response.status_code == 201

    def test_theme_is_normalised_to_a_key(self) -> None:
        """Capitalisation and spacing must not create separate themes."""

        from app.models.offer_enums import normalise_theme

        assert normalise_theme("Diwali Special") == "diwali-special"
        assert normalise_theme("  HOLI  ") == "holi"
        assert normalise_theme("New Year!! 2026") == "new-year-2026"

    def test_invalid_hex_colour_is_rejected(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/offers/sections",
            json={
                "title": "Bad Colour",
                "slug": "bad-colour",
                "background_color": "dark-red",
            },
        )

        assert response.status_code == 422

    def test_hiding_a_section_is_a_normal_update(
        self,
        client: TestClient,
    ) -> None:
        response = client.patch(
            f"/api/v1/offers/sections/{SECTION_ID}",
            json={"is_active": False},
        )

        assert response.status_code == 200

    def test_delete_section_returns_204(self, client: TestClient) -> None:
        response = client.delete(f"/api/v1/offers/sections/{SECTION_ID}")

        assert response.status_code == 204

    def test_add_product_to_section_returns_201(
        self,
        client: TestClient,
    ) -> None:
        response = client.post(
            f"/api/v1/offers/sections/{SECTION_ID}/items",
            json={
                "product_id": str(uuid.uuid4()),
                "discount_percent": 40,
            },
        )

        assert response.status_code == 201

    def test_adding_the_same_product_twice_returns_409(
        self,
        client: TestClient,
    ) -> None:
        response = client.post(
            f"/api/v1/offers/sections/{SECTION_ID}/items",
            json={
                "product_id": str(PRODUCT_ID),
                "discount_percent": 40,
            },
        )

        assert response.status_code == 409

    @pytest.mark.parametrize("discount_percent", [0, -5, 91, 100])
    def test_discount_outside_the_allowed_range_is_rejected(
        self,
        client: TestClient,
        discount_percent: int,
    ) -> None:
        """1 to 90 only, so a typo cannot make items free."""

        response = client.post(
            f"/api/v1/offers/sections/{SECTION_ID}/items",
            json={
                "product_id": str(uuid.uuid4()),
                "discount_percent": discount_percent,
            },
        )

        assert response.status_code == 422

    def test_update_item_discount_returns_200(self, client: TestClient) -> None:
        response = client.patch(
            f"/api/v1/offers/items/{ITEM_ID}",
            json={"discount_percent": 45},
        )

        assert response.status_code == 200

    def test_remove_item_returns_204(self, client: TestClient) -> None:
        response = client.delete(f"/api/v1/offers/items/{ITEM_ID}")

        assert response.status_code == 204

    def test_unknown_item_returns_404(self, client: TestClient) -> None:
        response = client.delete(f"/api/v1/offers/items/{uuid.uuid4()}")

        assert response.status_code == 404


class TestOfferExpiryControl:
    """Setting how long an offer runs for."""

    def test_a_duration_in_days_is_accepted(
        self,
        client: TestClient,
        override_offer_service: FakeOfferService,
    ) -> None:
        response = client.post(
            f"/api/v1/offers/sections/{SECTION_ID}/items",
            json={
                "product_id": str(uuid.uuid4()),
                "discount_percent": 40,
                "duration_days": 14,
            },
        )

        assert response.status_code == 201
        assert override_offer_service.last_duration_days == 14

    def test_omitting_the_duration_means_never_expires(
        self,
        client: TestClient,
        override_offer_service: FakeOfferService,
    ) -> None:
        """Which is how every offer behaved before expiry existed."""

        response = client.post(
            f"/api/v1/offers/sections/{SECTION_ID}/items",
            json={
                "product_id": str(uuid.uuid4()),
                "discount_percent": 40,
            },
        )

        assert response.status_code == 201
        assert override_offer_service.last_duration_days is None

    def test_an_explicit_null_duration_means_never_expires(
        self,
        client: TestClient,
        override_offer_service: FakeOfferService,
    ) -> None:
        response = client.post(
            f"/api/v1/offers/sections/{SECTION_ID}/items",
            json={
                "product_id": str(uuid.uuid4()),
                "discount_percent": 40,
                "duration_days": None,
            },
        )

        assert response.status_code == 201
        assert override_offer_service.last_duration_days is None

    @pytest.mark.parametrize("duration_days", [0, -1, 366, 5000])
    def test_an_impossible_duration_is_rejected(
        self,
        client: TestClient,
        duration_days: int,
    ) -> None:
        """Zero days would be born expired; years is a typo."""

        response = client.post(
            f"/api/v1/offers/sections/{SECTION_ID}/items",
            json={
                "product_id": str(uuid.uuid4()),
                "discount_percent": 40,
                "duration_days": duration_days,
            },
        )

        assert response.status_code == 422

    def test_an_entry_reports_its_deadline_and_whether_it_is_live(
        self,
        client: TestClient,
    ) -> None:
        """Sent by the server so the dashboard need not compare clocks."""

        item = client.get("/api/v1/offers/sections").json()[0]["items"][0]

        assert "ends_at" in item
        assert item["is_live"] is True

    @pytest.mark.parametrize("offer_duration_days", [0, -3, 400])
    def test_a_products_own_offer_rejects_an_impossible_duration(
        self,
        client: TestClient,
        offer_duration_days: int,
    ) -> None:
        """Validation runs before the handler, so no service is needed."""

        response = client.patch(
            f"/api/v1/offers/products/{PRODUCT_ID}",
            json={
                "offer_percent": 25,
                "offer_duration_days": offer_duration_days,
            },
        )

        assert response.status_code == 422

    def test_a_products_own_offer_rejects_unknown_fields(
        self,
        client: TestClient,
    ) -> None:
        """`extra="forbid"` stops a misspelled field being ignored."""

        response = client.patch(
            f"/api/v1/offers/products/{PRODUCT_ID}",
            json={
                "offer_percent": 25,
                "offer_expires_in_days": 7,
            },
        )

        assert response.status_code == 422


class TestConflictingOffers:
    """Adding a second offer on top of one that is already running."""

    def test_adding_an_already_discounted_product_returns_409(
        self,
        client: TestClient,
    ) -> None:
        """The administrator is asked to remove the running offer first.

        Two overlapping offers are not wrong exactly, since the larger
        wins, but they leave nobody able to explain why a piece is 40% off
        when it was just set to 25%.
        """

        response = client.post(
            f"/api/v1/offers/sections/{SECTION_ID}/items",
            json={
                "product_id": str(ALREADY_DISCOUNTED_PRODUCT_ID),
                "discount_percent": 25,
            },
        )

        assert response.status_code == 409

        # The message has to name what is already running, otherwise the
        # administrator cannot act on it.
        assert "already has a running offer" in response.json()["detail"]
        assert "20%" in response.json()["detail"]

    def test_confirming_the_replacement_succeeds(
        self,
        client: TestClient,
        override_offer_service: FakeOfferService,
    ) -> None:
        response = client.post(
            f"/api/v1/offers/sections/{SECTION_ID}/items",
            json={
                "product_id": str(ALREADY_DISCOUNTED_PRODUCT_ID),
                "discount_percent": 25,
                "replace_existing": True,
            },
        )

        assert response.status_code == 201
        assert override_offer_service.replaced_for == [
            ALREADY_DISCOUNTED_PRODUCT_ID
        ]

    def test_replacement_is_off_by_default(
        self,
        client: TestClient,
        override_offer_service: FakeOfferService,
    ) -> None:
        """Withdrawing a live offer must be a deliberate act."""

        client.post(
            f"/api/v1/offers/sections/{SECTION_ID}/items",
            json={
                "product_id": str(ALREADY_DISCOUNTED_PRODUCT_ID),
                "discount_percent": 25,
            },
        )

        assert override_offer_service.replaced_for == []


class TestProductOfferStatus:
    """What the product edit page shows about existing offers."""

    def test_status_reports_section_membership(
        self,
        client: TestClient,
    ) -> None:
        response = client.get(
            f"/api/v1/offers/products/{ALREADY_DISCOUNTED_PRODUCT_ID}",
        )

        assert response.status_code == 200

        payload = response.json()

        assert payload["has_live_offer"] is True
        assert payload["own_offer_is_live"] is True
        assert payload["effective_discount_percent"] == DISCOUNT_PERCENT

        assert len(payload["memberships"]) == 1
        assert payload["memberships"][0]["section_title"] == (
            "Diwali Special Offer"
        )

    def test_status_is_empty_for_a_product_with_no_offer(
        self,
        client: TestClient,
    ) -> None:
        response = client.get(f"/api/v1/offers/products/{PRODUCT_ID}")

        payload = response.json()

        assert payload["has_live_offer"] is False
        assert payload["memberships"] == []
        assert payload["effective_discount_percent"] is None

    def test_status_for_an_unknown_product_returns_404(
        self,
        client: TestClient,
    ) -> None:
        response = client.get(f"/api/v1/offers/products/{uuid.uuid4()}")

        assert response.status_code == 404


class TestOfferProductStock:
    """Sold-out pieces inside a promotion."""

    def test_offer_products_report_their_stock(
        self,
        client: TestClient,
    ) -> None:
        """So the offer card can disable buying rather than fail on click."""

        product = client.get("/api/v1/offers/sections").json()[0]["items"][0][
            "product"
        ]

        assert product["in_stock"] is True
        assert product["available_quantity"] == 6

    def test_offer_products_carry_the_material_split(
        self,
        client: TestClient,
    ) -> None:
        product = client.get("/api/v1/offers/sections").json()[0]["items"][0][
            "product"
        ]

        assert product["top_material"] == "Marble"
        assert product["base_material"] == "Brass"
        assert product["finish"] == "Hand-polished"
        assert "material" not in product
