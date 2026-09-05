"""widen offer theme to free text and rename is_featured to is_recommended

Revision ID: d2f7a9c41b58
Revises: c1d4e8f20a37
Create Date: 2026-09-01 22:20:00.000000

Two changes, both non-destructive:

  * ``offer_sections.theme`` was created from an Enum, which produced a
    varchar(9) sized to the longest preset name. Administrators can now
    type their own theme, so it is widened to varchar(40). Widening a
    varchar never truncates existing values.

  * ``products.is_featured`` is renamed to ``products.is_recommended``.
    A rename preserves the column's data and indexes, unlike dropping
    and re-adding, so no product loses its flag.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d2f7a9c41b58"
down_revision: Union[str, Sequence[str], None] = "c1d4e8f20a37"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.alter_column(
        "offer_sections",
        "theme",
        existing_type=sa.VARCHAR(length=9),
        type_=sa.String(length=40),
        existing_nullable=False,
        existing_server_default="custom",
    )

    op.alter_column(
        "products",
        "is_featured",
        new_column_name="is_recommended",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        existing_server_default=sa.text("false"),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.alter_column(
        "products",
        "is_recommended",
        new_column_name="is_featured",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        existing_server_default=sa.text("false"),
    )

    # Any theme longer than the original 9 characters would not fit, so
    # values are trimmed first to keep the downgrade runnable.
    op.execute(
        "UPDATE offer_sections SET theme = LEFT(theme, 9)",
    )

    op.alter_column(
        "offer_sections",
        "theme",
        existing_type=sa.String(length=40),
        type_=sa.VARCHAR(length=9),
        existing_nullable=False,
        existing_server_default="custom",
    )
