import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.cart import Cart
    from app.models.product_variant import ProductVariant


class CartItem(TimestampMixin, Base):
    """One product variant stored inside a shopping cart."""

    __tablename__ = "cart_items"

    __table_args__ = (
        UniqueConstraint(
            "cart_id",
            "variant_id",
            name="uq_cart_items_cart_variant",
        ),
        CheckConstraint(
            "quantity >= 1",
            name="ck_cart_items_quantity_positive",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    cart_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "carts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    variant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "product_variants.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    quantity: Mapped[int] = mapped_column(
        nullable=False,
        default=1,
        server_default="1",
    )

    cart: Mapped["Cart"] = relationship(
        back_populates="items",
    )

    variant: Mapped["ProductVariant"] = relationship(
        back_populates="cart_items",
    )
