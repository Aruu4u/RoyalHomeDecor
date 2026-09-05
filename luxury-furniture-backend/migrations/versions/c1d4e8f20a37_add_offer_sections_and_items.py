"""add offer sections, offer items and product offer fields

Revision ID: c1d4e8f20a37
Revises: a6321a9b7899
Create Date: 2026-09-01 21:40:00.000000

Purely additive:

  * creates ``offer_sections`` and ``offer_items``
  * adds nullable ``offer_percent`` and ``offer_label`` to ``products``

No existing column is altered or dropped and no data is rewritten, so
running this leaves the current catalogue untouched. Products simply
start with a null offer, which the application reads as "no offer".
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1d4e8f20a37"
down_revision: Union[str, Sequence[str], None] = "a6321a9b7899"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Historical: the theme column was created from this Enum. A later
# revision (d2f7a9c41b58) widens it to free text. Left as-is so this
# migration still reproduces the schema it originally created.
OFFER_THEMES = (
    "diwali",
    "holi",
    "christmas",
    "new_year",
    "summer",
    "monsoon",
    "wedding",
    "clearance",
    "custom",
)


def upgrade() -> None:
    """Upgrade schema."""

    op.create_table(
        "offer_sections",
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column("subtitle", sa.String(length=300), nullable=True),
        sa.Column(
            "theme",
            # native_enum=False stores a VARCHAR plus a check constraint,
            # matching how order_status is handled in this project. It
            # avoids needing a Postgres type migration to add a theme.
            sa.Enum(
                *OFFER_THEMES,
                name="offer_theme",
                native_enum=False,
            ),
            server_default="custom",
            nullable=False,
        ),
        sa.Column("background_image_url", sa.String(length=1000), nullable=True),
        sa.Column("background_color", sa.String(length=9), nullable=True),
        sa.Column("accent_color", sa.String(length=9), nullable=True),
        sa.Column("text_color", sa.String(length=9), nullable=True),
        sa.Column("badge_label", sa.String(length=60), nullable=True),
        sa.Column(
            "display_order",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "display_order >= 0",
            name=op.f("ck_offer_sections_display_order_non_negative"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_offer_sections")),
        sa.UniqueConstraint("slug", name=op.f("uq_offer_sections_slug")),
    )

    op.create_index(
        op.f("ix_offer_sections_slug"),
        "offer_sections",
        ["slug"],
        unique=False,
    )

    op.create_table(
        "offer_items",
        sa.Column("section_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("discount_percent", sa.Integer(), nullable=False),
        sa.Column(
            "display_order",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "discount_percent >= 1 AND discount_percent <= 90",
            name=op.f("ck_offer_items_discount_percent_range"),
        ),
        sa.CheckConstraint(
            "display_order >= 0",
            name=op.f("ck_offer_items_display_order_non_negative"),
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name=op.f("fk_offer_items_product_id_products"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["section_id"],
            ["offer_sections.id"],
            name=op.f("fk_offer_items_section_id_offer_sections"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_offer_items")),
        sa.UniqueConstraint(
            "section_id",
            "product_id",
            name="uq_offer_items_section_product",
        ),
    )

    op.create_index(
        op.f("ix_offer_items_product_id"),
        "offer_items",
        ["product_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_offer_items_section_id"),
        "offer_items",
        ["section_id"],
        unique=False,
    )

    op.add_column(
        "products",
        sa.Column("offer_percent", sa.Integer(), nullable=True),
    )

    op.add_column(
        "products",
        sa.Column("offer_label", sa.String(length=60), nullable=True),
    )

    op.create_check_constraint(
        "offer_percent_range",
        "products",
        "offer_percent IS NULL OR (offer_percent >= 1 AND offer_percent <= 90)",
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_constraint(
        op.f("ck_products_offer_percent_range"),
        "products",
        type_="check",
    )

    op.drop_column("products", "offer_label")
    op.drop_column("products", "offer_percent")

    op.drop_index(op.f("ix_offer_items_section_id"), table_name="offer_items")
    op.drop_index(op.f("ix_offer_items_product_id"), table_name="offer_items")
    op.drop_table("offer_items")

    op.drop_index(op.f("ix_offer_sections_slug"), table_name="offer_sections")
    op.drop_table("offer_sections")
