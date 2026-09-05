/*
 * All customer-facing money goes through here.
 *
 * `Intl.NumberFormat` produces the rupee sign itself, so no source file
 * needs to contain the character. That matters: several admin files had a
 * literal sign that had been double-encoded somewhere along the way and
 * rendered as mojibake. A formatter cannot be corrupted by a file being
 * re-saved in the wrong encoding.
 */

const wholeRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const exactRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a price held in integer paise, rounded to whole rupees. */
export function formatPrice(pricePaise: number): string {
  return wholeRupees.format(pricePaise / 100);
}

/**
 * Formats an amount already expressed in rupees, showing paise.
 *
 * For admin forms, which work in rupees rather than paise and where an
 * exact limit is more useful than a rounded one.
 */
export function formatRupees(rupees: number): string {
  return exactRupees.format(rupees);
}
