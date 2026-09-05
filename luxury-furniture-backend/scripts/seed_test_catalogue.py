from __future__ import annotations

import getpass
import os
import sys
from typing import Any

import httpx


API_BASE_URL = os.getenv(
    "SEED_API_BASE_URL",
    "http://127.0.0.1:8000/api/v1",
).rstrip("/")


COLLECTIONS = [
    {
        "name": "Mirrors",
        "slug": "mirrors",
        "short_description": (
            "Elegant mirrors created for refined and modern interiors."
        ),
        "description": (
            "A curated collection of decorative mirrors designed to add "
            "light, depth, and character to luxury interiors."
        ),
        "hero_image_url": (
            "https://placehold.co/1600x900/eee7df/2c241f"
            "?text=Mirrors"
        ),
        "display_order": 1,
        "is_active": True,
    },
    {
        "name": "Wall Decor",
        "slug": "wall-decor",
        "short_description": (
            "Distinctive wall pieces for beautifully styled spaces."
        ),
        "description": (
            "A selection of statement wall dÃ©cor designed to bring texture, "
            "artistry, and personality to every room."
        ),
        "hero_image_url": (
            "https://placehold.co/1600x900/e8e0d7/2c241f"
            "?text=Wall+Decor"
        ),
        "display_order": 2,
        "is_active": True,
    },
    {
        "name": "Tables",
        "slug": "tables",
        "short_description": (
            "Luxury side and centre tables for sophisticated interiors."
        ),
        "description": (
            "A carefully designed collection of side and centre tables "
            "combining elegant materials with practical everyday use."
        ),
        "hero_image_url": (
            "https://placehold.co/1600x900/e5ddd4/2c241f"
            "?text=Tables"
        ),
        "display_order": 3,
        "is_active": True,
    },
]


PRODUCTS = {
    "mirrors": [
        {
            "name": "Arched Brass Mirror",
            "slug": "arched-brass-mirror",
            "sku": "MIR-ARCH-BRASS",
            "price": 1299900,
            "material": "Brass and glass",
            "colour": "Antique gold",
            "style": "Modern classic",
            "size": "90 Ã— 120 cm",
            "length": 90,
            "width": 4,
            "height": 120,
            "weight": 8500,
        },
        {
            "name": "Ribbed Oval Mirror",
            "slug": "ribbed-oval-mirror",
            "sku": "MIR-RIB-OVAL",
            "price": 899900,
            "material": "Metal and glass",
            "colour": "Matte black",
            "style": "Contemporary",
            "size": "70 Ã— 100 cm",
            "length": 70,
            "width": 4,
            "height": 100,
            "weight": 6500,
        },
        {
            "name": "Sunburst Gold Mirror",
            "slug": "sunburst-gold-mirror",
            "sku": "MIR-SUN-GOLD",
            "price": 749900,
            "material": "Iron and glass",
            "colour": "Gold",
            "style": "Art deco",
            "size": "85 Ã— 85 cm",
            "length": 85,
            "width": 5,
            "height": 85,
            "weight": 5200,
        },
        {
            "name": "Minimal Round Mirror",
            "slug": "minimal-round-mirror",
            "sku": "MIR-MIN-ROUND",
            "price": 649900,
            "material": "Aluminium and glass",
            "colour": "Champagne",
            "style": "Minimalist",
            "size": "80 Ã— 80 cm",
            "length": 80,
            "width": 3,
            "height": 80,
            "weight": 4800,
        },
        {
            "name": "Carved Wooden Mirror",
            "slug": "carved-wooden-mirror",
            "sku": "MIR-CARVED-WOOD",
            "price": 1099900,
            "material": "Mango wood and glass",
            "colour": "Walnut brown",
            "style": "Heritage",
            "size": "75 Ã— 110 cm",
            "length": 75,
            "width": 6,
            "height": 110,
            "weight": 9200,
        },
    ],
    "wall-decor": [
        {
            "name": "Golden Leaf Wall Art",
            "slug": "golden-leaf-wall-art",
            "sku": "WAL-GOLD-LEAF",
            "price": 459900,
            "material": "Iron",
            "colour": "Antique gold",
            "style": "Botanical",
            "size": "110 Ã— 60 cm",
            "length": 110,
            "width": 5,
            "height": 60,
            "weight": 3200,
        },
        {
            "name": "Abstract Metal Wall Panel",
            "slug": "abstract-metal-wall-panel",
            "sku": "WAL-ABS-METAL",
            "price": 529900,
            "material": "Powder-coated iron",
            "colour": "Black and gold",
            "style": "Abstract",
            "size": "120 Ã— 65 cm",
            "length": 120,
            "width": 6,
            "height": 65,
            "weight": 4100,
        },
        {
            "name": "Textured Stone Wall Disc",
            "slug": "textured-stone-wall-disc",
            "sku": "WAL-STONE-DISC",
            "price": 389900,
            "material": "Resin composite",
            "colour": "Sand beige",
            "style": "Organic modern",
            "size": "70 Ã— 70 cm",
            "length": 70,
            "width": 8,
            "height": 70,
            "weight": 3900,
        },
        {
            "name": "Geometric Wooden Wall Set",
            "slug": "geometric-wooden-wall-set",
            "sku": "WAL-GEO-WOOD",
            "price": 419900,
            "material": "Mango wood",
            "colour": "Natural brown",
            "style": "Geometric",
            "size": "Set of 3",
            "length": 90,
            "width": 5,
            "height": 55,
            "weight": 3500,
        },
        {
            "name": "Floral Brass Wall Sculpture",
            "slug": "floral-brass-wall-sculpture",
            "sku": "WAL-FLORAL-BRASS",
            "price": 599900,
            "material": "Brass-finished iron",
            "colour": "Brushed brass",
            "style": "Luxury floral",
            "size": "100 Ã— 65 cm",
            "length": 100,
            "width": 7,
            "height": 65,
            "weight": 4600,
        },
    ],
    "tables": [
        {
            "name": "Marble Top Side Table",
            "slug": "marble-top-side-table",
            "sku": "TAB-MARBLE-SIDE",
            "price": 849900,
            "material": "Marble and brass",
            "colour": "White and gold",
            "style": "Modern luxury",
            "size": "45 Ã— 45 Ã— 55 cm",
            "length": 45,
            "width": 45,
            "height": 55,
            "weight": 11500,
        },
        {
            "name": "Fluted Walnut Side Table",
            "slug": "fluted-walnut-side-table",
            "sku": "TAB-FLUTED-WAL",
            "price": 699900,
            "material": "Mango wood",
            "colour": "Walnut brown",
            "style": "Contemporary",
            "size": "42 Ã— 42 Ã— 52 cm",
            "length": 42,
            "width": 42,
            "height": 52,
            "weight": 7800,
        },
        {
            "name": "Round Brass Centre Table",
            "slug": "round-brass-centre-table",
            "sku": "TAB-ROUND-BRASS",
            "price": 1499900,
            "material": "Brass and tempered glass",
            "colour": "Antique gold",
            "style": "Art deco",
            "size": "90 Ã— 90 Ã— 42 cm",
            "length": 90,
            "width": 90,
            "height": 42,
            "weight": 17500,
        },
        {
            "name": "Travertine Centre Table",
            "slug": "travertine-centre-table",
            "sku": "TAB-TRAV-CENTRE",
            "price": 1699900,
            "material": "Travertine stone",
            "colour": "Natural beige",
            "style": "Organic modern",
            "size": "100 Ã— 60 Ã— 38 cm",
            "length": 100,
            "width": 60,
            "height": 38,
            "weight": 28000,
        },
        {
            "name": "Nested Black Metal Tables",
            "slug": "nested-black-metal-tables",
            "sku": "TAB-NEST-BLACK",
            "price": 949900,
            "material": "Iron and glass",
            "colour": "Matte black",
            "style": "Industrial luxury",
            "size": "Set of 2",
            "length": 60,
            "width": 60,
            "height": 50,
            "weight": 13500,
        },
    ],
}


def create_product_payload(
    collection_id: str,
    product: dict[str, Any],
) -> dict[str, Any]:
    image_text = product["name"].replace(" ", "+")

    image_url = (
        "https://placehold.co/900x1100/eee7df/2c241f"
        f"?text={image_text}"
    )

    return {
        "collection_id": collection_id,
        "name": product["name"],
        "slug": product["slug"],
        "short_description": (
            f"A refined {product['name'].lower()} designed for elegant interiors."
        ),
        "description": (
            f"The {product['name']} combines premium materials, considered "
            "proportions, and timeless styling. It is designed to complement "
            "modern luxury homes while remaining practical for everyday use."
        ),
        "base_price_paise": product["price"],
        "material": product["material"],
        "colour": product["colour"],
        "style": product["style"],
        "thumbnail_url": image_url,
        "is_active": True,
        "is_recommended": False,
        "images": [
            {
                "image_url": image_url,
                "alt_text": product["name"],
                "display_order": 0,
                "is_primary": True,
            }
        ],
        "variants": [
            {
                "sku": product["sku"],
                "name": "Standard",
                "size_label": product["size"],
                "colour": product["colour"],
                "material": product["material"],
                "price_paise": product["price"],
                "length_cm": product["length"],
                "width_cm": product["width"],
                "height_cm": product["height"],
                "weight_grams": product["weight"],
                "is_active": True,
                "inventory": {
                    "quantity_on_hand": 10,
                    "reserved_quantity": 0,
                    "low_stock_threshold": 3,
                },
            }
        ],
    }


def request_json(
    client: httpx.Client,
    method: str,
    endpoint: str,
    *,
    payload: dict[str, Any] | None = None,
) -> Any:
    response = client.request(
        method,
        f"{API_BASE_URL}{endpoint}",
        json=payload,
    )

    if response.status_code >= 400:
        print(
            f"\nRequest failed: {method} {endpoint}",
            file=sys.stderr,
        )
        print(
            f"Status: {response.status_code}",
            file=sys.stderr,
        )
        print(response.text, file=sys.stderr)

        response.raise_for_status()

    if response.status_code == 204:
        return None

    return response.json()


def main() -> None:
    print(f"API: {API_BASE_URL}")
    print(
        "Paste your temporary Supabase access token below.\n"
        "It will not be displayed while typing."
    )

    access_token = getpass.getpass("Access token: ").strip()

    if not access_token:
        raise SystemExit("An access token is required.")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    with httpx.Client(
        headers=headers,
        timeout=30,
    ) as client:
        existing_collections = request_json(
            client,
            "GET",
            "/collections?limit=100&active_only=false",
        )

        collections_by_slug = {
            collection["slug"]: collection
            for collection in existing_collections
        }

        for collection_payload in COLLECTIONS:
            slug = collection_payload["slug"]

            if slug in collections_by_slug:
                print(f"Collection already exists: {slug}")
                continue

            created_collection = request_json(
                client,
                "POST",
                "/collections",
                payload=collection_payload,
            )

            collections_by_slug[slug] = created_collection
            print(f"Created collection: {slug}")

        existing_products = request_json(
            client,
            "GET",
            "/products?limit=100&active_only=false",
        )

        existing_product_slugs = {
            product["slug"]
            for product in existing_products
        }

        created_count = 0
        skipped_count = 0

        for collection_slug, products in PRODUCTS.items():
            collection = collections_by_slug.get(
                collection_slug,
            )

            if not collection:
                print(
                    f"Collection was not found: {collection_slug}",
                    file=sys.stderr,
                )
                continue

            for product in products:
                product_slug = product["slug"]

                if product_slug in existing_product_slugs:
                    print(
                        f"Skipped existing product: {product_slug}"
                    )
                    skipped_count += 1
                    continue

                payload = create_product_payload(
                    collection["id"],
                    product,
                )

                request_json(
                    client,
                    "POST",
                    "/products",
                    payload=payload,
                )

                existing_product_slugs.add(product_slug)
                created_count += 1

                print(
                    f"Created: {collection_slug} / "
                    f"{product['name']}"
                )

        print("\nCatalogue seeding finished.")
        print(f"Products created: {created_count}")
        print(f"Products skipped: {skipped_count}")


if __name__ == "__main__":
    main()