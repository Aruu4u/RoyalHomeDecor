"""Offer theme helpers.

The theme is free text so administrators can name their own occasions.
These constants exist only as convenient defaults and suggestions; the
database accepts any short label, and the storefront falls back to the
colours stored on the section for anything it does not recognise.
"""

DEFAULT_OFFER_THEME = "custom"

MAX_THEME_LENGTH = 40

# Values the storefront has a built-in colour preset for. Offered as
# suggestions in the dashboard; not a restriction.
SUGGESTED_OFFER_THEMES: tuple[str, ...] = (
    "diwali",
    "holi",
    "christmas",
    "new-year",
    "summer",
    "monsoon",
    "wedding",
    "clearance",
    "custom",
)


def normalise_theme(value: str) -> str:
    """Reduce a typed theme name to a stable lookup key.

    ``"Diwali Special"`` and ``"diwali special"`` both become
    ``"diwali-special"``, so styling presets match regardless of how the
    administrator capitalised or spaced the name.
    """

    cleaned = value.strip().lower()

    # Collapse anything that is not a letter or digit into single hyphens.
    result: list[str] = []
    previous_was_separator = False

    for character in cleaned:
        if character.isalnum():
            result.append(character)
            previous_was_separator = False
        elif not previous_was_separator:
            result.append("-")
            previous_was_separator = True

    return "".join(result).strip("-")[:MAX_THEME_LENGTH]
