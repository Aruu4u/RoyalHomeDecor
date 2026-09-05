import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


if TYPE_CHECKING:
    from app.models.order import Order


class OrderItem(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """Permanent product snapshot stored inside an order."""

    __tablename__ = "order_items"

    __table_args__ = (
        CheckConstraint(
            "quantity >= 1",
            name="quantity_positive",
        ),
        CheckConstraint(
            "unit_price_paise >= 0",
            name="unit_price_non_negative",
        ),
        CheckConstraint(
            "line_total_paise >= 0",
            name="line_total_non_negative",
        ),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "orders.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        nullable=False,
        index=True,
    )

    variant_id: Mapped[uuid.UUID] = mapped_column(
        nullable=False,
        index=True,
    )

    product_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    variant_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    sku: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    size_label: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    colour: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    material: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    unit_price_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    line_total_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    order: Mapped["Order"] = relationship(
        back_populates="items",
    )
