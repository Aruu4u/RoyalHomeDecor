"""Offer price calculation.

Every discount in the system is applied through this module. The
storefront, the cart and checkout all call the same functions, so the
price a customer is shown can never drift from the price they are
charged.

Money is handled entirely in integer paise. No floats are used, because
binary floating point cannot represent decimal currency exactly and the
rounding error compounds across a basket.
"""

from datetime import UTC, datetime, timedelta


MIN_DISCOUNT_PERCENT = 1

# A ceiling guards against a typo such as 100 making items free, and
# against a negative price. It matches the database check constraints.
MAX_DISCOUNT_PERCENT = 90

# Upper bound on an offer's length, in days. A five-year "limited time"
# offer is a data-entry mistake, not a promotion.
MAX_OFFER_DURATION_DAYS = 365


def is_offer_live(
    ends_at: datetime | None,
    *,
    now: datetime | None = None,
) -> bool:
    """Return whether an offer ending at ``ends_at`` still applies.

    ``None`` means the offer never expires, which is also how every offer
    created before expiry existed is stored.

    A naive ``ends_at`` is treated as UTC rather than rejected: the column
    is ``timestamptz`` so this only arises for values constructed in
    memory, and guessing the wrong timezone is preferable to raising while
    pricing a basket.
    """

    if ends_at is None:
        return True

    reference = now or datetime.now(UTC)

    if ends_at.tzinfo is None:
        ends_at = ends_at.replace(tzinfo=UTC)

    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=UTC)

    return ends_at > reference


def offer_end_from_duration(
    duration_days: int | None,
    *,
    now: datetime | None = None,
) -> datetime | None:
    """Turn "runs for N days" into the timestamp the offer ends.

    ``None`` days means the offer never expires and yields ``None``.

    Resolving this on the server rather than accepting a date from the
    client means the deadline cannot be shifted by a wrong device clock,
    and it is fixed at the moment the offer is saved rather than drifting
    each time the record is touched.
    """

    if duration_days is None:
        return None

    reference = now or datetime.now(UTC)

    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=UTC)

    return reference + timedelta(days=duration_days)


def live_discount_percent(
    discount_percent: int | None,
    ends_at: datetime | None,
    *,
    now: datetime | None = None,
) -> int | None:
    """Return ``discount_percent`` only while its window is still open.

    An expired offer resolves to ``None``, so it stops affecting the price
    everywhere rather than only where it happens to be displayed.
    """

    if discount_percent is None:
        return None

    if not is_offer_live(ends_at, now=now):
        return None

    return discount_percent


def is_valid_discount_percent(discount_percent: int | None) -> bool:
    """Return whether a percentage is inside the permitted range."""

    if discount_percent is None:
        return False

    return MIN_DISCOUNT_PERCENT <= discount_percent <= MAX_DISCOUNT_PERCENT


def apply_discount(
    price_paise: int,
    discount_percent: int | None,
) -> int:
    """Return ``price_paise`` reduced by ``discount_percent``.

    Rounds half up to the nearest paise using integer arithmetic. A
    percentage outside the valid range leaves the price untouched rather
    than raising, so a bad record can never make an item free.
    """

    if not is_valid_discount_percent(discount_percent):
        return price_paise

    if price_paise <= 0:
        return price_paise

    # discount_percent is known valid here, so it is not None.
    remaining_percent = 100 - int(discount_percent)  # type: ignore[arg-type]

    # +50 before the integer division rounds half up.
    return (price_paise * remaining_percent + 50) // 100


def resolve_discount_percent(
    *,
    product_offer_percent: int | None,
    section_discount_percent: int | None,
) -> int | None:
    """Pick which discount applies to a product.

    A product can carry its own offer and also sit in an active offer
    section. The larger percentage wins, so the customer always receives
    the better of the two rather than whichever happened to be checked
    first.

    Returns ``None`` when neither source provides a usable discount.
    """

    candidates = [
        percent
        for percent in (product_offer_percent, section_discount_percent)
        if is_valid_discount_percent(percent)
    ]

    if not candidates:
        return None

    return max(candidates)


def saving_paise(
    price_paise: int,
    discount_percent: int | None,
) -> int:
    """Return how much is taken off ``price_paise``."""

    return price_paise - apply_discount(price_paise, discount_percent)
