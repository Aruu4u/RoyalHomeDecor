import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.order_enums import OrderStatus, PaymentStatus


if TYPE_CHECKING:
    from app.models.order_item import OrderItem
    from app.models.profile import Profile


class Order(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """Customer order with delivery and payment information."""

    __tablename__ = "orders"

    __table_args__ = (
        CheckConstraint(
            "subtotal_paise >= 0",
            name="subtotal_non_negative",
        ),
        CheckConstraint(
            "shipping_paise >= 0",
            name="shipping_non_negative",
        ),
        CheckConstraint(
            "total_paise >= 0",
            name="total_non_negative",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "profiles.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    status: Mapped[OrderStatus] = mapped_column(
        Enum(
            OrderStatus,
            name="order_status",
            native_enum=False,
        ),
        nullable=False,
        default=OrderStatus.PENDING,
        server_default=OrderStatus.PENDING.value,
        index=True,
    )

    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(
            PaymentStatus,
            name="payment_status",
            native_enum=False,
        ),
        nullable=False,
        default=PaymentStatus.PENDING,
        server_default=PaymentStatus.PENDING.value,
        index=True,
    )

    recipient_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    recipient_phone: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    address_line_1: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    address_line_2: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    landmark: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    city: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    state: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    postal_code: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    country: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="India",
        server_default="India",
    )

    customer_note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    subtotal_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    shipping_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    total_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    razorpay_order_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        unique=True,
    )

    razorpay_payment_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        unique=True,
    )

    profile: Mapped["Profile"] = relationship(
        back_populates="orders",
    )

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="OrderItem.created_at",
    )
