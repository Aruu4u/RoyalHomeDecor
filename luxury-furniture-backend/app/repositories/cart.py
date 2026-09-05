import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.product_variant import ProductVariant


class CartRepository:
    """Database operations for customer carts."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_cart_by_user_id(
        self,
        user_id: uuid.UUID,
    ) -> Cart | None:
        """Return a customer's cart with populated items."""

        statement = (
            select(Cart)
            .where(Cart.user_id == user_id)
            .options(
                selectinload(Cart.items)
                .selectinload(CartItem.variant)
                .selectinload(ProductVariant.inventory),
                selectinload(Cart.items)
                .selectinload(CartItem.variant)
                .selectinload(ProductVariant.product),
            )
            .execution_options(populate_existing=True)
        )

        result = await self.session.execute(statement)

        return result.scalar_one_or_none()

    async def create_cart(
        self,
        user_id: uuid.UUID,
    ) -> Cart:
        """Create a new empty cart."""

        cart = Cart(user_id=user_id)

        self.session.add(cart)

        await self.session.flush()
        await self.session.refresh(cart)

        return cart

    async def get_or_create_cart(
        self,
        user_id: uuid.UUID,
    ) -> Cart:
        """Return the existing cart or create a new one."""

        cart = await self.get_cart_by_user_id(user_id)

        if cart is not None:
            return cart

        return await self.create_cart(user_id)

    async def get_cart_item(
        self,
        *,
        cart_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> CartItem | None:
        """Return one cart item belonging to a cart."""

        statement = (
            select(CartItem)
            .where(
                CartItem.id == item_id,
                CartItem.cart_id == cart_id,
            )
            .options(selectinload(CartItem.variant).selectinload(ProductVariant.inventory))
        )

        result = await self.session.execute(statement)

        return result.scalar_one_or_none()

    async def get_item_by_variant(
        self,
        *,
        cart_id: uuid.UUID,
        variant_id: uuid.UUID,
    ) -> CartItem | None:
        """Return an existing item for the supplied variant."""

        statement = (
            select(CartItem)
            .where(
                CartItem.cart_id == cart_id,
                CartItem.variant_id == variant_id,
            )
            .options(selectinload(CartItem.variant).selectinload(ProductVariant.inventory))
        )

        result = await self.session.execute(statement)

        return result.scalar_one_or_none()

    async def add_item(
        self,
        *,
        cart_id: uuid.UUID,
        variant_id: uuid.UUID,
        quantity: int,
    ) -> CartItem:
        """Add a new item to a cart."""

        item = CartItem(
            cart_id=cart_id,
            variant_id=variant_id,
            quantity=quantity,
        )

        self.session.add(item)

        await self.session.flush()

        created_item = await self.get_cart_item(
            cart_id=cart_id,
            item_id=item.id,
        )

        if created_item is None:
            raise RuntimeError("Cart item could not be loaded after creation.")

        return created_item

    async def update_item_quantity(
        self,
        *,
        item: CartItem,
        quantity: int,
    ) -> CartItem:
        """Update a cart item's quantity."""

        item.quantity = quantity

        await self.session.flush()

        updated_item = await self.get_cart_item(
            cart_id=item.cart_id,
            item_id=item.id,
        )

        if updated_item is None:
            raise RuntimeError("Cart item could not be loaded after update.")

        return updated_item

    async def delete_item(
        self,
        item: CartItem,
    ) -> None:
        """Delete one cart item."""

        await self.session.delete(item)
        await self.session.flush()

    async def clear_cart(
        self,
        cart_id: uuid.UUID,
    ) -> None:
        """Delete all items from a cart."""

        statement = delete(CartItem).where(CartItem.cart_id == cart_id)

        await self.session.execute(statement)
        await self.session.flush()
