import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.order import Order
from app.models.order_enums import OrderStatus
from app.repositories.address import AddressRepository
from app.repositories.cart import CartRepository
from app.repositories.order import OrderRepository
from app.services.cart import CartService
from app.services.offer_pricing import apply_discount
from app.schemas.order import (
    AdminOrderStatusUpdate,
    CheckoutCreate,
    OrderResponse,
)


class OrderService:
    """Business logic for checkout and customer orders."""

    def __init__(
        self,
        session: AsyncSession,
    ) -> None:
        self.session = session
        self.address_repository = AddressRepository(session)
        self.cart_repository = CartRepository(session)
        self.order_repository = OrderRepository(session)

        # Reused so checkout resolves offers with exactly the same rules
        # the cart displayed, rather than a second implementation that
        # could drift out of step.
        self.cart_service = CartService(session)

    async def checkout(
        self,
        *,
        user_id: uuid.UUID,
        data: CheckoutCreate,
    ) -> OrderResponse:
        """Create an order from the customer's current cart."""

        address = await self.address_repository.get_by_id_for_user(
            address_id=data.address_id,
            user_id=user_id,
        )

        if address is None:
            raise ResourceNotFoundError(f"Address '{data.address_id}' was not found.")

        cart = await self.cart_repository.get_cart_by_user_id(user_id)

        if cart is None or not cart.items:
            raise ResourceConflictError("Your cart is empty.")

        # Resolve offers once, then use the same figures for validation,
        # the subtotal and each order line. Recomputing per line risks the
        # stored total disagreeing with the sum of its items.
        discounts = await self.cart_service.resolve_cart_discounts(cart)

        subtotal_paise = 0

        for item in cart.items:
            variant = item.variant
            inventory = variant.inventory

            if not variant.is_active:
                raise ResourceConflictError(f"Variant '{variant.id}' is not available.")

            if inventory is None:
                raise ResourceConflictError(
                    f"Inventory is not available for variant '{variant.id}'."
                )

            if item.quantity > inventory.available_quantity:
                raise ResourceConflictError(
                    f"Only {inventory.available_quantity} units "
                    f"are available for variant '{variant.id}'."
                )

            unit_price_paise = apply_discount(
                variant.price_paise,
                discounts.get(item.variant_id),
            )

            subtotal_paise += item.quantity * unit_price_paise

        shipping_paise = self._calculate_shipping(subtotal_paise)

        total_paise = subtotal_paise + shipping_paise

        order = await self.order_repository.create_order(
            user_id=user_id,
            recipient_name=address.recipient_name,
            recipient_phone=address.phone,
            address_line_1=address.address_line_1,
            address_line_2=address.address_line_2,
            landmark=address.landmark,
            city=address.city,
            state=address.state,
            postal_code=address.postal_code,
            country=address.country,
            customer_note=data.customer_note,
            subtotal_paise=subtotal_paise,
            shipping_paise=shipping_paise,
            total_paise=total_paise,
        )

        for item in cart.items:
            variant = item.variant
            inventory = variant.inventory

            if inventory is None:
                raise RuntimeError("Inventory disappeared during checkout.")

            # The discounted price is what the customer agreed to pay, so
            # it is what gets recorded permanently on the order line.
            unit_price_paise = apply_discount(
                variant.price_paise,
                discounts.get(item.variant_id),
            )

            line_total_paise = item.quantity * unit_price_paise

            await self.order_repository.create_order_item(
                order_id=order.id,
                product_id=variant.product_id,
                variant_id=variant.id,
                product_name=variant.product.name,
                variant_name=variant.name,
                sku=variant.sku,
                size_label=variant.size_label,
                colour=variant.colour,
                material=variant.material,
                quantity=item.quantity,
                unit_price_paise=unit_price_paise,
                line_total_paise=line_total_paise,
            )

            inventory.quantity_on_hand -= item.quantity

        await self.cart_repository.clear_cart(cart.id)

        try:
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        loaded_order = await self.order_repository.get_order_by_id(
            user_id=user_id,
            order_id=order.id,
        )

        if loaded_order is None:
            raise RuntimeError("Order could not be loaded after checkout.")

        return OrderResponse.model_validate(loaded_order)

    async def get_order(
        self,
        *,
        user_id: uuid.UUID,
        order_id: uuid.UUID,
    ) -> OrderResponse:
        """Return one order belonging to the customer."""

        order = await self.order_repository.get_order_by_id(
            user_id=user_id,
            order_id=order_id,
        )

        if order is None:
            raise ResourceNotFoundError(f"Order '{order_id}' was not found.")

        return OrderResponse.model_validate(order)

    async def list_orders(
        self,
        user_id: uuid.UUID,
    ) -> list[Order]:
        """Return all orders belonging to the customer."""

        return await self.order_repository.list_orders(user_id)

    async def update_order_status(
        self,
        *,
        order_id: uuid.UUID,
        data: AdminOrderStatusUpdate,
    ) -> OrderResponse:
        """Update an order's fulfilment status."""

        order = await self.order_repository.get_order_by_id_admin(order_id)

        if order is None:
            raise ResourceNotFoundError(f"Order '{order_id}' was not found.")

        self._validate_status_transition(
            current_status=order.status,
            new_status=data.status,
        )

        await self.order_repository.update_order_status(
            order=order,
            status=data.status,
        )

        try:
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        loaded_order = await self.order_repository.get_order_by_id_admin(order_id)

        if loaded_order is None:
            raise RuntimeError("Order could not be loaded after status update.")

        return OrderResponse.model_validate(loaded_order)

    async def list_all_orders(
        self,
    ) -> list[Order]:
        """Return all customer orders for administrators."""

        return await self.order_repository.list_all_orders()

    async def get_order_admin(
        self,
        order_id: uuid.UUID,
    ) -> OrderResponse:
        """Return one order for an administrator."""

        order = await self.order_repository.get_order_by_id_admin(order_id)

        if order is None:
            raise ResourceNotFoundError(f"Order '{order_id}' was not found.")

        return OrderResponse.model_validate(order)

    @staticmethod
    def _calculate_shipping(
        subtotal_paise: int,
    ) -> int:
        """Calculate shipping from the current subtotal."""

        free_shipping_threshold_paise = 50_000

        if subtotal_paise >= free_shipping_threshold_paise:
            return 0

        return 5_000

    @staticmethod
    def _validate_status_transition(
        *,
        current_status: OrderStatus,
        new_status: OrderStatus,
    ) -> None:
        """Ensure an order follows an allowed status transition."""

        allowed_transitions = {
            OrderStatus.PENDING: {
                OrderStatus.CONFIRMED,
                OrderStatus.CANCELLED,
            },
            OrderStatus.CONFIRMED: {
                OrderStatus.PROCESSING,
                OrderStatus.CANCELLED,
            },
            OrderStatus.PROCESSING: {
                OrderStatus.SHIPPED,
                OrderStatus.CANCELLED,
            },
            OrderStatus.SHIPPED: {
                OrderStatus.DELIVERED,
            },
            OrderStatus.DELIVERED: set(),
            OrderStatus.CANCELLED: set(),
        }

        if new_status == current_status:
            return

        if new_status not in allowed_transitions[current_status]:
            raise ResourceConflictError(
                f"Order status cannot change from '{current_status.value}' to '{new_status.value}'."
            )
