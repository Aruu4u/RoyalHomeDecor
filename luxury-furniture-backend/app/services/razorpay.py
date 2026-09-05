import uuid

import httpx

from app.core.config import get_settings
from app.schemas.payment import RazorpayOrderEntity


class RazorpayService:
    """Server-side client for Razorpay APIs."""

    def __init__(self) -> None:
        self.settings = get_settings()

    async def create_order(
        self,
        *,
        internal_order_id: uuid.UUID,
        amount_paise: int,
    ) -> RazorpayOrderEntity:
        """Create a Razorpay order for an internal order."""

        payload = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": str(internal_order_id),
            "notes": {
                "internal_order_id": str(internal_order_id),
            },
        }

        try:
            async with httpx.AsyncClient(
                base_url=self.settings.razorpay_api_url,
                auth=(
                    self.settings.razorpay_key_id,
                    self.settings.razorpay_key_secret,
                ),
                timeout=15.0,
            ) as client:
                response = await client.post(
                    "/orders",
                    json=payload,
                )

                response.raise_for_status()

        except httpx.HTTPStatusError as exception:
            raise RuntimeError("Razorpay rejected the order creation request.") from exception

        except httpx.RequestError as exception:
            raise RuntimeError("Razorpay could not be reached.") from exception

        return RazorpayOrderEntity.model_validate(response.json())
