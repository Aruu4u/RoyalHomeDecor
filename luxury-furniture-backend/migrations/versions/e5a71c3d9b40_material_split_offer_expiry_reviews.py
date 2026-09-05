"""split product material, add offer expiry and product reviews

Revision ID: e5a71c3d9b40
Revises: d2f7a9c41b58
Create Date: 2026-09-02 10:00:00.000000

Three related changes, none of which discard data:

  * ``products.material`` is *renamed* to ``products.top_material`` and
    joined by new nullable ``base_material`` and ``finish`` columns. A
    rename keeps every existing value and the column's index, unlike
    dropping and re-adding, so nothing in the catalogue is lost. The
    index is renamed alongside the column so its name still describes
    what it covers.

  * Offer expiry. ``products.offer_ends_at`` and ``offer_items.ends_at``
    are nullable timestamps where **NULL means the offer never expires**.
    Null is the correct default because every offer that already exists
    was created without an end date, so the additive migration leaves
    those offers running exactly as they are.

  * ``product_reviews`` is a new table. ``rating`` is constrained to
    1â€“5 in the database as well as the API, because a rating outside
    that range would silently corrupt every average computed from it.

The partial unique index on ``(product_id, user_id)`` stops a signed-in
customer reviewing the same piece twice. It is partial because
``user_id`` is null for guest reviews, and a plain unique constraint
would then only ever permit one guest review per product.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e5a71c3d9b40"
down_revision: Union[str, Sequence[str], None] = "d2f7a9c41b58"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ---------- products: material split ----------

    op.alter_column(
        "products",
        "material",
        new_column_name="top_material",
        existing_type=sa.String(length=120),
        existing_nullable=True,
    )

    # Postgres keeps the old index name after a column rename, so it is
    # renamed explicitly rather than left describing a column that no
    # longer exists.
    op.execute(
        "ALTER INDEX ix_products_material RENAME TO ix_products_top_material",
    )

    op.add_column(
        "products",
        sa.Column("base_material", sa.String(length=120), nullable=True),
    )

    op.add_column(
        "products",
        sa.Column("finish", sa.String(length=120), nullable=True),
    )

    op.create_index(
        op.f("ix_products_base_material"),
        "products",
        ["base_material"],
        unique=False,
    )

    op.create_index(
        op.f("ix_products_finish"),
        "products",
        ["finish"],
        unique=False,
    )

    # ---------- Offer expiry ----------

    op.add_column(
        "products",
        sa.Column(
            "offer_ends_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "offer_items",
        sa.Column(
            "ends_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # ---------- product_reviews ----------

    op.create_table(
        "product_reviews",
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("author_name", sa.String(length=120), nullable=False),
        sa.Column("author_email", sa.String(length=254), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "photo_urls",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "is_approved",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
        sa.Column(
            "is_verified_purchase",
            sa.Boolean(),
            server_default="false",
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
            "rating >= 1 AND rating <= 5",
            name=op.f("ck_product_reviews_rating_range"),
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name=op.f("fk_product_reviews_product_id_products"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_product_reviews")),
    )

    op.create_index(
        op.f("ix_product_reviews_product_id"),
        "product_reviews",
        ["product_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_product_reviews_user_id"),
        "product_reviews",
        ["user_id"],
        unique=False,
    )

    op.create_index(
        "uq_product_reviews_product_user",
        "product_reviews",
        ["product_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(
        "uq_product_reviews_product_user",
        table_name="product_reviews",
    )

    op.drop_index(
        op.f("ix_product_reviews_user_id"),
        table_name="product_reviews",
    )

    op.drop_index(
        op.f("ix_product_reviews_product_id"),
        table_name="product_reviews",
    )

    op.drop_table("product_reviews")

    op.drop_column("offer_items", "ends_at")
    op.drop_column("products", "offer_ends_at")

    op.drop_index(op.f("ix_products_finish"), table_name="products")
    op.drop_index(op.f("ix_products_base_material"), table_name="products")

    op.drop_column("products", "finish")
    op.drop_column("products", "base_material")

    op.execute(
        "ALTER INDEX ix_products_top_material RENAME TO ix_products_material",
    )

    op.alter_column(
        "products",
        "top_material",
        new_column_name="material",
        existing_type=sa.String(length=120),
        existing_nullable=True,
    )
