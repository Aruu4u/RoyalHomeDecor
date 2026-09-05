import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.profile import Profile


class Favourite(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """One product saved by a customer."""

    __tablename__ = "favourites"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "product_id",
            name="uq_favourites_user_product",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "products.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    profile: Mapped["Profile"] = relationship(
        back_populates="favourites",
    )

    product: Mapped["Product"] = relationship(
        back_populates="favourites",
    )