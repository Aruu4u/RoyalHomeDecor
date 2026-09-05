import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.profile import Profile


class Address(TimestampMixin, Base):
    """A saved customer delivery address."""

    __tablename__ = "addresses"

    __table_args__ = (
        Index(
            "ix_addresses_user_id",
            "user_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    label: Mapped[str] = mapped_column(
        String(50),
        default="Home",
        server_default="Home",
    )

    recipient_name: Mapped[str] = mapped_column(
        String(150),
    )

    phone: Mapped[str] = mapped_column(
        String(20),
    )

    address_line_1: Mapped[str] = mapped_column(
        String(250),
    )

    address_line_2: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True,
    )

    landmark: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    city: Mapped[str] = mapped_column(
        String(100),
    )

    state: Mapped[str] = mapped_column(
        String(100),
    )

    postal_code: Mapped[str] = mapped_column(
        String(20),
    )

    country: Mapped[str] = mapped_column(
        String(100),
        default="India",
        server_default="India",
    )

    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
    )

    profile: Mapped["Profile"] = relationship(
        back_populates="addresses",
    )
