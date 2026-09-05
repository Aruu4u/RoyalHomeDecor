/* =========================================================
   CONTACT DETAILS

   Edit these to your real details. They are used by the footer
   contact panel and the "Get in touch" links.

   `digits` must include the country code and nothing else: no
   spaces, plus sign or dashes. The tel: and WhatsApp links are
   built from it, and both break if it is formatted.
   ========================================================= */

export interface PhoneNumber {
  /** Formatted for reading on screen. */
  display: string;

  /** Country code plus number, digits only. */
  digits: string;

  /** Whether this line accepts WhatsApp messages. */
  whatsapp: boolean;
}

export const CONTACT = {
  email: "hello@royalhomedecor.in",

  /* The first entry is treated as the primary line. */
  phones: [
    {
      display: "+91 98371 61566",
      digits: "919837161566",
      whatsapp: true,
    },
    {
      display: "+91 98972 83248",
      digits: "919897283248",
      whatsapp: true,
    },
  ] as PhoneNumber[],

  hours: "Mon to Sat, 10am to 7pm IST",

  workshop: "Moradabad, Uttar Pradesh, India",
} as const;

export const CONTACT_LINKS = {
  mail: `mailto:${CONTACT.email}`,
} as const;

/** `tel:` link for a number. */
export function telLink(phone: PhoneNumber): string {
  return `tel:+${phone.digits}`;
}

/** WhatsApp chat link for a number. */
export function whatsappLink(phone: PhoneNumber): string {
  return `https://wa.me/${phone.digits}`;
}

/** The line to feature first, e.g. for the WhatsApp call to action. */
export function primaryPhone(): PhoneNumber {
  return CONTACT.phones[0];
}
