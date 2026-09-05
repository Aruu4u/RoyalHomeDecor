/* =========================================================
   SUPERSEDED

   Offers are now managed in the admin dashboard and calculated by the
   API, so there is nothing to configure here.

   This file previously held hand-written "was" prices because the
   backend had no concept of a discount. That approach had a real
   hazard: the struck-through price was invented in the frontend and was
   never what the customer was charged.

   The replacement is safer in both respects. An offer is stored against
   the product or an offer section, the discounted price is computed
   server-side, and the cart and checkout charge that same price. See
   app/services/offer_pricing.py.

   Kept as a stub only so any stale import fails loudly rather than
   silently resurrecting fake prices.
   ========================================================= */

export const PRODUCT_PROMOTIONS: Record<string, never> = {};
