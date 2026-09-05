import { ApiError } from "../services/api";

/* =========================================================
   ERROR CLASSIFICATION AND PLAIN-LANGUAGE MESSAGES

   Two jobs:

   1. Decide whether a failure is the shopper's connection, something
      they can fix, or a fault on our side.
   2. Make sure nothing technical ever reaches the screen. Status
      codes, identifiers, field paths, stack traces and internal words
      like "variant" or "inventory" all get rewritten or dropped.
   ========================================================= */

export type ErrorKind =
  /** No usable internet connection. */
  | "offline"
  /** Our servers failed, or something crashed. Not the shopper's doing. */
  | "service"
  /** Needs signing in. */
  | "auth"
  /** The thing they asked for is not there. */
  | "missing"
  /** Actionable: out of stock, empty cart, duplicate, and similar. */
  | "blocked"
  /** Something they typed needs correcting. */
  | "input";

export interface ClassifiedError {
  kind: ErrorKind;
  message: string;
}

const UUID_PATTERN =
  /['"]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]?/gi;

/*
 * Rewrites for the specific messages the API produces. Ordered: the
 * first match wins, so more specific patterns come first.
 */
const REWRITES: Array<{ test: RegExp; replace: (match: RegExpMatchArray) => string }> = [
  {
    test: /only\s+(\d+)\s+units?\s+are\s+available/i,
    replace: (match) =>
      `Only ${match[1]} left in stock. Please lower the quantity.`,
  },
  {
    test: /requested quantity exceeds available stock/i,
    replace: () => "We do not have that many in stock right now.",
  },
  {
    test: /inventory is not available/i,
    replace: () => "That option is out of stock at the moment.",
  },
  {
    test: /variant .* was not found|product variant .* not found/i,
    replace: () => "That option is no longer available.",
  },
  {
    test: /variant .* is not available|this product variant is not available/i,
    replace: () => "That option is not available to order.",
  },
  {
    test: /your cart is empty/i,
    replace: () => "Your cart is empty.",
  },
  {
    test: /address .* was not found/i,
    replace: () => "We could not find that delivery address.",
  },
  {
    test: /a profile already exists/i,
    replace: () => "Your details are already saved.",
  },
  {
    test: /a profile has not been created/i,
    replace: () => "Please add your name and number to continue.",
  },
  {
    test: /already in your favourites/i,
    replace: () => "That piece is already in your favourites.",
  },
  {
    test: /this product is not currently available/i,
    replace: () => "That piece is not available right now.",
  },
  {
    test: /favourite product .* was not found/i,
    replace: () => "That piece was not in your favourites.",
  },
  {
    test: /order status cannot change/i,
    replace: () => "That change is not allowed at this stage of the order.",
  },
  {
    test: /order .* was not found/i,
    replace: () => "We could not find that order.",
  },
];

/** Strips identifiers and internal vocabulary out of a message. */
function sanitize(message: string): string {
  const withoutIds = message.replace(UUID_PATTERN, "this item");

  for (const rewrite of REWRITES) {
    const match = withoutIds.match(rewrite.test);

    if (match) {
      return rewrite.replace(match);
    }
  }

  /*
   * Anything still mentioning internals, or that looks like a validation
   * path such as "body.phone: ...", is replaced wholesale rather than
   * risking leaking it.
   */
  if (/variant|inventory|paise|uuid|body\.|query\.|null|undefined/i.test(withoutIds)) {
    return "Please check the details and try again.";
  }

  return withoutIds;
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Classifies any thrown value and produces a shopper-safe message. */
export function classifyError(error: unknown): ClassifiedError {
  if (isOffline()) {
    return {
      kind: "offline",
      message: "You appear to be offline.",
    };
  }

  if (error instanceof ApiError) {
    /* status 0 is set by the client when the request never left. */
    if (error.status === 0) {
      return {
        kind: "offline",
        message: "We could not reach the store.",
      };
    }

    if (error.status >= 500 || error.status === 503) {
      return {
        kind: "service",
        message: "The store is having a moment.",
      };
    }

    if (error.status === 401 || error.status === 403) {
      return {
        kind: "auth",
        message: "Please sign in to continue.",
      };
    }

    if (error.status === 404) {
      return {
        kind: "missing",
        message: sanitize(error.message),
      };
    }

    if (error.status === 409) {
      return {
        kind: "blocked",
        message: sanitize(error.message),
      };
    }

    if (error.status === 422 || error.status === 400) {
      return {
        kind: "input",
        message: "Please check the details and try again.",
      };
    }

    return { kind: "service", message: "The store is having a moment." };
  }

  /* Anything unrecognised is treated as our fault, never the shopper's. */
  return { kind: "service", message: "The store is having a moment." };
}

/** Convenience: a message safe to render inline. */
export function friendlyMessage(error: unknown, fallback?: string): string {
  const classified = classifyError(error);

  if (classified.kind === "service" && fallback) {
    return fallback;
  }

  return classified.message;
}

/**
 * True when the failure is ours to fix, meaning the shopper should see
 * the full-page notice rather than an inline warning.
 */
export function isServiceFault(error: unknown): boolean {
  return classifyError(error).kind === "service";
}

export function isOfflineError(error: unknown): boolean {
  return classifyError(error).kind === "offline";
}
