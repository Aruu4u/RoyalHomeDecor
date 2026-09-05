import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.cart import Cart

from app.repositories.cart import CartRepository
from app.repositories.offer import OfferRepository
from app.repositories.product_variant import ProductVariantRepository
from app.schemas.cart import (
    CartItemCreate,
    CartItemResponse,
    CartItemUpdate,
    CartResponse,
    CartVariantResponse,
)
from app.services.offer_pricing import (
    apply_discount,
    live_discount_percent,
    resolve_discount_percent,
)


class CartService:
    """Business logic for customer shopping carts."""

    def __init__(
        self,
        session: AsyncSession,
    ) -> None:
        self.session = session
        self.cart_repository = CartRepository(session)
        self.variant_repository = ProductVariantRepository(session)
        self.offer_repository = OfferRepository(session)

    async def get_cart(
        self,
        user_id: uuid.UUID,
    ) -> CartResponse:
        """Return the customer's cart."""

        await self.cart_repository.get_or_create_cart(user_id)

        await self.session.commit()

        loaded_cart = await self.cart_repository.get_cart_by_user_id(user_id)

        if loaded_cart is None:
            raise RuntimeError("Cart could not be loaded.")

        return await self._build_cart_response(loaded_cart)

    async def add_item(
        self,
        *,
        user_id: uuid.UUID,
        data: CartItemCreate,
    ) -> CartResponse:
        """Add a variant to the customer's cart."""

        variant = await self.variant_repository.get_by_id(
            data.variant_id,
            include_inventory=True,
        )

        if variant is None:
            raise ResourceNotFoundError(f"Product variant '{data.variant_id}' was not found.")

        if not variant.is_active:
            raise ResourceConflictError("This product variant is not available.")

        if variant.inventory is None:
            raise ResourceConflictError("Inventory is not available for this variant.")

        cart = await self.cart_repository.get_or_create_cart(user_id)

        existing_item = await self.cart_repository.get_item_by_variant(
            cart_id=cart.id,
            variant_id=data.variant_id,
        )

        new_quantity = data.quantity

        if existing_item is not None:
            new_quantity += existing_item.quantity

        self._validate_stock(
            requested_quantity=new_quantity,
            available_quantity=variant.inventory.available_quantity,
        )

        if existing_item is None:
            await self.cart_repository.add_item(
                cart_id=cart.id,
                variant_id=data.variant_id,
                quantity=data.quantity,
            )
        else:
            await self.cart_repository.update_item_quantity(
                item=existing_item,
                quantity=new_quantity,
            )

        await self.session.commit()

        return await self.get_cart(user_id)

    async def update_item(
        self,
        *,
        user_id: uuid.UUID,
        item_id: uuid.UUID,
        data: CartItemUpdate,
    ) -> CartResponse:
        """Change the quantity of an existing cart item."""

        cart = await self.cart_repository.get_cart_by_user_id(user_id)

        if cart is None:
            raise ResourceNotFoundError(f"Cart item '{item_id}' was not found.")

        item = await self.cart_repository.get_cart_item(
            cart_id=cart.id,
            item_id=item_id,
        )

        if item is None:
            raise ResourceNotFoundError(f"Cart item '{item_id}' was not found.")

        variant = item.variant

        if not variant.is_active:
            raise ResourceConflictError("This product variant is not available.")

        if variant.inventory is None:
            raise ResourceConflictError("Inventory is not available for this variant.")

        self._validate_stock(
            requested_quantity=data.quantity,
            available_quantity=variant.inventory.available_quantity,
        )

        await self.cart_repository.update_item_quantity(
            item=item,
            quantity=data.quantity,
        )

        await self.session.commit()

        return await self.get_cart(user_id)

    async def delete_item(
        self,
        *,
        user_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> None:
        """Remove one item from the customer's cart."""

        cart = await self.cart_repository.get_cart_by_user_id(user_id)

        if cart is None:
            raise ResourceNotFoundError(f"Cart item '{item_id}' was not found.")

        item = await self.cart_repository.get_cart_item(
            cart_id=cart.id,
            item_id=item_id,
        )

        if item is None:
            raise ResourceNotFoundError(f"Cart item '{item_id}' was not found.")

        await self.cart_repository.delete_item(item)
        await self.session.commit()

    async def clear_cart(
        self,
        user_id: uuid.UUID,
    ) -> None:
        """Remove every item from the customer's cart."""

        cart = await self.cart_repository.get_cart_by_user_id(user_id)

        if cart is None:
            return

        await self.cart_repository.clear_cart(cart.id)
        await self.session.commit()

    @staticmethod
    def _validate_stock(
        *,
        requested_quantity: int,
        available_quantity: int,
    ) -> None:
        """Ensure the requested quantity is available."""

        if requested_quantity > available_quantity:
            raise ResourceConflictError("The requested quantity exceeds available stock.")

    async def resolve_cart_discounts(
        self,
        cart: Cart,
    ) -> dict[uuid.UUID, int | None]:
        """Return the effective discount for each variant in the cart.

        Keyed by variant id. Offers are defined per product, so every
        variant of a discounted product inherits the same percentage.
        """

        product_ids = [item.variant.product_id for item in cart.items]

        section_discounts = await self.offer_repository.get_active_discount_map(
            product_ids,
        )

        discounts: dict[uuid.UUID, int | None] = {}

        for item in cart.items:
            product = item.variant.product

            discounts[item.variant_id] = resolve_discount_percent(
                # An expired offer must stop reducing the amount charged,
                # not merely stop being advertised. The repository already
                # filters expired section entries; this does the same for
                # the product's own offer.
                product_offer_percent=(
                    live_discount_percent(
                        product.offer_percent,
                        product.offer_ends_at,
                    )
                    if product is not None
                    else None
                ),
                section_discount_percent=section_discounts.get(
                    item.variant.product_id,
                ),
            )

        return discounts

    async def _build_cart_response(
        self,
        cart: Cart,
    ) -> CartResponse:
        """Convert an ORM cart into an API response.

        Line totals use the discounted price, so the subtotal here is the
        amount that will actually be charged. Showing an offer price and
        then charging full price would be both a bug and a misleading
        price claim.
        """

        discounts = await self.resolve_cart_discounts(cart)

        items: list[CartItemResponse] = []

        subtotal_paise = 0
        list_subtotal_paise = 0
        total_quantity = 0

        for item in cart.items:
            discount_percent = discounts.get(item.variant_id)

            list_unit_price_paise = item.variant.price_paise

            unit_price_paise = apply_discount(
                list_unit_price_paise,
                discount_percent,
            )

            line_total_paise = item.quantity * unit_price_paise

            subtotal_paise += line_total_paise
            list_subtotal_paise += item.quantity * list_unit_price_paise
            total_quantity += item.quantity

            items.append(
                CartItemResponse(
                    id=item.id,
                    cart_id=item.cart_id,
                    variant_id=item.variant_id,
                    quantity=item.quantity,
                    variant=CartVariantResponse.model_validate(item.variant),
                    list_unit_price_paise=list_unit_price_paise,
                    unit_price_paise=unit_price_paise,
                    discount_percent=discount_percent,
                    line_total_paise=line_total_paise,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

        return CartResponse(
            id=cart.id,
            user_id=cart.user_id,
            items=items,
            subtotal_paise=subtotal_paise,
            list_subtotal_paise=list_subtotal_paise,
            total_saving_paise=list_subtotal_paise - subtotal_paise,
            total_quantity=total_quantity,
            created_at=cart.created_at,
            updated_at=cart.updated_at,
        )
