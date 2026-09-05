import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class CollectionBase(BaseModel):
    """Fields shared by collection creation and responses."""

    name: str = Field(
        min_length=2,
        max_length=100,
        examples=["Dining Tables"],
    )

    slug: str = Field(
        min_length=2,
        max_length=120,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        examples=["dining-tables"],
    )

    short_description: str = Field(
        min_length=10,
        max_length=300,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    hero_image_url: HttpUrl | None = None

    display_order: int = Field(
        default=0,
        ge=0,
    )

    is_active: bool = True

    @field_validator("name", "short_description", "description")
    @classmethod
    def remove_surrounding_whitespace(
        cls,
        value: str | None,
    ) -> str | None:
        """Remove accidental spaces from text fields."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Value must not contain only whitespace")

        return cleaned_value


class CollectionCreate(CollectionBase):
    """Data accepted when creating a collection."""


class CollectionUpdate(BaseModel):
    """Data accepted when partially updating a collection."""

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    slug: str | None = Field(
        default=None,
        min_length=2,
        max_length=120,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )

    short_description: str | None = Field(
        default=None,
        min_length=10,
        max_length=300,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    hero_image_url: HttpUrl | None = None

    display_order: int | None = Field(
        default=None,
        ge=0,
    )

    is_active: bool | None = None

    @field_validator("name", "short_description", "description")
    @classmethod
    def remove_surrounding_whitespace(
        cls,
        value: str | None,
    ) -> str | None:
        """Remove accidental spaces from supplied text fields."""

        if value is None:
            return None

        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("Value must not contain only whitespace")

        return cleaned_value


class CollectionResponse(CollectionBase):
    """Collection data returned by the API."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
