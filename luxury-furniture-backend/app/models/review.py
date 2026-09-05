from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


if TYPE_CHECKING:
    from app.models.product import Product


class ProductReview(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """A customer's written review of one product.

    Reviews may be left by a signed-in customer or by a guest. When the
    request carries a valid token, ``user_id`` is filled in and a partial
    unique index stops that customer reviewing the same piece twice.
    """

    __tablename__ = "product_reviews"

    __table_args__ = (
        # Enforced in the database as well as the schema. An average
        # rating computed over out-of-range values would be quietly
        # wrong everywhere it is displayed.
        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="rating_range",
        ),
        # One review per signed-in customer per product. Partial, because
        # user_id is null for guest reviews and an ordinary unique
        # constraint would then allow only one guest review per product.
        #
        # Declared here as well as in the migration so that a future
        # autogenerate does not see it as an unexpected index and drop it.
        Index(
            "uq_product_reviews_product_user",
            "product_id",
            "user_id",
            unique=True,
            postgresql_where=text("user_id IS NOT NULL"),
        ),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "products.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # Null for a guest review. Deliberately not a foreign key to
    # ``profiles``: a review is a permanent record of what was said, and
    # it should survive the reviewer closing their account.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    author_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    # Collected so the shop can follow up on a complaint. Never returned
    # by the API, because a public review list is the last place a
    # customer's email address should appear.
    author_email: Mapped[str | None] = mapped_column(
        String(254),
        nullable=True,
    )

    rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    title: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    body: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Customer photographs of the piece in their home. Stored as a JSON
    # array of public URLs rather than a child table: they are only ever
    # read and written together with the review itself.
    photo_urls: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="'[]'::jsonb",
    )

    # Lets the shop take a review down without deleting the record.
    is_approved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    # Set by the server at submission time by checking the reviewer's
    # delivered orders. Never accepted from the request body, so it
    # cannot be claimed falsely.
    is_verified_purchase: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    product: Mapped[Product] = relationship(
        back_populates="reviews",
    )
