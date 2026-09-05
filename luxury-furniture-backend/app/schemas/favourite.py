import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FavouriteProductResponse(BaseModel):
    """Product information displayed on the favourites page.

    Deliberately carries the same offer and stock fields as
    ``ProductSummaryResponse``. The favourites page renders the ordinary
    product card, so without them a saved piece would show its full price
    while every other card showed the discount, and a sold-out favourite
    would still offer an "Add to cart" button that could not work.
    """

    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    collection_id: uuid.UUID
    name: str
    slug: str
    short_description: str
    base_price_paise: int

    top_material: str | None
    base_material: str | None
    finish: str | None

    colour: str | None
    style: str | None
    thumbnail_url: str | None
    is_active: bool
    is_recommended: bool

    # ---------- Offers ----------

    offer_percent: int | None = None
    offer_label: str | None = None
    offer_ends_at: datetime | None = None

    offer_discount_percent: int | None = None
    offer_price_paise: int | None = None

    # ---------- Stock ----------

    in_stock: bool = True
    available_quantity: int = 0

    # ---------- Reviews ----------

    review_count: int = 0
    review_average: float | None = None


class FavouriteResponse(BaseModel):
    """One saved product returned to the customer."""

    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    user_id: uuid.UUID
    product_id: uuid.UUID
    product: FavouriteProductResponse
    created_at: datetime
    updated_at: datetime
