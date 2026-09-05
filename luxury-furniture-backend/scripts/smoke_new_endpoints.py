"""Smoke-test every endpoint touched by the material/offer/review work.

Hits the running API over HTTP, so it covers routing, query-parameter
parsing and response serialisation together. Public endpoints only:
admin routes need a Supabase token, and those are covered by the pytest
suite plus the service-level scripts alongside this one.

Run the server first, then:
  .\\venv\\Scripts\\python.exe scripts\\smoke_new_endpoints.py
"""

import asyncio

import httpx


BASE_URL = "http://127.0.0.1:8000/api/v1"

PASS = "pass"
FAIL = "FAIL"


class Report:
    """Collects results so one failure does not stop the run."""

    def __init__(self) -> None:
        self.failures = 0

    def check(self, description: str, condition: bool, detail: str = "") -> None:
        """Record one assertion."""

        if not condition:
            self.failures += 1

        suffix = f"  ({detail})" if detail else ""

        print(f"  [{PASS if condition else FAIL}] {description}{suffix}")


async def main() -> None:
    """Exercise the changed endpoints and print a summary."""

    report = Report()

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # ---------- Product list: new fields ----------

        print("\nGET /products")

        response = await client.get("/products", params={"limit": 5})

        report.check("returns 200", response.status_code == 200)

        products = response.json()

        report.check("returns products", len(products) > 0, f"{len(products)}")

        if products:
            first = products[0]

            for field in (
                "top_material",
                "base_material",
                "finish",
                "offer_ends_at",
                "in_stock",
                "available_quantity",
                "review_count",
                "review_average",
            ):
                report.check(f"carries {field}", field in first)

            report.check(
                "no longer sends the merged 'material'",
                "material" not in first,
            )

        # ---------- Material filters ----------

        print("\nGET /products with material filters")

        if products and products[0].get("top_material"):
            wanted = products[0]["top_material"]

            filtered = await client.get(
                "/products",
                params={"top_material": wanted, "limit": 50},
            )

            report.check("top_material filter returns 200", filtered.status_code == 200)

            matched = filtered.json()

            report.check(
                "every result matches the requested top material",
                all(
                    (item.get("top_material") or "").lower() == wanted.lower()
                    for item in matched
                ),
                f"{len(matched)} results",
            )

        for parameter in ("base_material", "finish"):
            response = await client.get(
                "/products",
                params={parameter: "definitely-not-a-real-value"},
            )

            report.check(
                f"{parameter} filter accepted and narrows",
                response.status_code == 200 and response.json() == [],
            )

        # ---------- in_offer ----------

        print("\nGET /products?in_offer=true")

        on_offer = await client.get(
            "/products",
            params={"in_offer": "true", "limit": 100},
        )

        report.check("returns 200", on_offer.status_code == 200)

        discounted = on_offer.json()

        report.check(
            "every result actually carries a live discount",
            all(
                item.get("offer_discount_percent")
                and item.get("offer_price_paise")
                for item in discounted
            ),
            f"{len(discounted)} results",
        )

        report.check(
            "every offer price is below the list price",
            all(
                item["offer_price_paise"] < item["base_price_paise"]
                for item in discounted
            ),
        )

        # ---------- Ordering ----------

        print("\nGET /products ordering")

        most_sold = await client.get(
            "/products",
            params={"order_by": "most_sold", "limit": 10},
        )

        report.check("order_by=most_sold returns 200", most_sold.status_code == 200)

        report.check(
            "order_by=most_sold returns a full page",
            len(most_sold.json()) > 0,
            f"{len(most_sold.json())}",
        )

        curated = await client.get(
            "/products",
            params={"order_by": "curated", "limit": 10},
        )

        report.check("order_by=curated returns 200", curated.status_code == 200)

        rejected = await client.get("/products", params={"order_by": "cheapest"})

        report.check(
            "an unknown order_by is rejected rather than ignored",
            rejected.status_code == 422,
            f"got {rejected.status_code}",
        )

        # ---------- Offer sections ----------

        print("\nGET /offers/sections")

        sections = await client.get("/offers/sections")

        report.check("returns 200", sections.status_code == 200)

        for section in sections.json():
            for item in section["items"]:
                report.check(
                    f"'{item['product']['name'][:28]}' entry reports its window",
                    "ends_at" in item and "is_live" in item,
                )

                report.check(
                    "the storefront only shows live entries",
                    item["is_live"] is True,
                )

                report.check(
                    "offer product carries stock",
                    "in_stock" in item["product"]
                    and "available_quantity" in item["product"],
                )

                report.check(
                    "offer product carries the material split",
                    "top_material" in item["product"]
                    and "material" not in item["product"],
                )

        # ---------- Reviews ----------

        print("\nGET /products/{slug}/reviews")

        if products:
            slug = products[0]["slug"]

            reviews = await client.get(f"/products/{slug}/reviews")

            report.check("returns 200", reviews.status_code == 200)

            payload = reviews.json()

            report.check("has a summary", "summary" in payload)
            report.check("has a review list", isinstance(payload.get("reviews"), list))

            breakdown = payload.get("summary", {}).get("breakdown", {})

            report.check(
                "the breakdown covers all five stars",
                sorted(breakdown) == ["1", "2", "3", "4", "5"],
                str(sorted(breakdown)),
            )

            missing = await client.get("/products/no-such-piece/reviews")

            report.check(
                "an unknown product returns 404",
                missing.status_code == 404,
                f"got {missing.status_code}",
            )

            # Validation, without leaving anything behind.
            bad_rating = await client.post(
                f"/products/{slug}/reviews",
                json={
                    "rating": 9,
                    "author_name": "Smoke Test",
                    "body": "This should never be stored because the rating is invalid.",
                },
            )

            report.check(
                "a rating above five is rejected",
                bad_rating.status_code == 422,
                f"got {bad_rating.status_code}",
            )

            short_body = await client.post(
                f"/products/{slug}/reviews",
                json={
                    "rating": 5,
                    "author_name": "Smoke Test",
                    "body": "Nice",
                },
            )

            report.check(
                "a one-word review is rejected",
                short_body.status_code == 422,
                f"got {short_body.status_code}",
            )

        # ---------- Admin routes stay protected ----------

        print("\nAuthorisation on the new admin routes")

        for method, path in (
            ("GET", f"/offers/products/{products[0]['id']}" if products else None),
            ("DELETE", "/reviews/00000000-0000-0000-0000-000000000000"),
        ):
            if path is None:
                continue

            response = await client.request(method, path)

            report.check(
                f"{method} {path.split('/')[1]} requires authentication",
                response.status_code in {401, 403},
                f"got {response.status_code}",
            )

    print(
        f"\n{'All checks passed.' if report.failures == 0 else f'{report.failures} check(s) FAILED.'}",
    )


if __name__ == "__main__":
    asyncio.run(main())
