import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    field_validator,
)


MIN_RATING = 1
MAX_RATING = 5

# A handful of photographs is plenty to show a piece in a room, and a cap
# keeps one submission from filling storage.
MAX_REVIEW_PHOTOS = 6


class ProductReviewCreate(BaseModel):
    """A review submitted from the product page.

    ``author_name`` and ``author_email`` are collected from the form so a
    guest can review without an account. When the request does carry a
    valid token, the signed-in customer is recorded as well.

    ``is_verified_purchase`` is deliberately absent: it is decided by the
    server from the reviewer's order history, so it cannot be claimed.
    """

    model_config = ConfigDict(extra="forbid")

    rating: int = Field(
        ge=MIN_RATING,
        le=MAX_RATING,
        examples=[5],
    )

    author_name: str = Field(
        min_length=2,
        max_length=120,
        examples=["Ananya Iyer"],
    )

    author_email: EmailStr | None = Field(
        default=None,
        examples=["ananya@example.com"],
    )

    title: str | None = Field(
        default=None,
        max_length=150,
        examples=["Exactly as photographed"],
    )

    body: str = Field(
        min_length=10,
        max_length=4000,
        examples=["The marble veining is beautiful and the brass..."],
    )

    photo_urls: list[HttpUrl] = Field(
        default_factory=list,
        max_length=MAX_REVIEW_PHOTOS,
    )

    @field_validator("author_name", "title", "body")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        """Trim surrounding whitespace and reject blank strings."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Value cannot contain only whitespace.")

        return cleaned_value


class ProductReviewResponse(BaseModel):
    """One published review.

    The reviewer's email address is not part of this model. It is held
    only so the shop can follow up privately, and a public review list is
    the last place it should surface.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID

    author_name: str

    rating: int
    title: str | None
    body: str

    photo_urls: list[str]

    is_verified_purchase: bool

    created_at: datetime
    updated_at: datetime


class ProductReviewSummary(BaseModel):
    """Aggregate rating for a product.

    ``breakdown`` always carries all five keys, including zeros, so the
    storefront can draw the distribution without filling in gaps itself.
    """

    review_count: int = 0
    average_rating: float | None = None

    breakdown: dict[int, int] = Field(
        default_factory=lambda: {star: 0 for star in range(1, 6)},
    )


class ProductReviewListResponse(BaseModel):
    """A page of reviews together with the product's overall score."""

    summary: ProductReviewSummary
    reviews: list[ProductReviewResponse]
