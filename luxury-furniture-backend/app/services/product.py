import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.product_variant import ProductVariant
from app.repositories.offer import OfferRepository
from app.repositories.product import ORDER_CURATED, ProductRepository
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
)
from app.services.offer_pricing import (
    apply_discount,
    live_discount_percent,
    offer_end_from_duration,
    resolve_discount_percent,
)


class ProductService:
    """Business logic for catalogue products."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = ProductRepository(session)
        self.offer_repository = OfferRepository(session)

    async def annotate(
        self,
        products: Sequence[Product],
    ) -> None:
        """Fill in every derived field a product response carries.

        Grouped into one method because all three annotations are needed
        by every product endpoint, and forgetting one produced responses
        that validated but were quietly wrong.

        Public so other services returning product data can reuse it: the
        favourites page renders the same cards and needs the same offer
        price and stock flags.
        """

        if not products:
            return

        await self._attach_offer_pricing(products)
        await self._attach_stock(products)
        await self._attach_review_stats(products)

    async def _attach_offer_pricing(
        self,
        products: Sequence[Product],
    ) -> None:
        """Annotate products with the offer that currently applies.

        The effective discount is the better of the product's own offer
        and any live offer section it belongs to. An offer past its end
        date contributes nothing, so an expired promotion stops affecting
        the price everywhere rather than only where it is displayed.

        Results are written to transient attributes rather than mapped
        columns, so nothing here can accidentally be persisted.
        """

        if not products:
            return

        # One query for the whole page rather than one per product. The
        # repository already excludes expired and hidden sections.
        discount_map = await self.offer_repository.get_active_discount_map(
            [product.id for product in products],
        )

        for product in products:
            effective_percent = resolve_discount_percent(
                product_offer_percent=live_discount_percent(
                    product.offer_percent,
                    product.offer_ends_at,
                ),
                section_discount_percent=discount_map.get(product.id),
            )

            product.offer_discount_percent = effective_percent  # type: ignore[attr-defined]

            product.offer_price_paise = (  # type: ignore[attr-defined]
                apply_discount(product.base_price_paise, effective_percent)
                if effective_percent is not None
                else None
            )

    async def _attach_stock(
        self,
        products: Sequence[Product],
    ) -> None:
        """Annotate products with sellable stock across their variants.

        The list endpoint returns no variants, so without this a product
        card cannot tell a sold-out piece from an available one and would
        offer an "Add to cart" button that always fails.
        """

        if not products:
            return

        stock_map = await self.repository.get_available_stock_map(
            [product.id for product in products],
        )

        for product in products:
            available = stock_map.get(product.id, 0)

            product.available_quantity = available  # type: ignore[attr-defined]
            product.in_stock = available > 0  # type: ignore[attr-defined]

    async def _attach_review_stats(
        self,
        products: Sequence[Product],
    ) -> None:
        """Annotate products with their published review count and score."""

        if not products:
            return

        stats_map = await self.repository.get_review_stats_map(
            [product.id for product in products],
        )

        for product in products:
            count, average = stats_map.get(product.id, (0, None))

            product.review_count = count  # type: ignore[attr-defined]
            product.review_average = average  # type: ignore[attr-defined]

    async def create_product(
        self,
        data: ProductCreate,
    ) -> Product:
        """Create a product with images, variants and inventory."""

        collection_exists = await self.repository.collection_exists(
            data.collection_id,
        )

        if not collection_exists:
            raise ResourceNotFoundError(f"Collection '{data.collection_id}' was not found.")

        existing_slug = await self.repository.get_by_slug(
            data.slug,
        )

        if existing_slug is not None:
            raise ResourceConflictError(f"A product with slug '{data.slug}' already exists.")

        existing_name = await self.repository.get_by_name(
            data.name,
        )

        if existing_name is not None:
            raise ResourceConflictError(f"A product named '{data.name}' already exists.")

        submitted_skus = [variant.sku for variant in data.variants]

        existing_skus = await self.repository.find_existing_skus(
            submitted_skus,
        )

        if existing_skus:
            formatted_skus = ", ".join(sorted(existing_skus))

            raise ResourceConflictError(f"These SKUs already exist: {formatted_skus}.")

        product_data = data.model_dump(
            exclude={
                "images",
                "variants",
            },
            mode="json",
        )

        product = Product(
            **product_data,
        )

        images = [
            ProductImage(
                **image_data.model_dump(
                    mode="json",
                )
            )
            for image_data in data.images
        ]

        variants: list[ProductVariant] = []

        for variant_data in data.variants:
            inventory_data = variant_data.inventory

            variant_fields = variant_data.model_dump(
                exclude={
                    "inventory",
                },
                mode="json",
            )

            variant = ProductVariant(
                **variant_fields,
            )

            variant.inventory = Inventory(
                **inventory_data.model_dump(
                    mode="json",
                )
            )

            variants.append(variant)

        try:
            created_product = await self.repository.create(
                product=product,
                images=images,
                variants=variants,
            )

            await self.session.commit()

        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The product conflicts with an existing record."
            ) from exception

        refreshed_product = await self.repository.reload_details(
            created_product.id,
        )

        if refreshed_product is None:
            raise RuntimeError("Product was created but could not be reloaded.")

        await self.annotate([refreshed_product])

        return refreshed_product

    async def list_products(
        self,
        *,
        offset: int,
        limit: int,
        active_only: bool,
        collection_id: uuid.UUID | None,
        top_material: str | None,
        base_material: str | None,
        finish: str | None,
        colour: str | None,
        style: str | None,
        recommended_only: bool,
        in_offer: bool = False,
        order_by: str = ORDER_CURATED,
        search: str | None,
    ) -> Sequence[Product]:
        """Return products matching catalogue filters."""

        products = await self.repository.list(
            offset=offset,
            limit=limit,
            active_only=active_only,
            collection_id=collection_id,
            top_material=top_material,
            base_material=base_material,
            finish=finish,
            colour=colour,
            style=style,
            recommended_only=recommended_only,
            in_offer=in_offer,
            order_by=order_by,
            search=search,
        )

        await self.annotate(products)

        return products

    async def get_product_by_slug(
        self,
        slug: str,
    ) -> Product:
        """Return a detailed product using its URL slug."""

        product = await self.repository.get_by_slug(
            slug,
            include_details=True,
        )

        if product is None:
            raise ResourceNotFoundError(f"Product with slug '{slug}' was not found.")

        await self.annotate([product])

        return product

    async def update_product(
        self,
        product_id: uuid.UUID,
        data: ProductUpdate,
    ) -> Product:
        """Update the supplied main product fields."""

        product = await self.repository.get_by_id(
            product_id,
        )

        if product is None:
            raise ResourceNotFoundError(f"Product '{product_id}' was not found.")

        update_data = data.model_dump(
            exclude_unset=True,
            mode="json",
        )

        # `offer_duration_days` is an instruction, not a column. Popping it
        # here keeps the generic setattr loop below from trying to write a
        # field the model does not have.
        #
        # Three cases, distinguished by whether the caller sent the field
        # at all:
        #
        #   omitted -> leave the existing end date alone
        #   null    -> never expires
        #   N       -> ends N days from now
        offer_ends_at: datetime | None = None
        should_set_offer_end = False

        if "offer_duration_days" in update_data:
            offer_ends_at = offer_end_from_duration(
                update_data.pop("offer_duration_days"),
            )
            should_set_offer_end = True

        # Clearing the discount clears its window too. Leaving a stale end
        # date behind would resurrect the offer the moment a percentage was
        # set again, with a deadline nobody chose.
        if "offer_percent" in update_data and update_data["offer_percent"] is None:
            offer_ends_at = None
            should_set_offer_end = True

        new_collection_id = update_data.get("collection_id")

        if new_collection_id is not None and new_collection_id != product.collection_id:
            collection_exists = await self.repository.collection_exists(
                new_collection_id,
            )

            if not collection_exists:
                raise ResourceNotFoundError(f"Collection '{new_collection_id}' was not found.")

        new_slug = update_data.get("slug")

        if new_slug is not None and new_slug != product.slug:
            existing_slug = await self.repository.get_by_slug(
                new_slug,
            )

            if existing_slug is not None:
                raise ResourceConflictError(f"A product with slug '{new_slug}' already exists.")

        new_name = update_data.get("name")

        if new_name is not None and new_name.lower() != product.name.lower():
            existing_name = await self.repository.get_by_name(
                new_name,
            )

            if existing_name is not None:
                raise ResourceConflictError(f"A product named '{new_name}' already exists.")

        for field_name, field_value in update_data.items():
            setattr(
                product,
                field_name,
                field_value,
            )

        if should_set_offer_end:
            product.offer_ends_at = offer_ends_at

        try:
            await self.session.commit()
            await self.session.refresh(product)

        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The updated product conflicts with an existing record."
            ) from exception

        updated_product = await self.repository.reload_details(
            product.id,
        )

        if updated_product is None:
            raise RuntimeError("Product was updated but could not be reloaded.")

        await self.annotate([updated_product])

        return updated_product

    async def delete_product(
        self,
        product_id: uuid.UUID,
    ) -> None:
        """Permanently delete a product and nested records."""

        product = await self.repository.get_by_id(
            product_id,
        )

        if product is None:
            raise ResourceNotFoundError(f"Product '{product_id}' was not found.")

        await self.repository.delete(product)

        await self.session.commit()
