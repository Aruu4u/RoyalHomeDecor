from fastapi import APIRouter

from app.api.v1.routes.collections import router as collections_router
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.products import router as products_router
from app.api.v1.routes.product_images import (
    router as product_images_router,
)
from app.api.v1.routes.product_variants import (
    router as product_variants_router,
)
from app.api.v1.routes.inventory import router as inventory_router
from app.api.v1.routes.addresses import router as addresses_router
from app.api.v1.routes.profile import router as profile_router
from app.api.v1.routes.cart import router as cart_router
from app.api.v1.routes.orders import router as orders_router
from app.api.v1.routes.admin_orders import (
    router as admin_orders_router,
)
from app.api.v1.routes.favourites import (
    router as favourites_router,
)
from app.api.v1.routes.offers import router as offers_router
from app.api.v1.routes.reviews import router as reviews_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(collections_router)
api_router.include_router(products_router)
api_router.include_router(product_images_router)
api_router.include_router(product_variants_router)
api_router.include_router(inventory_router)
api_router.include_router(profile_router)
api_router.include_router(addresses_router)
api_router.include_router(cart_router)
api_router.include_router(orders_router)
api_router.include_router(admin_orders_router)
api_router.include_router(favourites_router)
api_router.include_router(offers_router)
api_router.include_router(reviews_router)