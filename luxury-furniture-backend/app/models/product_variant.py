from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


if TYPE_CHECKING:
    from app.models.inventory import Inventory
    from app.models.product import Product
    from app.models.cart_item import CartItem


class ProductVariant(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """A purchasable version of a product."""

    __tablename__ = "product_variants"

    __table_args__ = (
        CheckConstraint(
            "price_paise >= 0",
            name="price_non_negative",
        ),
        CheckConstraint(
            "weight_grams IS NULL OR weight_grams >= 0",
            name="weight_non_negative",
        ),
        CheckConstraint(
            "length_cm IS NULL OR length_cm >= 0",
            name="length_non_negative",
        ),
        CheckConstraint(
            "width_cm IS NULL OR width_cm >= 0",
            name="width_non_negative",
        ),
        CheckConstraint(
            "height_cm IS NULL OR height_cm >= 0",
            name="height_non_negative",
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

    sku: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    size_label: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    colour: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
        index=True,
    )

    material: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )

    price_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    length_cm: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    width_cm: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    height_cm: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    weight_grams: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    product: Mapped[Product] = relationship(
        back_populates="variants",
    )

    inventory: Mapped[Inventory | None] = relationship(
        back_populates="variant",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )

    cart_items: Mapped[list["CartItem"]] = relationship(
        back_populates="variant",
        passive_deletes=True,
    )
