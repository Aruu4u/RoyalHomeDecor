"""Unit tests for offer price calculation.

These cover the money maths directly, with no database or HTTP involved,
because an error here would silently mischarge customers.
"""

import pytest

from app.services.offer_pricing import (
    MAX_DISCOUNT_PERCENT,
    apply_discount,
    is_valid_discount_percent,
    resolve_discount_percent,
    saving_paise,
)


@pytest.mark.parametrize(
    ("price_paise", "discount_percent", "expected"),
    [
        # 30% off Rs 9,999.00
        (999_900, 30, 699_930),
        # 40% off Rs 1,000.00
        (100_000, 40, 60_000),
        # A round half case: 1% of 12,345 is 123.45, so 99% is 12,221.55
        # and rounding half up gives 12,222.
        (12_345, 1, 12_222),
        # Maximum permitted discount still leaves a payable amount.
        (100_000, MAX_DISCOUNT_PERCENT, 10_000),
        # Free items stay free rather than going negative.
        (0, 50, 0),
    ],
)
def test_apply_discount_returns_expected_price(
    price_paise: int,
    discount_percent: int,
    expected: int,
) -> None:
    """Discounts round half up and never go below zero."""

    assert apply_discount(price_paise, discount_percent) == expected


@pytest.mark.parametrize(
    "discount_percent",
    [None, 0, -10, 91, 100, 1000],
)
def test_apply_discount_ignores_out_of_range_percentages(
    discount_percent: int | None,
) -> None:
    """An invalid percentage leaves the price untouched.

    Failing closed matters: a bad record should never make an item free.
    """

    assert apply_discount(500_000, discount_percent) == 500_000


def test_apply_discount_never_exceeds_original_price() -> None:
    """A discounted price is always less than or equal to the original."""

    for percent in range(1, MAX_DISCOUNT_PERCENT + 1):
        discounted = apply_discount(123_456, percent)

        assert 0 <= discounted <= 123_456


def test_saving_is_the_difference_from_the_original() -> None:
    """The saving and the charged price always reconstruct the original."""

    price_paise = 874_300
    percent = 35

    charged = apply_discount(price_paise, percent)
    saved = saving_paise(price_paise, percent)

    assert charged + saved == price_paise


@pytest.mark.parametrize(
    ("percent", "expected"),
    [
        (None, False),
        (0, False),
        (1, True),
        (45, True),
        (90, True),
        (91, False),
    ],
)
def test_is_valid_discount_percent(percent: int | None, expected: bool) -> None:
    """Only 1 to 90 inclusive counts as a usable discount."""

    assert is_valid_discount_percent(percent) is expected


class TestResolveDiscountPercent:
    """Choosing between a product offer and a section offer."""

    def test_returns_none_when_neither_applies(self) -> None:
        assert (
            resolve_discount_percent(
                product_offer_percent=None,
                section_discount_percent=None,
            )
            is None
        )

    def test_uses_the_product_offer_when_only_it_is_set(self) -> None:
        assert (
            resolve_discount_percent(
                product_offer_percent=25,
                section_discount_percent=None,
            )
            == 25
        )

    def test_uses_the_section_offer_when_only_it_is_set(self) -> None:
        assert (
            resolve_discount_percent(
                product_offer_percent=None,
                section_discount_percent=40,
            )
            == 40
        )

    def test_prefers_the_larger_discount(self) -> None:
        """The customer should always get the better of the two."""

        assert (
            resolve_discount_percent(
                product_offer_percent=15,
                section_discount_percent=40,
            )
            == 40
        )

        assert (
            resolve_discount_percent(
                product_offer_percent=50,
                section_discount_percent=20,
            )
            == 50
        )

    def test_ignores_an_invalid_candidate(self) -> None:
        """An out-of-range value is discarded, not clamped."""

        assert (
            resolve_discount_percent(
                product_offer_percent=200,
                section_discount_percent=10,
            )
            == 10
        )
