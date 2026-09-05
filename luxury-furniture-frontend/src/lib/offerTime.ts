/* =========================================================
   OFFER DEADLINES

   A null end date means the offer never expires. That is also how every
   offer created before expiry existed is stored, so null must always read
   as "still running" rather than "unknown".

   Nothing here decides whether a discount applies. The server does that,
   and the price it sends is already correct. These helpers only describe a
   deadline in words, so a clock that is a few minutes out changes the
   wording and never the price.
   ========================================================= */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/** Preset lengths offered in the dashboard, in days. */
export const OFFER_DURATION_PRESETS = [1, 3, 7, 14, 30, 60, 90] as const;

/** Matches the backend's cap, so the form can stop before a 422. */
export const MAX_OFFER_DURATION_DAYS = 365;

export interface OfferDeadline {
  /** False once the end date has passed. Always true when there is none. */
  isLive: boolean;

  /** True when the offer has no end date at all. */
  neverExpires: boolean;

  /** Whole days left, rounded up. Null when it never expires. */
  daysRemaining: number | null;

  /** Short phrase for a badge, for example "3 days left". */
  shortLabel: string;

  /** Longer sentence for an admin panel, including the date. */
  longLabel: string;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Describes when an offer ends.
 *
 * `endsAt` is the ISO string the API sends, or null for an offer with no
 * end date. An unparseable value is treated as no end date: the server is
 * the authority on whether the discount applies, so refusing to render is
 * worse than omitting a countdown.
 */
export function describeOfferEnd(endsAt: string | null): OfferDeadline {
  if (!endsAt) {
    return {
      isLive: true,
      neverExpires: true,
      daysRemaining: null,
      shortLabel: "No end date",
      longLabel: "Runs until you remove it.",
    };
  }

  const end = new Date(endsAt);

  if (Number.isNaN(end.getTime())) {
    return {
      isLive: true,
      neverExpires: true,
      daysRemaining: null,
      shortLabel: "No end date",
      longLabel: "Runs until you remove it.",
    };
  }

  const remainingMs = end.getTime() - Date.now();

  if (remainingMs <= 0) {
    return {
      isLive: false,
      neverExpires: false,
      daysRemaining: 0,
      shortLabel: "Expired",
      longLabel: `Expired on ${formatDate(end)}.`,
    };
  }

  /* Rounded up, so six hours left reads as "1 day" rather than "0 days". */
  const daysRemaining = Math.ceil(remainingMs / MS_PER_DAY);

  const shortLabel =
    remainingMs < MS_PER_DAY
      ? `${Math.max(1, Math.round(remainingMs / MS_PER_HOUR))} hours left`
      : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;

  return {
    isLive: true,
    neverExpires: false,
    daysRemaining,
    shortLabel,
    longLabel: `Ends ${formatDate(end)} (${shortLabel}).`,
  };
}

/**
 * Turns a duration choice from a form into the value the API expects.
 *
 * The API distinguishes three cases, so this returns null for "never
 * expires" and a number otherwise. `"never"` is the sentinel the select
 * uses, because an empty option value cannot be told apart from unset.
 */
export function durationChoiceToDays(choice: string): number | null {
  if (choice === "never" || choice.trim() === "") {
    return null;
  }

  const days = Number.parseInt(choice, 10);

  if (Number.isNaN(days) || days < 1 || days > MAX_OFFER_DURATION_DAYS) {
    return null;
  }

  return days;
}
