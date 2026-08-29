export interface ServiceCard {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
}

export interface GalleryGroup {
  id: string;
  title: string;
  description: string;
  images: readonly string[];
}

export interface Collaboration {
  id: string;
  name: string;
  description: string;
  service: string;
  image: string;
}

export interface RefundSection {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
}

export interface ContactDetails {
  phone: string;
  phoneDisplay: string;
  email: string;
  address: readonly string[];
  mapQuery: string;
}

export interface SocialLink {
  label: string;
  href: string;
}

export const serviceCards: readonly ServiceCard[] = [
  {
    id: "ambient-lighting",
    title: "Ambient lighting",
    description:
      "Choose colours and lighting zones to add a customisable glow to your interior.",
    image: "/images/site/service-ambient.jpg",
    href: "/shop?category=Ambient%20lighting",
  },
  {
    id: "starlights",
    title: "Starlights",
    description:
      "Add a standard, twinkle or shooting-star effect to your roof lining.",
    image: "/images/site/gallery-stars-04.webp",
    href: "/shop?category=Starlights",
  },
  {
    id: "steering-wheels",
    title: "Custom steering wheels",
    description:
      "Personalise the part of your car you touch most with unique materials, stitching and finishes.",
    image: "/images/site/service-steering.jpeg",
    href: "/shop?category=Steering%20wheels",
  },
  {
    id: "rims-calipers",
    title: "Rims & calipers",
    description:
      "Refresh your wheels or calipers with custom colours and two-tone finishes.",
    image: "/images/products/rims-01.jpg",
    href: "/shop?category=Wheels%20%26%20calipers",
  },
  {
    id: "screen-upgrades",
    title: "Screen upgrades",
    description:
      "Upgrade to Apple CarPlay or Android Auto for smarter navigation and a sharper display.",
    image: "/images/site/service-screen.webp",
    href: "/shop?category=Screens%20%26%20CarPlay",
  },
  {
    id: "dashcams",
    title: "Dashcams",
    description:
      "Add a discreet dashcam with hidden wiring and professional fitting.",
    image: "/images/site/service-dashcam.jpg",
    href: "/shop?category=Dashcams",
  },
] as const;

export const galleryGroups: readonly GalleryGroup[] = [
  {
    id: "ambient-lighting",
    title: "Ambient lighting",
    description:
      "Hidden when switched off, our lighting systems give the cabin a clean, factory-style glow when on.",
    images: [
      "/images/site/gallery-ambient-01.jpeg",
      "/images/site/gallery-ambient-02.jpeg",
      "/images/site/gallery-ambient-03.jpg",
    ],
  },
  {
    id: "starlights",
    title: "Starlights",
    description:
      "Choose standard, twinkle or shooting-star headliners, including custom panoramic-roof options.",
    images: [
      "/images/site/gallery-stars-03.jpg",
      "/images/site/gallery-stars-04.webp",
      "/images/site/gallery-stars-05.jpg",
      "/images/site/gallery-stars-06.jpeg",
      "/images/site/gallery-stars-07.jpg",
    ],
  },
  {
    id: "steering-wheels",
    title: "Custom steering wheels",
    description:
      "Choose the materials, stitching and finish for a custom steering wheel.",
    images: [
      "/images/products/custom-steering-wheels-please-contact-first-01.jpeg",
      "/images/products/custom-steering-wheels-please-contact-first-02.jpeg",
      "/images/products/custom-steering-wheels-please-contact-first-03.jpeg",
    ],
  },
  {
    id: "rims-calipers",
    title: "Rims & calipers",
    description:
      "See recent wheel colour changes, caliper finishes and detailing work.",
    images: [
      "/images/products/rims-01.jpg",
      "/images/products/rims-02.jpg",
      "/images/products/rims-04.jpeg",
      "/images/products/calipers-01.jpeg",
      "/images/products/calipers-02.jpeg",
      "/images/products/calipers-04.jpg",
    ],
  },
  {
    id: "screen-upgrades",
    title: "Screen upgrades",
    description:
      "Responsive modern displays bring easier navigation, media and smartphone connectivity to the cabin.",
    images: [
      "/images/products/screeen-upgrade-01.jpg",
      "/images/products/screeen-upgrade-02.jpg",
      "/images/site/gallery-screen-03.webp",
    ],
  },
  {
    id: "dashcams",
    title: "Dashcams",
    description:
      "Professional installation keeps wiring hidden and the view through your windscreen uncluttered.",
    images: [
      "/images/products/dashcams-01.jpg",
      "/images/products/dashcams-02.jpg",
      "/images/products/dashcams-03.jpg",
      "/images/site/gallery-dashcam-07.jpg",
      "/images/site/gallery-dashcam-08.jpg",
    ],
  },
] as const;

export const collaborations: readonly Collaboration[] = [
  {
    id: "avi",
    name: "Avi",
    description:
      "Content creator known for the viral phrase ‘I can't lie, yeah’ and an audience of nearly 600k on TikTok.",
    service: "Bluetooth ambient lighting package with vents",
    image: "/images/site/gallery-ambient-01.jpeg",
  },
  {
    id: "laiba-ali",
    name: "Laiba Ali",
    description:
      "Founder of Umber Collections and a fashion and lifestyle creator with almost 200k followers.",
    service: "600-piece starlight package",
    image: "/images/site/gallery-stars-06.jpeg",
  },
  {
    id: "muks",
    name: "MUKS",
    description: "Creator known for his viral comedy videos and catchphrases.",
    service: "OEM ambient lighting",
    image: "/images/site/gallery-ambient-03.jpg",
  },
  {
    id: "jad-ajram",
    name: "Jad Ajram",
    description:
      "Content creator with nearly 400k followers, known for his viral hair-routine videos.",
    service: "Apple CarPlay installation",
    image: "/images/products/screeen-upgrade-01.jpg",
  },
] as const;

export const refundSections: readonly RefundSection[] = [
  {
    title: "Custom & made-to-order products",
    paragraphs: [
      "All custom work, including vinyl wraps, decals, tints, paintwork, bespoke parts and personalised designs, is non-refundable once work has started, materials have been ordered or the customer has approved the design.",
      "This reflects the bespoke nature of our services.",
    ],
  },
  {
    title: "Deposits",
    items: [
      "Deposits secure your booking, time slot and materials.",
      "Deposits are non-refundable.",
      "With sufficient notice, a deposit may be transferred to a future date at our discretion.",
    ],
  },
  {
    title: "Cancellations",
    items: [
      "A cancellation made before work starts may qualify for a partial refund, excluding the deposit.",
      "A cancellation made after work starts is not eligible for a refund.",
    ],
  },
  {
    title: "Workmanship warranty",
    paragraphs: [
      "Our workmanship is covered by a one-year warranty from the date of completion. Please contact us within that period if you believe there is a fault.",
      "If inspection confirms a workmanship fault, we will repair or correct it at no additional cost. A refund is considered only when the issue cannot reasonably be rectified.",
    ],
    items: [
      "The warranty does not cover normal wear and tear, accidental or deliberate damage, improper aftercare, road debris or weather exposure.",
      "The warranty does not cover customer-supplied parts or work affected by third-party modifications or repairs.",
    ],
  },
  {
    title: "Change of mind",
    paragraphs: [
      "Refunds are not issued for a change of mind, dissatisfaction with an approved colour, design or finish, or minor variations inherent in custom work.",
    ],
  },
  {
    title: "Statutory rights",
    paragraphs: [
      "This policy does not affect your statutory rights under UK consumer law.",
    ],
  },
] as const;

export const contactDetails: ContactDetails = {
  phone: "+447960405187",
  phoneDisplay: "07960 405187",
  email: "astarenquires@gmail.com",
  address: [
    "160–164 Brabazon Road",
    "Hounslow, London",
    "United Kingdom",
  ],
  mapQuery: "160-164 Brabazon Road, Hounslow, London, United Kingdom",
};

export const socialLinks: readonly SocialLink[] = [
  { label: "Facebook", href: "https://www.facebook.com/AStrCustoms" },
  { label: "Instagram", href: "https://www.instagram.com/a_starcustoms/" },
  { label: "TikTok", href: "https://www.tiktok.com/@a.starcustoms" },
] as const;

const whatsappMessage =
  "Welcome to A Star Customs 💫🚘 Please tell us what you'd like done to your car, including its make, model and year. Add photos if you have them and we'll reply within 24 working hours.";

const whatsappPhone = contactDetails.phone.replace(/^\+/, "");

export const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}`;
