import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.order_enums import OrderStatus, PaymentStatus


class CheckoutCreate(BaseModel):
    """Information required to create an order from the cart."""

    model_config = ConfigDict(extra="forbid")

    address_id: uuid.UUID

    customer_note: str | None = Field(
        default=None,
        max_length=1000,
    )


class OrderItemResponse(BaseModel):
    """One permanent product snapshot inside an order."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    product_id: uuid.UUID
    variant_id: uuid.UUID
    product_name: str
    variant_name: str
    sku: str
    size_label: str | None
    colour: str | None
    material: str | None
    quantity: int
    unit_price_paise: int
    line_total_paise: int
    created_at: datetime
    updated_at: datetime


class OrderResponse(BaseModel):
    """Complete customer order response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID

    status: OrderStatus
    payment_status: PaymentStatus

    recipient_name: str
    recipient_phone: str
    address_line_1: str
    address_line_2: str | None
    landmark: str | None
    city: str
    state: str
    postal_code: str
    country: str

    customer_note: str | None

    subtotal_paise: int
    shipping_paise: int
    total_paise: int

    razorpay_order_id: str | None
    razorpay_payment_id: str | None

    items: list[OrderItemResponse]

    created_at: datetime
    updated_at: datetime


class OrderListResponse(BaseModel):
    """Smaller response used when listing customer orders."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: OrderStatus
    payment_status: PaymentStatus
    total_paise: int
    created_at: datetime


class AdminOrderStatusUpdate(BaseModel):
    """Fields an administrator may update on an order."""

    model_config = ConfigDict(extra="forbid")

    status: OrderStatus
