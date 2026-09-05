import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict


class RazorpayOrderResponse(BaseModel):
    """Razorpay order details returned to the frontend."""

    model_config = ConfigDict(extra="forbid")

    internal_order_id: uuid.UUID
    razorpay_order_id: str
    razorpay_key_id: str
    amount: int
    currency: str
    status: str


class RazorpayOrderEntity(BaseModel):
    """Relevant fields returned by Razorpay's Orders API."""

    model_config = ConfigDict(extra="allow")

    id: str
    entity: str
    amount: int
    amount_paid: int
    amount_due: int
    currency: str
    receipt: str | None = None
    status: str
    attempts: int
    notes: dict[str, Any] | list[Any]
    created_at: int
