export type LocalPage = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  points: string[];
  primaryCta: string;
  primaryHref: string;
  secondaryCta: string;
  secondaryHref: string;
};

export const LOCAL_PAGES: LocalPage[] = [
  {
    slug: "bay-area-hvac-supply",
    title: "Bay Area HVAC Supply - Newark TCL Heat Pumps & Mini Splits",
    description:
      "Bay Area TCL HVAC supply from Newark, CA with homeowner equipment guidance, contractor will-call, local delivery coordination, and spec support.",
    eyebrow: "Bay Area HVAC supply",
    h1: "TCL heat pumps and mini splits supplied locally from Newark.",
    intro:
      "Summit supports Bay Area homeowners buying one system, property teams comparing equipment, and contractors who need stock, documents, and fast pickup.",
    points: [
      "Newark will-call hub for contractors and project teams.",
      "Homeowner-friendly equipment guidance before installer referral.",
      "Local delivery coordination for eligible Bay Area jobs.",
    ],
    primaryCta: "Buying one for your home?",
    primaryHref: "/homeowners",
    secondaryCta: "Contractor account",
    secondaryHref: "/dealers",
  },
  {
    slug: "bay-area-mini-split-supply",
    title: "Bay Area Mini Split Supply - TCL Ductless Systems",
    description:
      "Shop TCL mini splits for Bay Area homes, ADUs, additions, and contractor jobs with local supply from Newark, CA.",
    eyebrow: "Bay Area mini split supply",
    h1: "Mini split equipment help for Bay Area homes and job sites.",
    intro:
      "A single-room mini split, ADU, or multi-zone project should not require trade-counter vocabulary just to start. We help identify the likely equipment lane and connect installation questions to qualified contractors.",
    points: [
      "Good fit for ADUs, additions, bedrooms, offices, and spot comfort problems.",
      "Ask about one system without knowing the exact SKU.",
      "Contractors can still search models and documents directly.",
    ],
    primaryCta: "Find the right system",
    primaryHref: "/homeowners#homeowner-request",
    secondaryCta: "Shop systems",
    secondaryHref: "/products?category=ductless",
  },
  {
    slug: "bay-area-heat-pump-installer-help",
    title: "Bay Area Heat Pump Installer Help - TCL Equipment Guidance",
    description:
      "Need a Bay Area installer for a TCL heat pump or mini split? Summit supplies equipment and helps homeowners prepare for qualified contractor follow-up.",
    eyebrow: "Installer help",
    h1: "Need this installed? Start with the right equipment questions.",
    intro:
      "Summit does not install equipment. We help homeowners collect the details a Bay Area HVAC contractor needs to size, quote, and install the system correctly.",
    points: [
      "Share ZIP, rooms, ducts, timeline, and rebate interest.",
      "We help clarify equipment and document questions before purchase.",
      "A qualified installer confirms sizing, permits, labor, and startup.",
    ],
    primaryCta: "Get installer help",
    primaryHref: "/homeowners#homeowner-request",
    secondaryCta: "What homeowners should know",
    secondaryHref: "/homeowners",
  },
  {
    slug: "buy-one-mini-split-bay-area",
    title: "Buy One Mini Split in the Bay Area - TCL Equipment Help",
    description:
      "Buying one TCL mini split in the Bay Area? Summit helps retail buyers understand equipment, installation, rebates, and local availability.",
    eyebrow: "Buy one mini split",
    h1: "Yes, you can ask about one mini split.",
    intro:
      "This path is for homeowners and small property buyers who want one system and do not want to feel like they walked into the wrong wholesale counter.",
    points: [
      "No contractor account required to ask equipment questions.",
      "Professional installation is still required for real projects.",
      "We separate equipment supply from installation scope so expectations are clear.",
    ],
    primaryCta: "Ask about one unit",
    primaryHref: "/homeowners#homeowner-request",
    secondaryCta: "View mini splits",
    secondaryHref: "/products?category=ductless",
  },
  {
    slug: "bay-area-heat-pump-rebates",
    title: "Bay Area Heat Pump Rebates - Current Program Guidance",
    description:
      "Learn what Bay Area heat pump buyers should verify about active California programs, AHRI matchups, utility rules, and installer eligibility.",
    eyebrow: "Bay Area heat pump rebates",
    h1: "Ask rebate questions before you buy equipment.",
    intro:
      "Rebates can depend on equipment matchups, installer enrollment, project location, and documentation. Summit helps buyers know what to confirm with the installing contractor.",
    points: [
      "The federal 25C credit ended for property placed in service after December 31, 2025.",
      "TECH Clean California details can vary by contractor and region.",
      "AHRI references and installation details should be checked before purchase.",
    ],
    primaryCta: "Get rebate-aware help",
    primaryHref: "/homeowners#homeowner-request",
    secondaryCta: "Spec resources",
    secondaryHref: "/resources",
  },
  {
    slug: "newark-hvac-will-call-contractors",
    title: "Newark HVAC Will-Call for Contractors - TCL Stock & Docs",
    description:
      "Contractors can use Summit HVAC Supply in Newark for TCL HVAC will-call, stock checks, spec sheets, quote support, and account pricing.",
    eyebrow: "Newark will-call",
    h1: "A contractor supply path from Newark, CA.",
    intro:
      "The public site is friendlier for homeowners, but the pro workflow stays direct: search SKUs, check stock, collect documents, and open an account for contractor pricing.",
    points: [
      "Newark will-call and Bay Area delivery coordination.",
      "SKU-level spec sheets and install manuals.",
      "Contractor account path for pro pricing and repeat buying.",
    ],
    primaryCta: "Open contractor account",
    primaryHref: "/dealers",
    secondaryCta: "Check SKU availability",
    secondaryHref: "/products",
  },
  {
    slug: "tcl-mini-split-systems",
    title: "TCL Mini Split Systems - Bay Area Stock & Guidance",
    description: "Compare TCL single-zone and multi-zone mini split systems with Newark availability, documents, and Bay Area installer help.",
    eyebrow: "TCL mini split systems",
    h1: "Compare TCL mini splits by room count, capacity, and project type.",
    intro: "Start with the space you need to condition, then narrow the equipment by capacity, voltage, refrigerant, and matched-system requirements. Summit supplies the equipment; a qualified contractor confirms the final design and installation.",
    points: [
      "Single-zone options for bedrooms, offices, additions, and ADUs.",
      "Multi-zone options when one outdoor unit serves several indoor zones.",
      "Part-number search, documents, and Newark stock for contractor buyers.",
    ],
    primaryCta: "Shop ductless systems",
    primaryHref: "/products?category=ductless",
    secondaryCta: "Get installer help",
    secondaryHref: "/homeowners#homeowner-request",
  },
  {
    slug: "tcl-ducted-heat-pumps",
    title: "TCL Ducted Heat Pumps - Bay Area Equipment Supply",
    description: "Explore TCL ducted heat pumps for Bay Area replacements and new projects with AHRI, permit, and installer guidance.",
    eyebrow: "TCL ducted heat pumps",
    h1: "Ducted heat pump equipment for replacements and new Bay Area projects.",
    intro: "Ducted projects depend on the complete outdoor and indoor match, existing duct conditions, electrical scope, and local permit requirements. Summit helps buyers identify the equipment lane before a contractor confirms the final system.",
    points: [
      "Matched-system and AHRI questions before equipment is ordered.",
      "Guidance for existing-duct replacements and property projects.",
      "Newark supply support for qualified Bay Area installers.",
    ],
    primaryCta: "Shop ducted systems",
    primaryHref: "/products?category=ducted",
    secondaryCta: "Check permit guidance",
    secondaryHref: "/guides/bay-area-hvac-permits",
  },
  {
    slug: "r-32-mini-split-systems",
    title: "R-32 Mini Split Systems - Bay Area Supply Guidance",
    description: "Shop and compare R-32 mini split systems with A2L handling guidance, product documents, and Newark availability.",
    eyebrow: "R-32 mini split systems",
    h1: "R-32 mini splits with the documents installers need.",
    intro: "R-32 is an A2L refrigerant. Equipment selection, transport, installation, and service require current manufacturer instructions, code checks, and qualified handling. Product pages keep the relevant identifiers and documents close to the buying action.",
    points: [
      "Filter products by refrigerant, capacity, voltage, and application.",
      "Use current manufacturer instructions for A2L work practices.",
      "Ask the Summit counter about available models and required job materials.",
    ],
    primaryCta: "Browse R-32 models",
    primaryHref: "/products?q=R-32",
    secondaryCta: "Read A2L guidance",
    secondaryHref: "/guides/r-32-r-454b-a2l-transition",
  },
  {
    slug: "contractor-hvac-supply-newark",
    title: "Contractor HVAC Supply in Newark - Stock, Will-Call & Docs",
    description: "Newark HVAC supply for Bay Area contractors with SKU search, local stock, will-call, documents, quotes, and trade account access.",
    eyebrow: "Contractor HVAC supply",
    h1: "Exact-part search and Newark will-call for Bay Area HVAC contractors.",
    intro: "Search by part number or model, review stock and ungated documents, then reserve for pickup or request a job quote. Contractor pricing stays behind account sign-in.",
    points: [
      "Public list price with authenticated contractor pricing.",
      "Newark stock and pickup information above the fold on every SKU.",
      "Quote support for matched systems and multi-unit jobs.",
    ],
    primaryCta: "Check stock",
    primaryHref: "/products",
    secondaryCta: "Open contractor account",
    secondaryHref: "/dealers",
  },
  {
    slug: "heat-pump-equipment-property-managers",
    title: "Heat Pump Equipment for Bay Area Property Managers",
    description: "Equipment planning and quote support for Bay Area property managers replacing heat pumps across apartments and commercial properties.",
    eyebrow: "Property and portfolio buyers",
    h1: "A clearer equipment path for multi-unit heat pump projects.",
    intro: "Property teams need repeatable equipment, documented alternates, delivery coordination, and a clean handoff to licensed installers. Summit helps organize the supply scope without representing installation as an in-house service.",
    points: [
      "Portfolio and phased-replacement quote support.",
      "Model, stock, document, and compatible-system review.",
      "Bay Area delivery coordination from the Newark supply hub.",
    ],
    primaryCta: "Request project quote",
    primaryHref: "/quote",
    secondaryCta: "Contact the counter",
    secondaryHref: "/contact?topic=property",
  },
];

export function getLocalPage(slug: string) {
  return LOCAL_PAGES.find((page) => page.slug === slug);
}
