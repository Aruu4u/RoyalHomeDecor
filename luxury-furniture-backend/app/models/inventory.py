from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


if TYPE_CHECKING:
    from app.models.product_variant import ProductVariant


class Inventory(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """Stock information for one product variant."""

    __tablename__ = "inventory"

    __table_args__ = (
        CheckConstraint(
            "quantity_on_hand >= 0",
            name="quantity_on_hand_non_negative",
        ),
        CheckConstraint(
            "reserved_quantity >= 0",
            name="reserved_quantity_non_negative",
        ),
        CheckConstraint(
            "reserved_quantity <= quantity_on_hand",
            name="reserved_not_greater_than_stock",
        ),
        CheckConstraint(
            "low_stock_threshold >= 0",
            name="low_stock_threshold_non_negative",
        ),
    )

    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "product_variants.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
        index=True,
    )

    quantity_on_hand: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    reserved_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    low_stock_threshold: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
        server_default="5",
    )

    variant: Mapped[ProductVariant] = relationship(
        back_populates="inventory",
    )

    @property
    def available_quantity(self) -> int:
        """Return stock that is not reserved for pending orders."""

        return self.quantity_on_hand - self.reserved_quantity
