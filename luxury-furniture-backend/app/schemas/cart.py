import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class CartItemCreate(BaseModel):
    """Fields used when adding a variant to the cart."""

    model_config = ConfigDict(extra="forbid")

    variant_id: uuid.UUID

    quantity: int = Field(
        default=1,
        ge=1,
        le=99,
    )


class CartItemUpdate(BaseModel):
    """Fields accepted when changing cart-item quantity."""

    model_config = ConfigDict(extra="forbid")

    quantity: int = Field(
        ge=1,
        le=99,
    )


class CartVariantResponse(BaseModel):
    """Variant information displayed inside the cart."""

    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    product_id: uuid.UUID
    sku: str
    name: str
    size_label: str | None
    colour: str | None
    material: str | None
    price_paise: int
    is_active: bool


class CartItemResponse(BaseModel):
    """One populated item returned inside a shopping cart.

    ``list_unit_price_paise`` is the variant's normal price and
    ``unit_price_paise`` is what is actually charged. They differ only
    when an offer applies, and ``line_total_paise`` is always derived
    from the charged price so the arithmetic on screen adds up.
    """

    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    cart_id: uuid.UUID
    variant_id: uuid.UUID
    quantity: int
    variant: CartVariantResponse

    list_unit_price_paise: int
    unit_price_paise: int
    discount_percent: int | None = None

    line_total_paise: int
    created_at: datetime
    updated_at: datetime


class CartResponse(BaseModel):
    """Complete customer shopping cart."""

    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    user_id: uuid.UUID
    items: list[CartItemResponse]

    # Sum of the charged line totals, so offers are already applied.
    subtotal_paise: int

    # What the same basket would cost without any offer, and the
    # difference. Both are 0 when nothing in the cart is discounted.
    list_subtotal_paise: int = 0
    total_saving_paise: int = 0

    total_quantity: int
    created_at: datetime
    updated_at: datetime
