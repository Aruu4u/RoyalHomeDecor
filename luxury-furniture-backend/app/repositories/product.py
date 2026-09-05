import uuid
from collections.abc import Sequence

from sqlalchemy import ColumnElement, Select, Subquery, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import Inventory
from app.models.offer import OfferItem, OfferSection
from app.models.order import Order
from app.models.order_enums import OrderStatus
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.product_variant import ProductVariant
from app.models.review import ProductReview
from app.repositories.offer import offer_item_is_live


# Ordering modes accepted by ``list``. "curated" is the historical
# default: recommended pieces first, then newest.
ORDER_CURATED = "curated"
ORDER_MOST_SOLD = "most_sold"

ALLOWED_ORDER_BY = (ORDER_CURATED, ORDER_MOST_SOLD)

# An order in one of these states never happened as far as sales figures
# are concerned, so its lines must not inflate a "most sold" ranking.
NON_SALE_ORDER_STATUSES = (OrderStatus.CANCELLED,)


class ProductRepository:
    """Database operations for products and their nested records."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # Why: The repository receives the requestâ€™s database session so all operations can be part of one transaction.

    @staticmethod
    def detail_query() -> Select[tuple[Product]]:
        """Create a query that loads complete product relationships."""

        return select(Product).options(
            selectinload(Product.images),
            selectinload(Product.variants).selectinload(ProductVariant.inventory),
        )

    # Without eager loading, accessing:

    # product.images
    # product.variants
    # variant.inventory

    # could trigger additional database queries later.

    async def create(
        self,
        *,
        product: Product,
        images: list[ProductImage],
        variants: list[ProductVariant],
    ) -> Product:
        """Add a product and all nested records to the transaction."""

        product.images.extend(images)
        product.variants.extend(variants)

        self.session.add(product)

        await self.session.flush()

        self.session.expire(
            product,
            attribute_names=[
                "images",
                "variants",
            ],
        )

        created_product = await self.get_by_id(
            product.id,
            include_details=True,
        )

        if created_product is None:
            raise RuntimeError("Product could not be reloaded after creation.")

        return created_product

    async def get_by_id(
        self,
        product_id: uuid.UUID,
        *,
        include_details: bool = False,
    ) -> Product | None:
        """Find a product using its UUID."""

        if include_details:
            query = self.detail_query().where(
                Product.id == product_id,
            )
        else:
            query = select(Product).where(
                Product.id == product_id,
            )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def get_by_slug(
        self,
        slug: str,
        *,
        include_details: bool = False,
    ) -> Product | None:
        """Find a product using its URL slug."""

        if include_details:
            query = self.detail_query().where(
                Product.slug == slug,
            )
        else:
            query = select(Product).where(
                Product.slug == slug,
            )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def get_by_name(
        self,
        name: str,
    ) -> Product | None:
        """Find a product using a case-insensitive name."""

        query = select(Product).where(
            func.lower(Product.name) == name.lower(),
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def collection_exists(
        self,
        collection_id: uuid.UUID,
    ) -> bool:
        """Check whether the selected collection exists."""

        from app.models.collection import Collection

        query = select(select(Collection.id).where(Collection.id == collection_id).exists())

        result = await self.session.execute(query)

        return bool(result.scalar())

    async def find_existing_skus(
        self,
        skus: Sequence[str],
    ) -> set[str]:
        """Return supplied SKUs that already exist in PostgreSQL."""

        if not skus:
            return set()

        normalized_skus = {sku.upper() for sku in skus}

        query = select(ProductVariant.sku).where(
            ProductVariant.sku.in_(normalized_skus),
        )

        result = await self.session.execute(query)

        return set(result.scalars().all())

    @staticmethod
    def units_sold_subquery() -> Subquery:
        """Units sold per product, taken from real order lines.

        Cancelled orders are excluded, so the ranking reflects sales that
        actually stood rather than every basket that was ever submitted.
        ``order_items`` stores a permanent snapshot of the product, which
        is why this counts lines rather than joining back to the
        catalogue.
        """

        return (
            select(
                OrderItem.product_id.label("product_id"),
                func.sum(OrderItem.quantity).label("units_sold"),
            )
            .join(
                Order,
                Order.id == OrderItem.order_id,
            )
            .where(
                Order.status.not_in(NON_SALE_ORDER_STATUSES),
            )
            .group_by(OrderItem.product_id)
            .subquery()
        )

    @staticmethod
    def product_has_live_offer() -> ColumnElement[bool]:
        """SQL for "this product is discounted right now".

        A product can be on offer two ways, so both are checked: its own
        ``offer_percent``, or membership of a visible offer section. Either
        source must still be inside its window.
        """

        own_offer = and_(
            Product.offer_percent.is_not(None),
            or_(
                Product.offer_ends_at.is_(None),
                Product.offer_ends_at > func.now(),
            ),
        )

        section_offer = (
            select(OfferItem.id)
            .join(
                OfferSection,
                OfferSection.id == OfferItem.section_id,
            )
            .where(
                OfferItem.product_id == Product.id,
                OfferSection.is_active.is_(True),
                offer_item_is_live(),
            )
            .exists()
        )

        return or_(own_offer, section_offer)

    async def list(
        self,
        *,
        offset: int,
        limit: int,
        active_only: bool,
        collection_id: uuid.UUID | None = None,
        top_material: str | None = None,
        base_material: str | None = None,
        finish: str | None = None,
        colour: str | None = None,
        style: str | None = None,
        recommended_only: bool = False,
        in_offer: bool = False,
        order_by: str = ORDER_CURATED,
        search: str | None = None,
    ) -> Sequence[Product]:
        """Return filtered products for cards and search results."""

        query = select(Product)

        if active_only:
            query = query.where(
                Product.is_active.is_(True),
            )

        if collection_id is not None:
            query = query.where(
                Product.collection_id == collection_id,
            )

        if top_material is not None:
            query = query.where(
                func.lower(Product.top_material) == top_material.lower(),
            )

        if base_material is not None:
            query = query.where(
                func.lower(Product.base_material) == base_material.lower(),
            )

        if finish is not None:
            query = query.where(
                func.lower(Product.finish) == finish.lower(),
            )

        if colour is not None:
            query = query.where(
                func.lower(Product.colour) == colour.lower(),
            )

        if style is not None:
            query = query.where(
                func.lower(Product.style) == style.lower(),
            )

        if recommended_only:
            query = query.where(
                Product.is_recommended.is_(True),
            )

        if in_offer:
            query = query.where(self.product_has_live_offer())

        if search:
            cleaned_search = search.strip()

            if cleaned_search:
                search_pattern = f"%{cleaned_search}%"

                query = query.where(
                    or_(
                        Product.name.ilike(search_pattern),
                        Product.short_description.ilike(search_pattern),
                        Product.top_material.ilike(search_pattern),
                        Product.base_material.ilike(search_pattern),
                        Product.finish.ilike(search_pattern),
                        Product.colour.ilike(search_pattern),
                        Product.style.ilike(search_pattern),
                    )
                )

        if order_by == ORDER_MOST_SOLD:
            sales = self.units_sold_subquery()

            # An outer join keeps products that have never sold, so the
            # rail still fills up on a new catalogue instead of coming
            # back nearly empty.
            query = query.outerjoin(
                sales,
                sales.c.product_id == Product.id,
            ).order_by(
                func.coalesce(sales.c.units_sold, 0).desc(),
                Product.is_recommended.desc(),
                Product.created_at.desc(),
            )
        else:
            query = query.order_by(
                Product.is_recommended.desc(),
                Product.created_at.desc(),
            )

        query = query.offset(offset).limit(limit)

        result = await self.session.execute(query)

        return result.scalars().all()

    async def get_available_stock_map(
        self,
        product_ids: Sequence[uuid.UUID],
    ) -> dict[uuid.UUID, int]:
        """Return sellable stock per product, summed across its variants.

        Only active variants count: an inactive variant cannot be bought,
        so its stock must not make an otherwise sold-out product look
        available on a card.

        One grouped query for the whole page rather than one per product.
        """

        if not product_ids:
            return {}

        available = Inventory.quantity_on_hand - Inventory.reserved_quantity

        query = (
            select(
                ProductVariant.product_id,
                func.coalesce(func.sum(available), 0),
            )
            .join(
                Inventory,
                Inventory.variant_id == ProductVariant.id,
            )
            .where(
                ProductVariant.is_active.is_(True),
                ProductVariant.product_id.in_(list(product_ids)),
            )
            .group_by(ProductVariant.product_id)
        )

        result = await self.session.execute(query)

        return {
            product_id: int(quantity) for product_id, quantity in result.all()
        }

    async def get_review_stats_map(
        self,
        product_ids: Sequence[uuid.UUID],
    ) -> dict[uuid.UUID, tuple[int, float]]:
        """Return ``(count, average)`` of approved reviews per product.

        Hidden reviews are excluded from both figures, so taking a review
        down also removes its influence on the score.
        """

        if not product_ids:
            return {}

        query = (
            select(
                ProductReview.product_id,
                func.count(ProductReview.id),
                func.avg(ProductReview.rating),
            )
            .where(
                ProductReview.is_approved.is_(True),
                ProductReview.product_id.in_(list(product_ids)),
            )
            .group_by(ProductReview.product_id)
        )

        result = await self.session.execute(query)

        return {
            product_id: (int(count), round(float(average), 2))
            for product_id, count, average in result.all()
            if average is not None
        }

    async def count(
        self,
        *,
        active_only: bool,
        collection_id: uuid.UUID | None = None,
    ) -> int:
        """Count products matching common catalogue filters."""

        query = select(func.count(Product.id))

        if active_only:
            query = query.where(
                Product.is_active.is_(True),
            )

        if collection_id is not None:
            query = query.where(
                Product.collection_id == collection_id,
            )

        result = await self.session.execute(query)

        return int(result.scalar_one())

    async def reload_details(
        self,
        product_id: uuid.UUID,
    ) -> Product | None:
        """Reload complete product data from PostgreSQL."""

        existing_product = await self.get_by_id(product_id)

        if existing_product is not None:
            self.session.expire(
                existing_product,
                attribute_names=[
                    "images",
                    "variants",
                ],
            )

        return await self.get_by_id(
            product_id,
            include_details=True,
        )

    async def delete(
        self,
        product: Product,
    ) -> None:
        """Mark a product for permanent deletion."""

        await self.session.delete(product)
