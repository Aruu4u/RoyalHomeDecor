import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class ProfileCreate(BaseModel):
    """Fields used when creating a customer profile."""

    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(
        min_length=2,
        max_length=150,
    )

    phone: str | None = Field(
        default=None,
        min_length=8,
        max_length=20,
    )

    @field_validator(
        "full_name",
        "phone",
    )
    @classmethod
    def clean_text(
        cls,
        value: str | None,
    ) -> str | None:
        """Trim supplied profile values."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Text fields cannot contain only whitespace.")

        return cleaned_value


class ProfileUpdate(BaseModel):
    """Fields accepted when updating a customer profile."""

    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    phone: str | None = Field(
        default=None,
        min_length=8,
        max_length=20,
    )

    @field_validator(
        "full_name",
        "phone",
    )
    @classmethod
    def clean_optional_text(
        cls,
        value: str | None,
    ) -> str | None:
        """Trim optional profile values."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Text fields cannot contain only whitespace.")

        return cleaned_value


class ProfileResponse(BaseModel):
    """Customer profile returned by the API."""

    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    full_name: str
    phone: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
