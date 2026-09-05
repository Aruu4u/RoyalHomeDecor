import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class AddressBase(BaseModel):
    """Shared customer address fields."""

    model_config = ConfigDict(extra="forbid")

    label: str = Field(
        default="Home",
        min_length=1,
        max_length=50,
    )

    recipient_name: str = Field(
        min_length=2,
        max_length=150,
    )

    phone: str = Field(
        min_length=8,
        max_length=20,
    )

    address_line_1: str = Field(
        min_length=5,
        max_length=250,
    )

    address_line_2: str | None = Field(
        default=None,
        max_length=250,
    )

    landmark: str | None = Field(
        default=None,
        max_length=150,
    )

    city: str = Field(
        min_length=2,
        max_length=100,
    )

    state: str = Field(
        min_length=2,
        max_length=100,
    )

    postal_code: str = Field(
        min_length=4,
        max_length=20,
    )

    country: str = Field(
        default="India",
        min_length=2,
        max_length=100,
    )

    is_default: bool = False

    @field_validator(
        "label",
        "recipient_name",
        "phone",
        "address_line_1",
        "address_line_2",
        "landmark",
        "city",
        "state",
        "postal_code",
        "country",
    )
    @classmethod
    def clean_text(
        cls,
        value: str | None,
    ) -> str | None:
        """Trim address text values."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Text fields cannot contain only whitespace.")

        return cleaned_value


class AddressCreate(AddressBase):
    """Fields used when creating an address."""


class AddressUpdate(BaseModel):
    """Fields accepted when updating an address."""

    model_config = ConfigDict(extra="forbid")

    label: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
    )

    recipient_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    phone: str | None = Field(
        default=None,
        min_length=8,
        max_length=20,
    )

    address_line_1: str | None = Field(
        default=None,
        min_length=5,
        max_length=250,
    )

    address_line_2: str | None = Field(
        default=None,
        max_length=250,
    )

    landmark: str | None = Field(
        default=None,
        max_length=150,
    )

    city: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    state: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    postal_code: str | None = Field(
        default=None,
        min_length=4,
        max_length=20,
    )

    country: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    is_default: bool | None = None

    @field_validator(
        "label",
        "recipient_name",
        "phone",
        "address_line_1",
        "address_line_2",
        "landmark",
        "city",
        "state",
        "postal_code",
        "country",
    )
    @classmethod
    def clean_optional_text(
        cls,
        value: str | None,
    ) -> str | None:
        """Trim optional address text."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Text fields cannot contain only whitespace.")

        return cleaned_value


class AddressResponse(BaseModel):
    """Saved customer address returned by the API."""

    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    user_id: uuid.UUID
    label: str
    recipient_name: str
    phone: str
    address_line_1: str
    address_line_2: str | None
    landmark: str | None
    city: str
    state: str
    postal_code: str
    country: str
    is_default: bool
    created_at: datetime
    updated_at: datetime
