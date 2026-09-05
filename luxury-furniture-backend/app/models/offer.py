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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.offer_enums import DEFAULT_OFFER_THEME


if TYPE_CHECKING:
    from app.models.product import Product


class OfferSection(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """A themed promotional section, such as a Diwali sale.

    Rendered on the storefront between the collections rail and the
    rest of the page. Setting ``is_active`` to false hides it entirely
    without deleting the section or its products.
    """

    __tablename__ = "offer_sections"

    __table_args__ = (
        CheckConstraint(
            "display_order >= 0",
            name="display_order_non_negative",
        ),
    )

    title: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    slug: Mapped[str] = mapped_column(
        String(140),
        nullable=False,
        unique=True,
        index=True,
    )

    subtitle: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
    )

    # Free text rather than an enum: administrators name their own
    # occasions. A handful of well-known values have styling presets in
    # the storefront, and anything else falls back to the colours stored
    # on the section, so an unrecognised theme still renders correctly.
    theme: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default=DEFAULT_OFFER_THEME,
        server_default=DEFAULT_OFFER_THEME,
    )

    background_image_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    # Hex colours used when the theme is CUSTOM, or to override a preset.
    background_color: Mapped[str | None] = mapped_column(
        String(9),
        nullable=True,
    )

    accent_color: Mapped[str | None] = mapped_column(
        String(9),
        nullable=True,
    )

    text_color: Mapped[str | None] = mapped_column(
        String(9),
        nullable=True,
    )

    badge_label: Mapped[str | None] = mapped_column(
        String(60),
        nullable=True,
    )

    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    items: Mapped[list[OfferItem]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="OfferItem.display_order",
    )


class OfferItem(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """One existing product placed in an offer section at a discount."""

    __tablename__ = "offer_items"

    __table_args__ = (
        UniqueConstraint(
            "section_id",
            "product_id",
            name="uq_offer_items_section_product",
        ),
        CheckConstraint(
            "discount_percent >= 1 AND discount_percent <= 90",
            name="discount_percent_range",
        ),
        CheckConstraint(
            "display_order >= 0",
            name="display_order_non_negative",
        ),
    )

    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "offer_sections.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
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

    discount_percent: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # When this product's place in the offer stops discounting it. NULL
    # means it never expires.
    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    section: Mapped[OfferSection] = relationship(
        back_populates="items",
    )

    product: Mapped[Product] = relationship(
        back_populates="offer_items",
    )
