import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.offer import OfferItem, OfferSection
from app.models.product import Product
from app.repositories.offer import OfferRepository
from app.repositories.product import ProductRepository
from app.schemas.offer import (
    OfferItemCreate,
    OfferItemResponse,
    OfferItemUpdate,
    OfferMembershipResponse,
    OfferProductResponse,
    OfferSectionCreate,
    OfferSectionDetailResponse,
    OfferSectionUpdate,
    ProductOfferStatusResponse,
    ProductOfferUpdate,
)
from app.services.offer_pricing import (
    apply_discount,
    is_offer_live,
    live_discount_percent,
    offer_end_from_duration,
    resolve_discount_percent,
    saving_paise,
)


class OfferService:
    """Business logic for special offer sections."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = OfferRepository(session)
        self.product_repository = ProductRepository(session)

    # ---------- Sections ----------

    async def create_section(
        self,
        data: OfferSectionCreate,
    ) -> OfferSectionDetailResponse:
        """Create an offer section after checking the slug is free."""

        existing = await self.repository.get_section_by_slug(data.slug)

        if existing is not None:
            raise ResourceConflictError(
                f"An offer section with slug '{data.slug}' already exists."
            )

        section = OfferSection(**data.model_dump(mode="json"))

        try:
            await self.repository.create_section(section)
            await self.session.commit()
        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The offer section conflicts with an existing record."
            ) from exception

        return await self.get_section(section.id)

    async def list_sections(
        self,
        *,
        active_only: bool,
    ) -> list[OfferSectionDetailResponse]:
        """Return offer sections with their discounted products."""

        sections = await self.repository.list_sections(
            active_only=active_only,
            include_items=True,
        )

        # The storefront must not advertise an expired entry, but the
        # dashboard needs to see one in order to change or remove it.
        stock_map = await self._stock_map_for_sections(sections)

        return [
            self._build_section_detail(
                section,
                stock_map=stock_map,
                live_only=active_only,
            )
            for section in sections
        ]

    async def get_section(
        self,
        section_id: uuid.UUID,
    ) -> OfferSectionDetailResponse:
        """Return one offer section by id, including expired entries."""

        section = await self.repository.get_section_by_id(
            section_id,
            include_items=True,
        )

        if section is None:
            raise ResourceNotFoundError(f"Offer section '{section_id}' was not found.")

        stock_map = await self._stock_map_for_sections([section])

        return self._build_section_detail(
            section,
            stock_map=stock_map,
            live_only=False,
        )

    async def get_section_by_slug(
        self,
        slug: str,
    ) -> OfferSectionDetailResponse:
        """Return one offer section by slug, as the storefront sees it."""

        section = await self.repository.get_section_by_slug(
            slug,
            include_items=True,
        )

        if section is None:
            raise ResourceNotFoundError(f"Offer section '{slug}' was not found.")

        stock_map = await self._stock_map_for_sections([section])

        return self._build_section_detail(
            section,
            stock_map=stock_map,
            live_only=True,
        )

    async def update_section(
        self,
        section_id: uuid.UUID,
        data: OfferSectionUpdate,
    ) -> OfferSectionDetailResponse:
        """Update only the supplied fields of an offer section."""

        section = await self.repository.get_section_by_id(section_id)

        if section is None:
            raise ResourceNotFoundError(f"Offer section '{section_id}' was not found.")

        update_data = data.model_dump(exclude_unset=True, mode="json")

        new_slug = update_data.get("slug")

        if new_slug is not None and new_slug != section.slug:
            existing = await self.repository.get_section_by_slug(new_slug)

            if existing is not None:
                raise ResourceConflictError(
                    f"An offer section with slug '{new_slug}' already exists."
                )

        for field_name, field_value in update_data.items():
            setattr(section, field_name, field_value)

        try:
            await self.session.commit()
        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The updated offer section conflicts with an existing record."
            ) from exception

        return await self.get_section(section_id)

    async def delete_section(
        self,
        section_id: uuid.UUID,
    ) -> None:
        """Delete an offer section and its entries.

        The products themselves are untouched; only their membership of
        this section is removed.
        """

        section = await self.repository.get_section_by_id(section_id)

        if section is None:
            raise ResourceNotFoundError(f"Offer section '{section_id}' was not found.")

        await self.repository.delete_section(section)
        await self.session.commit()

    # ---------- Items ----------

    async def add_item(
        self,
        *,
        section_id: uuid.UUID,
        data: OfferItemCreate,
    ) -> OfferSectionDetailResponse:
        """Add an existing product to an offer section.

        A product with an offer already running is refused unless the
        caller sets ``replace_existing``. Two overlapping offers are not
        wrong exactly, since the larger simply wins, but they are almost
        always a mistake: the administrator ends up unable to explain why
        a piece is 40% off when they just set it to 25%.
        """

        section = await self.repository.get_section_by_id(section_id)

        if section is None:
            raise ResourceNotFoundError(f"Offer section '{section_id}' was not found.")

        product = await self.product_repository.get_by_id(data.product_id)

        if product is None:
            raise ResourceNotFoundError(f"Product '{data.product_id}' was not found.")

        existing = await self.repository.get_item_by_product(
            section_id=section_id,
            product_id=data.product_id,
        )

        if existing is not None:
            raise ResourceConflictError(
                "This product is already in the offer section."
            )

        status = await self.get_product_offer_status(data.product_id)

        if status.has_live_offer:
            if not data.replace_existing:
                raise ResourceConflictError(
                    f"'{product.name}' already has a running offer: "
                    f"{self._describe_live_offers(status)}. Remove it first, "
                    "or confirm that it should be replaced."
                )

            await self._withdraw_live_offers(product, status)

        item = OfferItem(
            section_id=section_id,
            product_id=data.product_id,
            discount_percent=data.discount_percent,
            ends_at=offer_end_from_duration(data.duration_days),
            display_order=data.display_order,
        )

        try:
            await self.repository.add_item(item)
            await self.session.commit()
        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The offer entry conflicts with an existing record."
            ) from exception

        return await self.get_section(section_id)

    async def update_item(
        self,
        *,
        item_id: uuid.UUID,
        data: OfferItemUpdate,
    ) -> OfferSectionDetailResponse:
        """Change a product's discount, expiry or position in a section."""

        item = await self.repository.get_item(item_id)

        if item is None:
            raise ResourceNotFoundError(f"Offer entry '{item_id}' was not found.")

        update_data = data.model_dump(exclude_unset=True)

        # A duration is an instruction rather than a column, so it is
        # translated before the generic assignment loop runs. Sending null
        # explicitly means "never expires"; omitting it leaves the current
        # deadline alone.
        if "duration_days" in update_data:
            item.ends_at = offer_end_from_duration(
                update_data.pop("duration_days"),
            )

        for field_name, field_value in update_data.items():
            setattr(item, field_name, field_value)

        await self.session.commit()

        return await self.get_section(item.section_id)

    async def remove_item(
        self,
        item_id: uuid.UUID,
    ) -> None:
        """Remove a product from an offer section."""

        item = await self.repository.get_item(item_id)

        if item is None:
            raise ResourceNotFoundError(f"Offer entry '{item_id}' was not found.")

        await self.repository.delete_item(item)
        await self.session.commit()

    # ---------- Individual product offers ----------

    async def set_product_offer(
        self,
        *,
        product_id: uuid.UUID,
        data: ProductOfferUpdate,
    ) -> Product:
        """Set or clear the standalone offer on one product."""

        product = await self.product_repository.get_by_id(product_id)

        if product is None:
            raise ResourceNotFoundError(f"Product '{product_id}' was not found.")

        product.offer_percent = data.offer_percent

        # Clearing the discount clears its label and its deadline too, so a
        # product cannot keep advertising "Diwali Special" with no discount
        # attached, and a stale end date cannot resurface later.
        if data.offer_percent is None:
            product.offer_label = None
            product.offer_ends_at = None
        else:
            product.offer_label = data.offer_label
            product.offer_ends_at = offer_end_from_duration(
                data.offer_duration_days,
            )

        await self.session.commit()
        await self.session.refresh(product)

        return product

    async def get_product_offer_status(
        self,
        product_id: uuid.UUID,
    ) -> ProductOfferStatusResponse:
        """Return every offer attached to one product.

        Includes hidden sections and expired entries, because the point is
        to show an administrator the full picture before they add another
        offer on top.
        """

        product = await self.product_repository.get_by_id(product_id)

        if product is None:
            raise ResourceNotFoundError(f"Product '{product_id}' was not found.")

        memberships = await self.repository.list_product_memberships([product_id])

        now = datetime.now(UTC)

        membership_responses = [
            OfferMembershipResponse(
                section_id=section.id,
                section_title=section.title,
                section_slug=section.slug,
                section_is_active=section.is_active,
                item_id=item.id,
                discount_percent=item.discount_percent,
                ends_at=item.ends_at,
                # "Live" means a customer is actually getting this
                # discount, so a hidden section counts as not live even
                # when its dates are open.
                is_live=section.is_active and is_offer_live(item.ends_at, now=now),
            )
            for section, item in memberships.get(product_id, [])
        ]

        own_percent = live_discount_percent(
            product.offer_percent,
            product.offer_ends_at,
            now=now,
        )

        best_section_percent = max(
            (
                membership.discount_percent
                for membership in membership_responses
                if membership.is_live
            ),
            default=None,
        )

        effective = resolve_discount_percent(
            product_offer_percent=own_percent,
            section_discount_percent=best_section_percent,
        )

        return ProductOfferStatusResponse(
            product_id=product.id,
            product_name=product.name,
            offer_percent=product.offer_percent,
            offer_label=product.offer_label,
            offer_ends_at=product.offer_ends_at,
            own_offer_is_live=own_percent is not None,
            memberships=membership_responses,
            effective_discount_percent=effective,
            has_live_offer=effective is not None,
        )

    # ---------- Conflict handling ----------

    @staticmethod
    def _describe_live_offers(
        status: ProductOfferStatusResponse,
    ) -> str:
        """Human-readable summary of what is already discounting a product."""

        parts: list[str] = []

        if status.own_offer_is_live and status.offer_percent is not None:
            parts.append(f"its own {status.offer_percent}% discount")

        parts.extend(
            f"{membership.discount_percent}% in '{membership.section_title}'"
            for membership in status.memberships
            if membership.is_live
        )

        return ", ".join(parts) if parts else "an existing offer"

    async def _withdraw_live_offers(
        self,
        product: Product,
        status: ProductOfferStatusResponse,
    ) -> None:
        """Remove whatever is currently discounting a product.

        Section entries are deleted rather than expired, because leaving a
        dead entry behind would make the old promotion reappear in the
        dashboard as a puzzle to solve later.
        """

        if status.own_offer_is_live:
            product.offer_percent = None
            product.offer_label = None
            product.offer_ends_at = None

        for membership in status.memberships:
            if not membership.is_live:
                continue

            item = await self.repository.get_item(membership.item_id)

            if item is not None:
                await self.repository.delete_item(item)

        await self.session.flush()

    # ---------- Response building ----------

    async def _stock_map_for_sections(
        self,
        sections: list[OfferSection] | tuple[OfferSection, ...],
    ) -> dict[uuid.UUID, int]:
        """Sellable stock for every product across the supplied sections.

        One query for the whole payload, so rendering a page of offers does
        not turn into a stock lookup per card.
        """

        product_ids = {
            item.product_id for section in sections for item in section.items
        }

        if not product_ids:
            return {}

        return await self.product_repository.get_available_stock_map(
            list(product_ids),
        )

    @staticmethod
    def _build_product_response(
        product: Product,
        discount_percent: int,
        *,
        available_quantity: int,
    ) -> OfferProductResponse:
        """Convert a product into its offer-section representation."""

        return OfferProductResponse(
            id=product.id,
            collection_id=product.collection_id,
            name=product.name,
            slug=product.slug,
            short_description=product.short_description,
            thumbnail_url=product.thumbnail_url,
            top_material=product.top_material,
            base_material=product.base_material,
            finish=product.finish,
            colour=product.colour,
            style=product.style,
            is_active=product.is_active,
            is_recommended=product.is_recommended,
            in_stock=available_quantity > 0,
            available_quantity=available_quantity,
            base_price_paise=product.base_price_paise,
            offer_price_paise=apply_discount(
                product.base_price_paise,
                discount_percent,
            ),
            discount_percent=discount_percent,
            saving_paise=saving_paise(
                product.base_price_paise,
                discount_percent,
            ),
        )

    def _build_section_detail(
        self,
        section: OfferSection,
        *,
        stock_map: dict[uuid.UUID, int],
        live_only: bool,
    ) -> OfferSectionDetailResponse:
        """Convert an ORM section into an API response.

        ``live_only`` is what separates the storefront from the dashboard:
        the storefront must never advertise an entry whose end date has
        passed, while the dashboard has to show it so an administrator can
        extend or delete it.
        """

        items: list[OfferItemResponse] = []

        now = datetime.now(UTC)

        for item in section.items:
            # Inactive products are skipped so a hidden or deleted piece
            # never appears in a promotion.
            if item.product is None or not item.product.is_active:
                continue

            item_is_live = is_offer_live(item.ends_at, now=now)

            if live_only and not item_is_live:
                continue

            items.append(
                OfferItemResponse(
                    id=item.id,
                    section_id=item.section_id,
                    product_id=item.product_id,
                    discount_percent=item.discount_percent,
                    ends_at=item.ends_at,
                    is_live=item_is_live,
                    display_order=item.display_order,
                    product=self._build_product_response(
                        item.product,
                        item.discount_percent,
                        available_quantity=stock_map.get(item.product_id, 0),
                    ),
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

        return OfferSectionDetailResponse(
            id=section.id,
            title=section.title,
            slug=section.slug,
            subtitle=section.subtitle,
            theme=section.theme,
            background_image_url=section.background_image_url,
            background_color=section.background_color,
            accent_color=section.accent_color,
            text_color=section.text_color,
            badge_label=section.badge_label,
            display_order=section.display_order,
            is_active=section.is_active,
            item_count=len(items),
            items=items,
            created_at=section.created_at,
            updated_at=section.updated_at,
        )
