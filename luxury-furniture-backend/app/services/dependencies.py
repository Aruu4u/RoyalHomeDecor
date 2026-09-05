from typing import Annotated

from fastapi import Depends

from app.db.dependencies import DatabaseSession
from app.services.address import AddressService
from app.services.cart import CartService
from app.services.collection import CollectionService
from app.services.inventory import InventoryService
from app.services.offer import OfferService
from app.services.product import ProductService
from app.services.product_image import ProductImageService
from app.services.product_variant import ProductVariantService
from app.services.profile import ProfileService
from app.services.review import ReviewService
from app.services.order import OrderService
from app.services.favourite import FavouriteService
from app.services.razorpay import RazorpayService


def get_collection_service(
    db: DatabaseSession,
) -> CollectionService:
    """Create a collection service for one request."""

    return CollectionService(db)


CollectionServiceDependency = Annotated[
    CollectionService,
    Depends(get_collection_service),
]


def get_product_service(
    db: DatabaseSession,
) -> ProductService:
    """Create a product service for one request."""

    return ProductService(db)


ProductServiceDependency = Annotated[
    ProductService,
    Depends(get_product_service),
]


def get_product_image_service(
    db: DatabaseSession,
) -> ProductImageService:
    """Create a product-image service for one request."""

    return ProductImageService(db)


ProductImageServiceDependency = Annotated[
    ProductImageService,
    Depends(get_product_image_service),
]


def get_product_variant_service(
    db: DatabaseSession,
) -> ProductVariantService:
    """Create a product-variant service for one request."""

    return ProductVariantService(db)


ProductVariantServiceDependency = Annotated[
    ProductVariantService,
    Depends(get_product_variant_service),
]


def get_inventory_service(
    db: DatabaseSession,
) -> InventoryService:
    """Create an inventory service for one request."""

    return InventoryService(db)


InventoryServiceDependency = Annotated[
    InventoryService,
    Depends(get_inventory_service),
]


def get_profile_service(
    db: DatabaseSession,
) -> ProfileService:
    """Create a profile service for one request."""

    return ProfileService(db)


ProfileServiceDependency = Annotated[
    ProfileService,
    Depends(get_profile_service),
]


def get_address_service(
    db: DatabaseSession,
) -> AddressService:
    """Create an address service for one request."""

    return AddressService(db)


AddressServiceDependency = Annotated[
    AddressService,
    Depends(get_address_service),
]


def get_cart_service(
    db: DatabaseSession,
) -> CartService:
    """Create a cart service for one request."""

    return CartService(db)


CartServiceDependency = Annotated[
    CartService,
    Depends(get_cart_service),
]
def get_favourite_service(
    db: DatabaseSession,
) -> FavouriteService:
    """Create a favourite service for one request."""

    return FavouriteService(db)


FavouriteServiceDependency = Annotated[
    FavouriteService,
    Depends(get_favourite_service),
]


def get_offer_service(
    db: DatabaseSession,
) -> OfferService:
    """Create an offer service for one request."""

    return OfferService(db)


OfferServiceDependency = Annotated[
    OfferService,
    Depends(get_offer_service),
]


def get_review_service(
    db: DatabaseSession,
) -> ReviewService:
    """Create a product-review service for one request."""

    return ReviewService(db)


ReviewServiceDependency = Annotated[
    ReviewService,
    Depends(get_review_service),
]


def get_order_service(
    db: DatabaseSession,
) -> OrderService:
    """Create an order service for one request."""

    return OrderService(db)


OrderServiceDependency = Annotated[
    OrderService,
    Depends(get_order_service),
]


def get_razorpay_service() -> RazorpayService:
    """Create a Razorpay API service."""

    return RazorpayService()


RazorpayServiceDependency = Annotated[
    RazorpayService,
    Depends(get_razorpay_service),
]
