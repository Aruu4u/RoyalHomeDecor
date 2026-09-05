import type { ReactNode } from "react";

import type { AccordionItem } from "../../components/ui/Accordion";

/* =========================================================
   Static marketing content for the home page.

   Kept out of the page component so the page file stays about
   layout and data, and so this content can be swapped without
   touching any logic.
   ========================================================= */

export interface TrustPoint {
  icon: ReactNode;
  title: string;
  description: string;
}

const iconProps = {
  fill: "none",
  height: 22,
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.5,
  viewBox: "0 0 24 24",
  width: 22,
};

export const TRUST_POINTS: TrustPoint[] = [
  {
    icon: (
      <svg {...iconProps}>
        <path d="M3 8h13v9H3z" />
        <path d="M16 11h3.4l1.6 3v3H16z" />
        <circle cx="6.5" cy="18" r="1.6" />
        <circle cx="17.5" cy="18" r="1.6" />
      </svg>
    ),
    title: "Free shipping over \u20B9500",
    description: "Crated and insured, delivered anywhere in India.",
  },
  {
    icon: (
      <svg {...iconProps}>
        <path d="M12 3l7 3v5.5c0 4-2.9 7.4-7 8.5-4.1-1.1-7-4.5-7-8.5V6z" />
        <path d="M9.2 12.2l2 2 3.6-3.8" />
      </svg>
    ),
    title: "Secure online payment",
    description: "Encrypted checkout with every major payment method.",
  },
  {
    icon: (
      <svg {...iconProps}>
        <path d="M4 12a8 8 0 1 1 2.6 5.9" />
        <path d="M4 20v-4h4" />
      </svg>
    ),
    title: "3-day easy returns",
    description: "Not right for the room? Start a return within 3 days.",
  },
  {
    icon: (
      <svg {...iconProps}>
        <path d="M12 3.5l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z" />
      </svg>
    ),
    title: "Genuinely handmade",
    description: "Finished by artisan families, not production lines.",
  },
];

export interface Testimonial {
  name: string;
  location: string;
  rating: number;
  quote: string;
  product: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Priya Sharma",
    location: "Mumbai",
    rating: 5,
    quote:
      "The marble is far heavier and cooler to the touch than I expected from photographs. It has completely changed how the living room reads.",
    product: "White Marble Nesting Tables",
  },
  {
    name: "Rahul Mehta",
    location: "Delhi",
    rating: 5,
    quote:
      "The brass finish matches the listing exactly. Guests assume it came from a designer showroom, and I am happy to let them think so.",
    product: "Gold Geometric Coffee Table",
  },
  {
    name: "Anjali Verma",
    location: "Bengaluru",
    rating: 5,
    quote:
      "You can feel that it is handmade. The stone has real veining rather than a printed pattern, which was exactly what I was hoping for.",
    product: "Gold Round Marble Side Table",
  },
  {
    name: "Arjun Nair",
    location: "Kochi",
    rating: 5,
    quote:
      "Ours came out with a river pattern that looks like landscape painting. It arrived level, solid, and with no wobble at all.",
    product: "Epoxy River Coffee Table",
  },
  {
    name: "Kavitha Reddy",
    location: "Chennai",
    rating: 5,
    quote:
      "Packaging was better than furniture I have bought at three times the price. Not a single scuff anywhere on the frame.",
    product: "Lotus Metal Wall Art",
  },
  {
    name: "Rohit Bansal",
    location: "Gurugram",
    rating: 5,
    quote:
      "The wood suspended in the resin genuinely looks like it is floating. It has become the piece everyone comments on first.",
    product: "Black Epoxy Round Table",
  },
  {
    name: "Sneha Kapoor",
    location: "Hyderabad",
    rating: 5,
    quote:
      "Bought this for my parents' anniversary. The crate it arrived in was so well made they assumed it had come from a luxury showroom.",
    product: "White Marble Nesting Tables",
  },
  {
    name: "Vikram Singh",
    location: "Pune",
    rating: 5,
    quote:
      "Sturdy and genuinely heavy, which is how you can tell the stone is real. It has not shifted or wobbled once since it was set down.",
    product: "Gold Marble Side Table",
  },
  {
    name: "Nisha Malhotra",
    location: "Chandigarh",
    rating: 5,
    quote:
      "The clock is a piece of art that happens to tell the time. The movement is completely silent, which I did not expect at this price.",
    product: "Gold Grid Metal Wall Clock",
  },
  {
    name: "Manish Gupta",
    location: "Jaipur",
    rating: 4,
    quote:
      "Delivery took two days longer than the estimate, but the piece itself is beautiful and the brass finish is exactly as photographed.",
    product: "Gold Square Nesting Tables",
  },
  {
    name: "Lakshmi Devi",
    location: "Visakhapatnam",
    rating: 5,
    quote:
      "My third order now, and the finish has been consistent every time. That reliability is why I keep coming back rather than shopping around.",
    product: "Gold Round Marble Side Table",
  },
  {
    name: "Suresh Pillai",
    location: "Thiruvananthapuram",
    rating: 5,
    quote:
      "Two side tables, both flawless out of the crate. The marble tops are smooth right to the edges with no chipping anywhere.",
    product: "Gold Marble Side Table Set",
  },
  {
    name: "Ritu Agarwal",
    location: "Noida",
    rating: 5,
    quote:
      "The teal and gold against my accent wall looks like it was made for the room. Sturdy, and the mounting hardware was included.",
    product: "Ginkgo Leaves Metal Wall Art",
  },
  {
    name: "Ganesh Babu",
    location: "Madurai",
    rating: 5,
    quote:
      "Every guest asks where the table came from. The smoke-toned resin catches the light differently through the day, which I did not anticipate.",
    product: "Live Edge Epoxy Coffee Table",
  },
  {
    name: "Divya Nambiar",
    location: "Thrissur",
    rating: 4,
    quote:
      "Beautiful piece and well packed. I would have liked a few more fixing options for the wall mount, but it went up securely in the end.",
    product: "Floral Bloom Metal Mirror",
  },
];

export const FAQ_ITEMS: AccordionItem[] = [
  {
    question: "Is the marble real stone?",
    answer:
      "Yes. Every top is cut from natural stone, so veining, tone and pattern vary between pieces. That variation is a property of the material, not a defect, and it means no two orders are identical.",
  },
  {
    question: "How long does delivery take?",
    answer:
      "Most in-stock pieces leave the workshop within two working days and reach metro addresses in three to six days. Larger tables travel by surface freight and can take slightly longer to reach smaller towns.",
  },
  {
    question: "What does shipping cost?",
    answer:
      "Shipping is free once your basket passes \u20B9500. Below that a flat \u20B950 is added at checkout, and the exact figure is always shown before you confirm the order.",
  },
  {
    question: "Does the furniture need assembly?",
    answer:
      "Very little. Tables ship with the frame assembled and the top separate, protected in its own layer of crating. Fitting the top takes a few minutes and needs no tools beyond what is in the box.",
  },
  {
    question: "Can I return a piece?",
    answer:
      "You have three days from delivery to start a return. Keep the original crate, since stone and glass need it to travel back safely, and get in touch as soon as you know so we can arrange collection.",
  },
  {
    question: "How do I look after marble and brass?",
    answer:
      "Wipe marble with a damp, soft cloth and blot spills quickly, especially anything acidic like citrus or wine. Brass can be dusted dry; if you prefer the original bright finish, an occasional buff with a brass cloth restores it.",
  },
];
