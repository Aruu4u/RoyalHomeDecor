import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.address import Address
    from app.models.cart import Cart
    from app.models.order import Order
    from app.models.favourite import Favourite


class Profile(TimestampMixin, Base):
    """Customer profile connected to Supabase Auth."""

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
    )

    full_name: Mapped[str] = mapped_column(
        String(150),
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
    )

    addresses: Mapped[list["Address"]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    cart: Mapped["Cart | None"] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    favourites: Mapped[list["Favourite"]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Favourite.created_at",
    )
    orders: Mapped[list["Order"]] = relationship(
        back_populates="profile",
    )
