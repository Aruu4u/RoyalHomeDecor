"""Unit tests for offer expiry.

The boundary matters more than usual here: getting it wrong by one
comparison either charges a discount that has ended, or withdraws one
that is still running. Both are pricing bugs a customer sees.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.services.offer_pricing import (
    MAX_OFFER_DURATION_DAYS,
    apply_discount,
    is_offer_live,
    live_discount_percent,
    offer_end_from_duration,
    resolve_discount_percent,
)


NOW = datetime(2026, 9, 2, 12, 0, 0, tzinfo=UTC)


class TestIsOfferLive:
    """When an offer counts as still running."""

    def test_no_end_date_never_expires(self) -> None:
        """Null is how every offer created before expiry existed reads."""

        assert is_offer_live(None, now=NOW) is True

    def test_end_date_in_the_future_is_live(self) -> None:
        assert is_offer_live(NOW + timedelta(seconds=1), now=NOW) is True

    def test_end_date_in_the_past_is_not_live(self) -> None:
        assert is_offer_live(NOW - timedelta(seconds=1), now=NOW) is False

    def test_the_exact_end_moment_is_not_live(self) -> None:
        """The window is exclusive at the end, so "ends now" means ended.

        Chosen over inclusive because an offer advertised as running until
        midnight should not still apply at midnight.
        """

        assert is_offer_live(NOW, now=NOW) is False

    def test_a_naive_end_date_is_treated_as_utc(self) -> None:
        """Rather than raising while pricing a basket."""

        naive_future = (NOW + timedelta(days=1)).replace(tzinfo=None)
        naive_past = (NOW - timedelta(days=1)).replace(tzinfo=None)

        assert is_offer_live(naive_future, now=NOW) is True
        assert is_offer_live(naive_past, now=NOW) is False

    def test_defaults_to_the_current_time(self) -> None:
        """Called without `now` in production code paths."""

        assert is_offer_live(datetime.now(UTC) + timedelta(hours=1)) is True
        assert is_offer_live(datetime.now(UTC) - timedelta(hours=1)) is False


class TestLiveDiscountPercent:
    """Turning a stored percentage into one that currently applies."""

    def test_percentage_survives_while_the_window_is_open(self) -> None:
        assert live_discount_percent(30, None, now=NOW) == 30
        assert live_discount_percent(30, NOW + timedelta(days=1), now=NOW) == 30

    def test_expired_offer_resolves_to_nothing(self) -> None:
        """The whole point: an expired offer must stop reducing the price."""

        assert live_discount_percent(30, NOW - timedelta(days=1), now=NOW) is None

    def test_absent_percentage_stays_absent(self) -> None:
        assert live_discount_percent(None, None, now=NOW) is None


class TestOfferEndFromDuration:
    """Converting "runs for N days" into a deadline."""

    def test_none_days_means_never_expires(self) -> None:
        assert offer_end_from_duration(None, now=NOW) is None

    @pytest.mark.parametrize("days", [1, 7, 30, MAX_OFFER_DURATION_DAYS])
    def test_days_are_added_to_the_current_time(self, days: int) -> None:
        assert offer_end_from_duration(days, now=NOW) == NOW + timedelta(days=days)

    def test_the_result_is_still_live_immediately_after_creation(self) -> None:
        """A one-day offer must not be born expired."""

        ends_at = offer_end_from_duration(1, now=NOW)

        assert is_offer_live(ends_at, now=NOW) is True

    def test_the_result_has_expired_once_the_duration_passes(self) -> None:
        ends_at = offer_end_from_duration(3, now=NOW)

        assert is_offer_live(ends_at, now=NOW + timedelta(days=3)) is False

    def test_a_naive_reference_time_is_treated_as_utc(self) -> None:
        ends_at = offer_end_from_duration(2, now=NOW.replace(tzinfo=None))

        assert ends_at is not None
        assert ends_at.tzinfo is UTC


class TestExpiryReachesThePrice:
    """The combination the customer actually experiences."""

    def test_an_expired_product_offer_leaves_the_price_untouched(self) -> None:
        price = 999_900

        percent = live_discount_percent(
            30,
            NOW - timedelta(minutes=1),
            now=NOW,
        )

        assert apply_discount(price, percent) == price

    def test_a_live_section_offer_still_wins_when_the_own_offer_expired(
        self,
    ) -> None:
        """Expiry is per source, so one ending does not cancel the other."""

        effective = resolve_discount_percent(
            product_offer_percent=live_discount_percent(
                50,
                NOW - timedelta(days=1),
                now=NOW,
            ),
            section_discount_percent=20,
        )

        assert effective == 20

    def test_nothing_applies_once_every_source_has_expired(self) -> None:
        effective = resolve_discount_percent(
            product_offer_percent=live_discount_percent(
                50,
                NOW - timedelta(days=1),
                now=NOW,
            ),
            section_discount_percent=None,
        )

        assert effective is None
        assert apply_discount(999_900, effective) == 999_900
