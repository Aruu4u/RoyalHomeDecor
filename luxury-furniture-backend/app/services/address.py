import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.models.address import Address
from app.repositories.address import AddressRepository
from app.schemas.address import (
    AddressCreate,
    AddressUpdate,
)


class AddressService:
    """Business logic for customer delivery addresses."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = AddressRepository(session)

    async def create_address(
        self,
        user_id: uuid.UUID,
        data: AddressCreate,
    ) -> Address:
        """Create a delivery address for the authenticated user."""

        profile_exists = await self.repository.profile_exists(
            user_id,
        )

        if not profile_exists:
            raise ResourceNotFoundError("Create your profile before adding an address.")

        address_count = await self.repository.count_for_user(
            user_id,
        )

        should_be_default = address_count == 0 or data.is_default

        if should_be_default:
            await self.repository.clear_default_addresses(
                user_id,
            )

        address_data = data.model_dump()
        address_data["is_default"] = should_be_default

        address = Address(
            user_id=user_id,
            **address_data,
        )

        try:
            created_address = await self.repository.create(
                address,
            )

            await self.session.commit()
            await self.session.refresh(created_address)

        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The address conflicts with an existing record."
            ) from exception

        return created_address

    async def list_addresses(
        self,
        user_id: uuid.UUID,
    ):
        """Return the authenticated user's saved addresses."""

        return await self.repository.list_for_user(
            user_id,
        )

    async def update_address(
        self,
        *,
        user_id: uuid.UUID,
        address_id: uuid.UUID,
        data: AddressUpdate,
    ) -> Address:
        """Update an address belonging to the authenticated user."""

        address = await self.repository.get_by_id_for_user(
            address_id=address_id,
            user_id=user_id,
        )

        if address is None:
            raise ResourceNotFoundError(f"Address '{address_id}' was not found.")

        update_data = data.model_dump(
            exclude_unset=True,
        )

        new_default_status = update_data.get(
            "is_default",
        )

        if new_default_status is False and address.is_default:
            raise ResourceConflictError(
                "The default address cannot be unset directly. "
                "Set another address as default instead."
            )

        if new_default_status is True and not address.is_default:
            await self.repository.clear_default_addresses(
                user_id,
            )

        for field_name, field_value in update_data.items():
            setattr(
                address,
                field_name,
                field_value,
            )

        try:
            await self.session.commit()
            await self.session.refresh(address)

        except IntegrityError as exception:
            await self.session.rollback()

            raise ResourceConflictError(
                "The updated address conflicts with an existing record."
            ) from exception

        return address

    async def delete_address(
        self,
        *,
        user_id: uuid.UUID,
        address_id: uuid.UUID,
    ) -> None:
        """Delete an address and preserve the default-address rule."""

        address = await self.repository.get_by_id_for_user(
            address_id=address_id,
            user_id=user_id,
        )

        if address is None:
            raise ResourceNotFoundError(f"Address '{address_id}' was not found.")

        addresses = list(
            await self.repository.list_for_user(
                user_id,
            )
        )

        remaining_addresses = [
            saved_address for saved_address in addresses if saved_address.id != address.id
        ]

        if address.is_default and remaining_addresses:
            next_default_address = min(
                remaining_addresses,
                key=lambda saved_address: saved_address.created_at,
            )

            next_default_address.is_default = True

        await self.repository.delete(address)
        await self.session.commit()
