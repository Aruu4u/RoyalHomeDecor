from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


if TYPE_CHECKING:
    from app.models.collection import Collection
    from app.models.product_image import ProductImage
    from app.models.product_variant import ProductVariant
    from app.models.favourite import Favourite
    from app.models.offer import OfferItem
    from app.models.review import ProductReview


class Product(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """A furniture or decor product available in the catalogue."""

    __tablename__ = "products"

    __table_args__ = (
        CheckConstraint(
            "base_price_paise >= 0",
            name="base_price_non_negative",
        ),
        CheckConstraint(
            "offer_percent IS NULL "
            "OR (offer_percent >= 1 AND offer_percent <= 90)",
            name="offer_percent_range",
        ),
    )

    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "collections.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    slug: Mapped[str] = mapped_column(
        String(220),
        nullable=False,
        unique=True,
        index=True,
    )

    short_description: Mapped[str] = mapped_column(
        String(400),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    base_price_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Furniture is rarely made of one thing: a marble top on a brass
    # base, for example. Three separate columns let a shopper filter on
    # the surface they touch, the frame that carries it, and the finish
    # applied over both.
    top_material: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )

    base_material: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )

    finish: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )

    colour: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
        index=True,
    )

    style: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    thumbnail_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    is_recommended: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    # Standalone discount, independent of any offer section. When a
    # product is also in an active section, the larger of the two
    # percentages wins so the customer always gets the better deal.
    offer_percent: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    offer_label: Mapped[str | None] = mapped_column(
        String(60),
        nullable=True,
    )

    # When the standalone offer stops. NULL means it never expires, which
    # is also what an offer created before this column existed reads as.
    offer_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    collection: Mapped[Collection] = relationship(
        back_populates="products",
    )

    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ProductImage.display_order",
    )

    variants: Mapped[list[ProductVariant]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    favourites: Mapped[list["Favourite"]] = relationship(
        back_populates="product",
        passive_deletes=True,
    )

    offer_items: Mapped[list["OfferItem"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    reviews: Mapped[list["ProductReview"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ProductReview.created_at.desc()",
    )
