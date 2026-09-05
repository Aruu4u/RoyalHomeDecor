import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

from app.services.offer_pricing import MAX_OFFER_DURATION_DAYS


class InventoryCreate(BaseModel):
    """Inventory values accepted while creating a product variant."""

    model_config = ConfigDict(extra="forbid")

    quantity_on_hand: int = Field(
        default=0,
        ge=0,
    )

    reserved_quantity: int = Field(
        default=0,
        ge=0,
    )

    low_stock_threshold: int = Field(
        default=5,
        ge=0,
    )

    @model_validator(mode="after")
    def validate_reserved_quantity(self) -> "InventoryCreate":
        """Reserved stock cannot exceed physical stock."""

        if self.reserved_quantity > self.quantity_on_hand:
            raise ValueError("Reserved quantity cannot exceed quantity on hand.")

        return self


class InventoryUpdate(BaseModel):
    """Fields accepted when updating variant inventory."""

    model_config = ConfigDict(extra="forbid")

    quantity_on_hand: int | None = Field(
        default=None,
        ge=0,
    )

    reserved_quantity: int | None = Field(
        default=None,
        ge=0,
    )

    low_stock_threshold: int | None = Field(
        default=None,
        ge=0,
    )

    @model_validator(mode="after")
    def validate_supplied_stock_values(
        self,
    ) -> "InventoryUpdate":
        """Validate stock values when both are supplied."""

        if (
            self.quantity_on_hand is not None
            and self.reserved_quantity is not None
            and self.reserved_quantity > self.quantity_on_hand
        ):
            raise ValueError("Reserved quantity cannot exceed quantity on hand.")

        return self


class InventoryResponse(BaseModel):
    """Inventory information returned by the API."""

    id: uuid.UUID
    variant_id: uuid.UUID

    quantity_on_hand: int
    reserved_quantity: int
    low_stock_threshold: int

    available_quantity: int

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class ProductImageCreate(BaseModel):
    """Image data accepted while creating a product."""

    model_config = ConfigDict(extra="forbid")

    image_url: HttpUrl

    alt_text: str = Field(
        min_length=3,
        max_length=250,
    )

    display_order: int = Field(
        default=0,
        ge=0,
    )

    is_primary: bool = False

    @field_validator("alt_text")
    @classmethod
    def clean_alt_text(cls, value: str) -> str:
        """Remove accidental spaces from image descriptions."""

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Alt text cannot contain only whitespace.")

        return cleaned_value


class ProductImageUpdate(BaseModel):
    """Fields accepted when updating a product image."""

    model_config = ConfigDict(extra="forbid")

    image_url: HttpUrl | None = None

    alt_text: str | None = Field(
        default=None,
        min_length=3,
        max_length=250,
    )

    display_order: int | None = Field(
        default=None,
        ge=0,
    )

    is_primary: bool | None = None

    @field_validator("alt_text")
    @classmethod
    def clean_alt_text(
        cls,
        value: str | None,
    ) -> str | None:
        """Remove accidental spaces from supplied alt text."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Alt text cannot contain only whitespace.")

        return cleaned_value


class ProductImageResponse(BaseModel):
    """Product image returned by the API."""

    id: uuid.UUID
    product_id: uuid.UUID

    image_url: HttpUrl
    alt_text: str
    display_order: int
    is_primary: bool

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class ProductVariantCreate(BaseModel):
    """Purchasable product variant accepted during product creation."""

    model_config = ConfigDict(extra="forbid")

    sku: str = Field(
        min_length=3,
        max_length=100,
        pattern=r"^[A-Z0-9]+(?:-[A-Z0-9]+)*$",
        examples=["MIR-ARCH-GOLD-L"],
    )

    name: str = Field(
        min_length=1,
        max_length=150,
        examples=["Large"],
    )

    size_label: str | None = Field(
        default=None,
        max_length=100,
        examples=["90 Ã— 120 cm"],
    )

    colour: str | None = Field(
        default=None,
        max_length=80,
    )

    material: str | None = Field(
        default=None,
        max_length=120,
    )

    price_paise: int = Field(
        ge=0,
        examples=[1299900],
    )

    length_cm: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=10,
        decimal_places=2,
    )

    width_cm: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=10,
        decimal_places=2,
    )

    height_cm: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=10,
        decimal_places=2,
    )

    weight_grams: int | None = Field(
        default=None,
        ge=0,
    )

    is_active: bool = True

    inventory: InventoryCreate

    @field_validator(
        "sku",
        "name",
        "size_label",
        "colour",
        "material",
    )
    @classmethod
    def clean_variant_text(
        cls,
        value: str | None,
    ) -> str | None:
        """Remove accidental surrounding spaces."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Value cannot contain only whitespace.")

        return cleaned_value

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, value: str) -> str:
        """Store SKUs consistently in uppercase."""

        return value.upper()


class ProductVariantUpdate(BaseModel):
    """Fields accepted when updating a product variant."""

    model_config = ConfigDict(extra="forbid")

    sku: str | None = Field(
        default=None,
        min_length=3,
        max_length=80,
        pattern=r"^[A-Z0-9-]+$",
    )

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
    )

    size_label: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    colour: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    material: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )

    price_paise: int | None = Field(
        default=None,
        ge=0,
    )

    length_cm: Decimal | None = Field(
        default=None,
        ge=0,
    )

    width_cm: Decimal | None = Field(
        default=None,
        ge=0,
    )

    height_cm: Decimal | None = Field(
        default=None,
        ge=0,
    )

    weight_grams: int | None = Field(
        default=None,
        ge=0,
    )

    is_active: bool | None = None

    @field_validator(
        "sku",
        "name",
        "size_label",
        "colour",
        "material",
    )
    @classmethod
    def clean_optional_text(
        cls,
        value: str | None,
    ) -> str | None:
        """Trim optional variant text values."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Text fields cannot contain only whitespace.")

        return cleaned_value

    @field_validator("sku")
    @classmethod
    def normalize_sku(
        cls,
        value: str | None,
    ) -> str | None:
        """Store supplied SKUs in uppercase."""

        if value is None:
            return None

        return value.upper()


class ProductVariantResponse(BaseModel):
    """Purchasable product variant returned by the API."""

    id: uuid.UUID
    product_id: uuid.UUID

    sku: str
    name: str
    size_label: str | None

    colour: str | None
    material: str | None

    price_paise: int

    length_cm: Decimal | None
    width_cm: Decimal | None
    height_cm: Decimal | None
    weight_grams: int | None

    is_active: bool

    inventory: InventoryResponse | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class ProductBase(BaseModel):
    """Fields shared by product creation and product responses."""

    model_config = ConfigDict(extra="forbid")

    collection_id: uuid.UUID

    name: str = Field(
        min_length=2,
        max_length=200,
        examples=["Arched Brass Mirror"],
    )

    slug: str = Field(
        min_length=2,
        max_length=220,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        examples=["arched-brass-mirror"],
    )

    short_description: str = Field(
        min_length=10,
        max_length=400,
    )

    description: str = Field(
        min_length=20,
        max_length=10000,
    )

    base_price_paise: int = Field(
        ge=0,
        examples=[1299900],
    )

    # Furniture is usually two materials and a finish, so each is its own
    # field. Splitting them means a shopper can look for a marble top
    # regardless of what it stands on.
    top_material: str | None = Field(
        default=None,
        max_length=120,
        examples=["Italian marble"],
    )

    base_material: str | None = Field(
        default=None,
        max_length=120,
        examples=["Solid brass"],
    )

    finish: str | None = Field(
        default=None,
        max_length=120,
        examples=["Hand-polished satin"],
    )

    colour: str | None = Field(
        default=None,
        max_length=80,
    )

    style: str | None = Field(
        default=None,
        max_length=100,
    )

    thumbnail_url: HttpUrl | None = None

    is_active: bool = True
    is_recommended: bool = False

    @field_validator(
        "name",
        "short_description",
        "description",
        "top_material",
        "base_material",
        "finish",
        "colour",
        "style",
    )
    @classmethod
    def clean_product_text(
        cls,
        value: str | None,
    ) -> str | None:
        """Remove surrounding whitespace from product text."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Value cannot contain only whitespace.")

        return cleaned_value


class ProductCreate(ProductBase):
    """Complete nested data accepted when creating a product."""

    images: list[ProductImageCreate] = Field(
        min_length=1,
        max_length=20,
    )

    variants: list[ProductVariantCreate] = Field(
        min_length=1,
        max_length=50,
    )

    @model_validator(mode="after")
    def validate_nested_product_data(self) -> "ProductCreate":
        """Validate images, variants and nested uniqueness rules."""

        primary_images = [image for image in self.images if image.is_primary]

        if len(primary_images) != 1:
            raise ValueError("A product must contain exactly one primary image.")

        image_positions = [image.display_order for image in self.images]

        if len(image_positions) != len(set(image_positions)):
            raise ValueError("Image display order values must be unique within a product.")

        skus = [variant.sku.upper() for variant in self.variants]

        if len(skus) != len(set(skus)):
            raise ValueError("Product variants cannot contain duplicate SKUs.")

        return self


class ProductSummaryResponse(BaseModel):
    """Small product response used on cards and search results."""

    id: uuid.UUID
    collection_id: uuid.UUID

    name: str
    slug: str
    short_description: str

    base_price_paise: int

    # ---------- Offers ----------
    #
    # `offer_percent` is the product's own standalone discount and may be
    # null even while an offer applies, because the product can instead
    # be discounted through an offer section.
    #
    # `offer_discount_percent` and `offer_price_paise` are the values to
    # display: the effective discount actually applied, and the resulting
    # price. Both are computed on the server so the storefront never
    # calculates money, and both are null when nothing is on offer.

    offer_percent: int | None = None
    offer_label: str | None = None

    # When the product's own offer stops. Null means it never expires.
    offer_ends_at: datetime | None = None

    offer_discount_percent: int | None = None
    offer_price_paise: int | None = None

    top_material: str | None
    base_material: str | None = None
    finish: str | None = None

    colour: str | None
    style: str | None

    thumbnail_url: HttpUrl | None

    is_active: bool
    is_recommended: bool

    # ---------- Stock ----------
    #
    # The list endpoint returns no variants, so without these a product
    # card has no way to know a piece is sold out. Summed across the
    # product's active variants by the service layer.
    #
    # `in_stock` defaults to true rather than false: the cart already
    # rejects an unavailable variant with a clear message, so if these
    # ever went unset it is better to let a shopper try than to hide the
    # whole catalogue behind a false "sold out".
    in_stock: bool = True
    available_quantity: int = 0

    # ---------- Reviews ----------

    review_count: int = 0
    review_average: float | None = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class ProductDetailResponse(ProductSummaryResponse):
    """Complete product information returned on the detail page."""

    description: str

    images: list[ProductImageResponse]
    variants: list[ProductVariantResponse]


class ProductUpdate(BaseModel):
    """Main product fields accepted during a partial update."""

    model_config = ConfigDict(extra="forbid")

    collection_id: uuid.UUID | None = None

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=200,
    )

    slug: str | None = Field(
        default=None,
        min_length=2,
        max_length=220,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )

    short_description: str | None = Field(
        default=None,
        min_length=10,
        max_length=400,
    )

    description: str | None = Field(
        default=None,
        min_length=20,
        max_length=10000,
    )

    base_price_paise: int | None = Field(
        default=None,
        ge=0,
    )

    top_material: str | None = Field(
        default=None,
        max_length=120,
    )

    base_material: str | None = Field(
        default=None,
        max_length=120,
    )

    finish: str | None = Field(
        default=None,
        max_length=120,
    )

    colour: str | None = Field(
        default=None,
        max_length=80,
    )

    style: str | None = Field(
        default=None,
        max_length=100,
    )

    thumbnail_url: HttpUrl | None = None

    is_active: bool | None = None
    is_recommended: bool | None = None

    # Lets the product edit form set a standalone offer alongside the
    # other fields. Send null to clear it.
    offer_percent: int | None = Field(
        default=None,
        ge=1,
        le=90,
    )

    offer_label: str | None = Field(
        default=None,
        max_length=60,
    )

    # How long the offer should run for, counted from now. Three distinct
    # meanings, which is why "unset" and "null" are not the same thing:
    #
    #   omitted -> leave any existing end date alone
    #   null    -> never expires
    #   N       -> ends N days from now
    #
    # The server turns this into an absolute timestamp, so the deadline
    # cannot drift with the client's clock or with when the row is next
    # saved.
    offer_duration_days: int | None = Field(
        default=None,
        ge=1,
        le=MAX_OFFER_DURATION_DAYS,
    )

    @field_validator(
        "name",
        "short_description",
        "description",
        "top_material",
        "base_material",
        "finish",
        "colour",
        "style",
    )
    @classmethod
    def clean_updated_product_text(
        cls,
        value: str | None,
    ) -> str | None:
        """Remove surrounding whitespace from supplied fields."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Value cannot contain only whitespace.")

        return cleaned_value
