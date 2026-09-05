import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
)

from app.models.offer_enums import (
    DEFAULT_OFFER_THEME,
    MAX_THEME_LENGTH,
    normalise_theme,
)
from app.services.offer_pricing import (
    MAX_DISCOUNT_PERCENT,
    MAX_OFFER_DURATION_DAYS,
    MIN_DISCOUNT_PERCENT,
)


HEX_COLOUR_PATTERN = r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$"

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class OfferSectionBase(BaseModel):
    """Fields shared by offer section creation and responses."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(
        min_length=2,
        max_length=120,
        examples=["Diwali Special Offer"],
    )

    slug: str = Field(
        min_length=2,
        max_length=140,
        pattern=SLUG_PATTERN,
        examples=["diwali-special-offer"],
    )

    subtitle: str | None = Field(
        default=None,
        max_length=300,
        examples=["Up to 40% off on marble centrepieces."],
    )

    # Free text. Anything the storefront does not have a preset for uses
    # the colours supplied below, which is what "custom" relies on.
    theme: str = Field(
        default=DEFAULT_OFFER_THEME,
        min_length=1,
        max_length=MAX_THEME_LENGTH,
        examples=["diwali", "monsoon-clearance"],
    )

    background_image_url: HttpUrl | None = None

    background_color: str | None = Field(
        default=None,
        pattern=HEX_COLOUR_PATTERN,
        examples=["#2A1206"],
    )

    accent_color: str | None = Field(
        default=None,
        pattern=HEX_COLOUR_PATTERN,
        examples=["#E8B54D"],
    )

    text_color: str | None = Field(
        default=None,
        pattern=HEX_COLOUR_PATTERN,
        examples=["#FFF8EC"],
    )

    badge_label: str | None = Field(
        default=None,
        max_length=60,
        examples=["Diwali Special"],
    )

    display_order: int = Field(
        default=0,
        ge=0,
    )

    is_active: bool = True

    @field_validator("title", "subtitle", "badge_label")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        """Trim surrounding whitespace and reject blank strings."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Value cannot contain only whitespace.")

        return cleaned_value

    @field_validator("theme")
    @classmethod
    def clean_theme(cls, value: str) -> str:
        """Store themes as a stable lowercase key."""

        normalised = normalise_theme(value)

        if not normalised:
            raise ValueError("Theme must contain at least one letter or digit.")

        return normalised


class OfferSectionCreate(OfferSectionBase):
    """Data accepted when creating an offer section."""


class OfferSectionUpdate(BaseModel):
    """Fields accepted when partially updating an offer section."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=2, max_length=120)

    slug: str | None = Field(
        default=None,
        min_length=2,
        max_length=140,
        pattern=SLUG_PATTERN,
    )

    subtitle: str | None = Field(default=None, max_length=300)

    theme: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_THEME_LENGTH,
    )

    background_image_url: HttpUrl | None = None

    background_color: str | None = Field(
        default=None,
        pattern=HEX_COLOUR_PATTERN,
    )

    accent_color: str | None = Field(
        default=None,
        pattern=HEX_COLOUR_PATTERN,
    )

    text_color: str | None = Field(
        default=None,
        pattern=HEX_COLOUR_PATTERN,
    )

    badge_label: str | None = Field(default=None, max_length=60)

    display_order: int | None = Field(default=None, ge=0)

    is_active: bool | None = None


class OfferItemCreate(BaseModel):
    """Data accepted when adding a product to an offer section."""

    model_config = ConfigDict(extra="forbid")

    product_id: uuid.UUID

    discount_percent: int = Field(
        ge=MIN_DISCOUNT_PERCENT,
        le=MAX_DISCOUNT_PERCENT,
        examples=[30],
    )

    # How long this entry discounts the product for, counted from now.
    # Null means it never expires. The server converts it to an absolute
    # timestamp so the deadline does not depend on the client's clock.
    duration_days: int | None = Field(
        default=None,
        ge=1,
        le=MAX_OFFER_DURATION_DAYS,
        examples=[14],
    )

    display_order: int = Field(
        default=0,
        ge=0,
    )

    # A product can only sensibly have one running offer, so adding one
    # that already has another is refused with a 409 unless the caller
    # confirms it wants the existing offer withdrawn. That turns a silent
    # overwrite into a decision the administrator makes on purpose.
    replace_existing: bool = False


class OfferItemUpdate(BaseModel):
    """Fields accepted when updating a product's offer entry."""

    model_config = ConfigDict(extra="forbid")

    discount_percent: int | None = Field(
        default=None,
        ge=MIN_DISCOUNT_PERCENT,
        le=MAX_DISCOUNT_PERCENT,
    )

    # Same three meanings as on creation, with "omitted" leaving the
    # existing end date untouched:
    #
    #   omitted -> no change
    #   null    -> never expires
    #   N       -> ends N days from now
    duration_days: int | None = Field(
        default=None,
        ge=1,
        le=MAX_OFFER_DURATION_DAYS,
    )

    display_order: int | None = Field(default=None, ge=0)


class OfferProductResponse(BaseModel):
    """Product summary shown inside an offer section.

    ``offer_price_paise`` is calculated on the server so the storefront
    never derives money itself.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    collection_id: uuid.UUID

    name: str
    slug: str
    short_description: str

    thumbnail_url: str | None

    top_material: str | None
    base_material: str | None
    finish: str | None

    colour: str | None
    style: str | None

    is_active: bool
    is_recommended: bool

    # Sold-out pieces still appear in the dashboard, so the card needs to
    # be able to say so and disable buying.
    in_stock: bool = True
    available_quantity: int = 0

    # Original price, before the offer.
    base_price_paise: int

    # What the customer pays while the offer is live.
    offer_price_paise: int

    discount_percent: int
    saving_paise: int


class OfferItemResponse(BaseModel):
    """One product inside an offer section."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section_id: uuid.UUID
    product_id: uuid.UUID

    discount_percent: int

    # Null means this entry never expires.
    ends_at: datetime | None = None

    # Whether the entry is inside its window right now. Sent so the
    # dashboard can mark an expired entry without repeating the date
    # comparison, and getting a different answer from a clock skew.
    is_live: bool = True

    display_order: int

    product: OfferProductResponse

    created_at: datetime
    updated_at: datetime


class OfferSectionResponse(OfferSectionBase):
    """An offer section without its products."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID

    item_count: int = 0

    created_at: datetime
    updated_at: datetime


class OfferSectionDetailResponse(OfferSectionResponse):
    """An offer section including every product in it."""

    items: list[OfferItemResponse]


class ProductOfferUpdate(BaseModel):
    """Sets or clears the standalone offer on a single product.

    Send ``offer_percent: null`` to remove the offer, which clears the
    label and the end date with it.
    """

    model_config = ConfigDict(extra="forbid")

    offer_percent: int | None = Field(
        default=None,
        ge=MIN_DISCOUNT_PERCENT,
        le=MAX_DISCOUNT_PERCENT,
    )

    offer_label: str | None = Field(
        default=None,
        max_length=60,
    )

    # Null means the offer never expires; a number ends it that many days
    # from now.
    offer_duration_days: int | None = Field(
        default=None,
        ge=1,
        le=MAX_OFFER_DURATION_DAYS,
    )


class OfferMembershipResponse(BaseModel):
    """One offer section a product currently belongs to."""

    section_id: uuid.UUID
    section_title: str
    section_slug: str
    section_is_active: bool

    item_id: uuid.UUID

    discount_percent: int
    ends_at: datetime | None
    is_live: bool


class ProductOfferStatusResponse(BaseModel):
    """Everything currently discounting one product.

    Answers two questions the dashboard needs: which offers already exist
    before a second one is added, and which of them is actually in force.
    """

    product_id: uuid.UUID
    product_name: str

    offer_percent: int | None
    offer_label: str | None
    offer_ends_at: datetime | None

    own_offer_is_live: bool

    memberships: list[OfferMembershipResponse]

    # The discount a customer would receive right now, which is the
    # largest live one from any source.
    effective_discount_percent: int | None

    has_live_offer: bool
