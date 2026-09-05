import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.core.exceptions import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.main import app
from app.models.address import Address
from app.models.profile import Profile
from app.services.dependencies import (
    get_address_service,
    get_profile_service,
)


USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

PROFILE_ID = USER_ID

HOME_ADDRESS_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")

WORK_ADDRESS_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")

MISSING_ADDRESS_ID = uuid.UUID("99999999-9999-9999-9999-999999999999")


def build_fake_profile() -> Profile:
    """Create one fake customer profile."""

    current_time = datetime.now(UTC)

    return Profile(
        id=PROFILE_ID,
        full_name="Arsal Masood",
        phone="9557156626",
        is_active=True,
        created_at=current_time,
        updated_at=current_time,
    )


def build_fake_address(
    *,
    address_id: uuid.UUID = HOME_ADDRESS_ID,
    label: str = "Home",
    is_default: bool = True,
) -> Address:
    """Create one fake customer address."""

    current_time = datetime.now(UTC)

    return Address(
        id=address_id,
        user_id=USER_ID,
        label=label,
        recipient_name="Arsal Masood",
        phone="9557156626",
        address_line_1="House 12, Example Colony",
        address_line_2=None,
        landmark="Near Main Market",
        city="Moradabad",
        state="Uttar Pradesh",
        postal_code="244001",
        country="India",
        is_default=is_default,
        created_at=current_time,
        updated_at=current_time,
    )


class FakeProfileService:
    """Fake profile service without database access."""

    async def create_profile(
        self,
        user_id,
        data,
    ):
        """Create a fake profile."""

        if data.full_name == "Duplicate User":
            raise ResourceConflictError("A profile already exists for this user.")

        profile = build_fake_profile()

        profile.id = user_id
        profile.full_name = data.full_name
        profile.phone = data.phone

        return profile

    async def get_profile(
        self,
        user_id,
    ):
        """Return a fake profile."""

        if user_id != USER_ID:
            raise ResourceNotFoundError("A profile has not been created for this user.")

        return build_fake_profile()

    async def update_profile(
        self,
        user_id,
        data,
    ):
        """Update supplied profile fields."""

        if user_id != USER_ID:
            raise ResourceNotFoundError("A profile has not been created for this user.")

        profile = build_fake_profile()

        update_data = data.model_dump(
            exclude_unset=True,
        )

        for field_name, field_value in update_data.items():
            setattr(
                profile,
                field_name,
                field_value,
            )

        profile.updated_at = datetime.now(UTC)

        return profile


class FakeAddressService:
    """Fake address service without database access."""

    async def create_address(
        self,
        user_id,
        data,
    ):
        """Create a fake address."""

        if data.recipient_name == "Missing Profile":
            raise ResourceNotFoundError("Create your profile before adding an address.")

        address = build_fake_address(
            address_id=HOME_ADDRESS_ID,
            label=data.label,
            is_default=True,
        )

        address.user_id = user_id
        address.recipient_name = data.recipient_name
        address.phone = data.phone
        address.address_line_1 = data.address_line_1
        address.address_line_2 = data.address_line_2
        address.landmark = data.landmark
        address.city = data.city
        address.state = data.state
        address.postal_code = data.postal_code
        address.country = data.country

        return address

    async def list_addresses(
        self,
        user_id,
    ):
        """Return fake addresses belonging to the user."""

        if user_id != USER_ID:
            return []

        return [
            build_fake_address(),
            build_fake_address(
                address_id=WORK_ADDRESS_ID,
                label="Work",
                is_default=False,
            ),
        ]

    async def update_address(
        self,
        *,
        user_id,
        address_id,
        data,
    ):
        """Update an address owned by the user."""

        if user_id != USER_ID or address_id == MISSING_ADDRESS_ID:
            raise ResourceNotFoundError(f"Address '{address_id}' was not found.")

        address = build_fake_address(
            address_id=address_id,
            label=("Work" if address_id == WORK_ADDRESS_ID else "Home"),
            is_default=address_id == HOME_ADDRESS_ID,
        )

        update_data = data.model_dump(
            exclude_unset=True,
        )

        if update_data.get("is_default") is False and address.is_default:
            raise ResourceConflictError(
                "The default address cannot be unset directly. "
                "Set another address as default instead."
            )

        for field_name, field_value in update_data.items():
            setattr(
                address,
                field_name,
                field_value,
            )

        address.updated_at = datetime.now(UTC)

        return address

    async def delete_address(
        self,
        *,
        user_id,
        address_id,
    ):
        """Pretend to delete an owned address."""

        if user_id != USER_ID or address_id == MISSING_ADDRESS_ID:
            raise ResourceNotFoundError(f"Address '{address_id}' was not found.")


def override_profile_service() -> FakeProfileService:
    """Provide the fake profile service."""

    return FakeProfileService()


def override_address_service() -> FakeAddressService:
    """Provide the fake address service."""

    return FakeAddressService()


app.dependency_overrides[get_profile_service] = override_profile_service

app.dependency_overrides[get_address_service] = override_address_service

client = TestClient(app)


def test_create_profile_returns_201() -> None:
    """A valid profile should return HTTP 201."""

    response = client.post(
        "/api/v1/profile",
        json={
            "full_name": "Arsal Masood",
            "phone": "9557156626",
        },
    )

    assert response.status_code == 201

    response_body = response.json()

    assert response_body["id"] == str(USER_ID)
    assert response_body["full_name"] == "Arsal Masood"
    assert response_body["phone"] == "9557156626"
    assert response_body["is_active"] is True


def test_create_duplicate_profile_returns_409() -> None:
    """A second profile should return HTTP 409."""

    response = client.post(
        "/api/v1/profile",
        json={
            "full_name": "Duplicate User",
            "phone": "9557156626",
        },
    )

    assert response.status_code == 409

    assert response.json() == {"detail": "A profile already exists for this user."}


def test_get_profile_returns_current_user_profile() -> None:
    """The authenticated user should receive their profile."""

    response = client.get(
        "/api/v1/profile",
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["id"] == str(USER_ID)
    assert response_body["full_name"] == "Arsal Masood"


def test_update_profile_changes_supplied_fields() -> None:
    """PATCH should update only supplied profile fields."""

    response = client.patch(
        "/api/v1/profile",
        json={
            "full_name": "Arsal M. Masood",
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["full_name"] == "Arsal M. Masood"
    assert response_body["phone"] == "9557156626"


def test_profile_rejects_short_phone_number() -> None:
    """Phone numbers shorter than eight characters are invalid."""

    response = client.patch(
        "/api/v1/profile",
        json={
            "phone": "123",
        },
    )

    assert response.status_code == 422


def valid_address_payload() -> dict:
    """Return valid address request data."""

    return {
        "label": "Home",
        "recipient_name": "Arsal Masood",
        "phone": "9557156626",
        "address_line_1": "House 12, Example Colony",
        "address_line_2": None,
        "landmark": "Near Main Market",
        "city": "Moradabad",
        "state": "Uttar Pradesh",
        "postal_code": "244001",
        "country": "India",
        "is_default": False,
    }


def test_create_first_address_returns_default_address() -> None:
    """The first saved address should automatically be default."""

    response = client.post(
        "/api/v1/addresses",
        json=valid_address_payload(),
    )

    assert response.status_code == 201

    response_body = response.json()

    assert response_body["user_id"] == str(USER_ID)
    assert response_body["label"] == "Home"
    assert response_body["is_default"] is True


def test_create_address_without_profile_returns_404() -> None:
    """An address requires an existing customer profile."""

    payload = valid_address_payload()
    payload["recipient_name"] = "Missing Profile"

    response = client.post(
        "/api/v1/addresses",
        json=payload,
    )

    assert response.status_code == 404

    assert response.json() == {"detail": "Create your profile before adding an address."}


def test_list_addresses_returns_user_addresses() -> None:
    """Only the authenticated user's addresses should be returned."""

    response = client.get(
        "/api/v1/addresses",
    )

    assert response.status_code == 200

    response_body = response.json()

    assert len(response_body) == 2
    assert response_body[0]["is_default"] is True
    assert response_body[1]["is_default"] is False


def test_update_address_changes_supplied_fields() -> None:
    """PATCH should update only supplied address fields."""

    response = client.patch(
        f"/api/v1/addresses/{WORK_ADDRESS_ID}",
        json={
            "label": "Office",
            "address_line_2": "Third Floor",
        },
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["label"] == "Office"
    assert response_body["address_line_2"] == "Third Floor"
    assert response_body["city"] == "Moradabad"


def test_set_another_address_as_default() -> None:
    """A non-default address can become the default."""

    response = client.patch(
        f"/api/v1/addresses/{WORK_ADDRESS_ID}",
        json={
            "is_default": True,
        },
    )

    assert response.status_code == 200
    assert response.json()["is_default"] is True


def test_default_address_cannot_be_unset_directly() -> None:
    """The current default cannot directly become non-default."""

    response = client.patch(
        f"/api/v1/addresses/{HOME_ADDRESS_ID}",
        json={
            "is_default": False,
        },
    )

    assert response.status_code == 409

    assert response.json() == {
        "detail": (
            "The default address cannot be unset directly. Set another address as default instead."
        )
    }


def test_update_missing_address_returns_404() -> None:
    """An unknown address should return HTTP 404."""

    response = client.patch(
        f"/api/v1/addresses/{MISSING_ADDRESS_ID}",
        json={
            "label": "Office",
        },
    )

    assert response.status_code == 404

    assert response.json() == {"detail": f"Address '{MISSING_ADDRESS_ID}' was not found."}


def test_delete_address_returns_204() -> None:
    """Deleting an owned address should return HTTP 204."""

    response = client.delete(
        f"/api/v1/addresses/{WORK_ADDRESS_ID}",
    )

    assert response.status_code == 204
    assert response.content == b""


def test_delete_missing_address_returns_404() -> None:
    """Deleting an unknown address should return HTTP 404."""

    response = client.delete(
        f"/api/v1/addresses/{MISSING_ADDRESS_ID}",
    )

    assert response.status_code == 404

    assert response.json() == {"detail": f"Address '{MISSING_ADDRESS_ID}' was not found."}


def test_address_rejects_short_postal_code() -> None:
    """Postal codes shorter than four characters are invalid."""

    payload = valid_address_payload()
    payload["postal_code"] = "12"

    response = client.post(
        "/api/v1/addresses",
        json=payload,
    )

    assert response.status_code == 422


def test_address_rejects_extra_fields() -> None:
    """Unexpected fields should return HTTP 422."""

    payload = valid_address_payload()
    payload["user_id"] = str(USER_ID)

    response = client.post(
        "/api/v1/addresses",
        json=payload,
    )

    assert response.status_code == 422
