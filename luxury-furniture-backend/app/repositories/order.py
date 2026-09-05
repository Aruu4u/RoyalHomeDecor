import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.order_enums import OrderStatus, PaymentStatus


class OrderRepository:
    """Database operations for customer orders."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_order(
        self,
        *,
        user_id: uuid.UUID,
        recipient_name: str,
        recipient_phone: str,
        address_line_1: str,
        address_line_2: str | None,
        landmark: str | None,
        city: str,
        state: str,
        postal_code: str,
        country: str,
        customer_note: str | None,
        subtotal_paise: int,
        shipping_paise: int,
        total_paise: int,
    ) -> Order:
        """Create a new pending order."""

        order = Order(
            user_id=user_id,
            status=OrderStatus.PENDING,
            payment_status=PaymentStatus.PENDING,
            recipient_name=recipient_name,
            recipient_phone=recipient_phone,
            address_line_1=address_line_1,
            address_line_2=address_line_2,
            landmark=landmark,
            city=city,
            state=state,
            postal_code=postal_code,
            country=country,
            customer_note=customer_note,
            subtotal_paise=subtotal_paise,
            shipping_paise=shipping_paise,
            total_paise=total_paise,
        )

        self.session.add(order)

        await self.session.flush()

        return order

    async def create_order_item(
        self,
        *,
        order_id: uuid.UUID,
        product_id: uuid.UUID,
        variant_id: uuid.UUID,
        product_name: str,
        variant_name: str,
        sku: str,
        size_label: str | None,
        colour: str | None,
        material: str | None,
        quantity: int,
        unit_price_paise: int,
        line_total_paise: int,
    ) -> OrderItem:
        """Create one order-item snapshot."""

        item = OrderItem(
            order_id=order_id,
            product_id=product_id,
            variant_id=variant_id,
            product_name=product_name,
            variant_name=variant_name,
            sku=sku,
            size_label=size_label,
            colour=colour,
            material=material,
            quantity=quantity,
            unit_price_paise=unit_price_paise,
            line_total_paise=line_total_paise,
        )

        self.session.add(item)

        await self.session.flush()

        return item

    async def get_order_by_id(
        self,
        *,
        user_id: uuid.UUID,
        order_id: uuid.UUID,
    ) -> Order | None:
        """Return one order belonging to the customer."""

        statement = (
            select(Order)
            .where(
                Order.id == order_id,
                Order.user_id == user_id,
            )
            .options(
                selectinload(Order.items),
            )
        )

        result = await self.session.execute(statement)

        return result.scalar_one_or_none()

    async def list_orders(
        self,
        user_id: uuid.UUID,
    ) -> list[Order]:
        """Return the customer's orders, newest first."""

        statement = select(Order).where(Order.user_id == user_id).order_by(Order.created_at.desc())

        result = await self.session.execute(statement)

        return list(result.scalars().all())

    async def update_payment_details(
        self,
        *,
        order: Order,
        payment_status: PaymentStatus,
        razorpay_order_id: str | None = None,
        razorpay_payment_id: str | None = None,
    ) -> Order:
        """Update payment information for an order."""

        order.payment_status = payment_status

        if razorpay_order_id is not None:
            order.razorpay_order_id = razorpay_order_id

        if razorpay_payment_id is not None:
            order.razorpay_payment_id = razorpay_payment_id

        await self.session.flush()

        return order

    async def update_order_status(
        self,
        *,
        order: Order,
        status: OrderStatus,
    ) -> Order:
        """Update the order status."""

        order.status = status

        await self.session.flush()

        return order

    async def get_order_by_id_admin(
        self,
        order_id: uuid.UUID,
    ) -> Order | None:
        """Return one order without customer ownership filtering."""

        statement = (
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.items),
            )
        )

        result = await self.session.execute(statement)

        return result.scalar_one_or_none()

    async def list_all_orders(
        self,
    ) -> list[Order]:
        """Return all orders, newest first."""

        statement = select(Order).order_by(Order.created_at.desc())

        result = await self.session.execute(statement)

        return list(result.scalars().all())
