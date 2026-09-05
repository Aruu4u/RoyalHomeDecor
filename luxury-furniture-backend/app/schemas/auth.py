import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AuthenticatedUser(BaseModel):
    """A user successfully verified by Supabase Auth."""

    model_config = ConfigDict(extra="ignore")

    id: uuid.UUID
    email: EmailStr | None = None

    app_metadata: dict[str, Any] = Field(
        default_factory=dict,
    )

    user_metadata: dict[str, Any] = Field(
        default_factory=dict,
    )

    @property
    def is_admin(self) -> bool:
        """Return whether the user has the admin application role."""

        return self.app_metadata.get("role") == "admin"
