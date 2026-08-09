// TCL HVAC series catalog.
//
// ACCURACY POLICY (per project brief):
//  - Series map to real TCL product families. SEER2 / BTU / refrigerant / min-temp
//    are sourced from public TCL retail + distributor listings (Home Depot TH-series;
//    distributor TSC hyper-heat + TUM multi-zone). See src/lib/backend/mock-data.ts
//    for per-SKU model numbers.
//  - Anything still listed in each series' `confirm` array (e.g. HSPF2, exact
//    warranty terms) needs spec-sheet confirmation before launch.
//  - Warranty terms vary by SKU/region (commonly 7-yr compressor / 5-yr parts,
//    10-yr on cassette & central) -- always shown with a confirm flag.

export type StockState = "ready" | "lead";
export type Category = "ductless" | "ducted" | "commercial" | "ventilation";

export type Series = {
  slug: string;
  name: string;
  family: string; // TCL family name
  type: string;
  image: string;
  tagline: string;
  category: Category;
  ducted: boolean;
  description: string;
  bestFor: string;
  // Filterable / structured
  seer2: number;
  hspf2: number | null;
  btuMin: number;
  btuMax: number;
  zones: number; // max zones supported
  minTemp: string;
  refrigerant: string;
  energyStar: "most-efficient" | "certified" | "none";
  warrantyCompressor: string;
  warrantyParts: string;
  stock: StockState;
  leadTime: string; // e.g. "In stock, ships today" or "5-7 business days"
  highlights: string[];
  // Internal launch-readiness notes for spec keys that need source confirmation.
  confirm: SpecKey[];
};

export type SpecKey =
  | "seer2"
  | "hspf2"
  | "btu"
  | "zones"
  | "minTemp"
  | "refrigerant"
  | "warranty";

export const SERIES: Series[] = [
  {
    slug: "breezein",
    name: "BreezeIN Series",
    family: "TCL BreezeIN",
    type: "High-efficiency inverter split AC",
    image: "/products/breezein.png",
    tagline: "Type: High-efficiency inverter split AC",
    category: "ductless",
    ducted: false,
    description:
      "Type: High-efficiency inverter split AC",
    bestFor: "Room additions, retrofits, spot heating & cooling",
    seer2: 23,
    hspf2: 9.5,
    btuMin: 9000,
    btuMax: 24000,
    zones: 1,
    minTemp: "-13°F",
    refrigerant: "R-32",
    energyStar: "certified",
    warrantyCompressor: "7-yr",
    warrantyParts: "5-yr",
    stock: "ready",
    leadTime: "In stock, ships today",
    highlights: [
      "Up to 23 SEER2, low-ambient heat to -13°F",
      "Ultra-quiet indoor units",
      "Wi-Fi smart control (TCL Home app)",
      "Compact, sleek design",
    ],
    confirm: ["hspf2", "warranty"],
  },
  {
    slug: "freshin",
    name: "FreshIN Series",
    family: "TCL FreshIN",
    type: "Fresh air supply split system",
    image: "/products/freshin.png",
    tagline: "Type: Fresh air supply split system",
    category: "ventilation",
    ducted: false,
    description:
      "Type: Fresh air supply split system",
    bestFor: "Bedrooms, nurseries, offices, IAQ-conscious clients",
    seer2: 19,
    hspf2: 9,
    btuMin: 9000,
    btuMax: 18000,
    zones: 1,
    minTemp: "5°F",
    refrigerant: "R-32",
    energyStar: "certified",
    warrantyCompressor: "7-yr",
    warrantyParts: "5-yr",
    stock: "lead",
    leadTime: "7-10 business days",
    highlights: [
      "Built-in fresh air ventilation",
      "Removes indoor air pollutants",
      "Ideal for bedrooms, nurseries, offices",
    ],
    confirm: ["seer2", "hspf2", "btu", "minTemp", "warranty"],
  },
  {
    slug: "elite",
    name: "Elite Series",
    family: "TCL Elite",
    type: "Premium split inverter AC",
    image: "/products/elite.png",
    tagline: "Type: Premium split inverter AC",
    category: "ductless",
    ducted: false,
    description:
      "Type: Premium split inverter AC",
    bestFor: "Premium ductless installs, efficiency-focused bids, quiet comfort upgrades",
    seer2: 25,
    hspf2: 10.5,
    btuMin: 9000,
    btuMax: 24000,
    zones: 1,
    minTemp: "-22°F",
    refrigerant: "R-454B",
    energyStar: "most-efficient",
    warrantyCompressor: "7-yr",
    warrantyParts: "5-yr",
    stock: "ready",
    leadTime: "In stock, ships today",
    highlights: [
      "Up to 25 SEER2 hyper-heat, heats to -22°F",
      "Low-GWP R-454B refrigerant",
      "Smart diagnostics + app control",
    ],
    confirm: ["warranty"],
  },
  {
    slug: "light-commercial",
    name: "Light Commercial Series",
    family: "TCL Light Commercial",
    type: "Ceiling cassette, floor-ceiling, ducted systems",
    image: "/products/light-commercial.png",
    tagline: "Type: Ceiling cassette, floor-ceiling, ducted systems",
    category: "commercial",
    ducted: true,
    description:
      "Type: Ceiling cassette, floor-ceiling, ducted systems",
    bestFor: "Offices, retail, restaurants, tenant improvements",
    seer2: 19,
    hspf2: 8.5,
    btuMin: 36000,
    btuMax: 48000,
    zones: 1,
    minTemp: "-4°F",
    refrigerant: "R-454B",
    energyStar: "certified",
    warrantyCompressor: "10-yr",
    warrantyParts: "5-yr",
    stock: "lead",
    leadTime: "10-14 business days",
    highlights: ["4-way ceiling cassette, high-capacity", "Durable for high-traffic use", "10-yr compressor warranty"],
    confirm: ["seer2", "hspf2", "warranty"],
  },
  {
    slug: "multi-zone",
    name: "Multi-Zone Systems",
    family: "TCL Multi-Zone",
    type: "Inverter outdoor unit + multiple indoor units",
    image: "/products/multi-zone.jpg",
    tagline: "Type: Inverter outdoor unit + multiple indoor units",
    category: "ductless",
    ducted: false,
    description:
      "Type: Inverter outdoor unit + multiple indoor units",
    bestFor: "Whole-home ductless, multi-room, mixed indoor styles",
    seer2: 22,
    hspf2: 9,
    btuMin: 18000,
    btuMax: 36000,
    zones: 4,
    minTemp: "-4°F",
    refrigerant: "R-410A",
    energyStar: "certified",
    warrantyCompressor: "7-yr",
    warrantyParts: "5-yr",
    stock: "lead",
    leadTime: "5-7 business days",
    highlights: [
      "One condenser drives 2-4 indoor zones",
      "Separate control per room",
      "Mix wall, cassette & floor heads",
    ],
    confirm: ["hspf2", "warranty"],
  },
  {
    slug: "central-system",
    name: "Central System Units",
    family: "TCL Central Ducted",
    type: "Central inverter systems",
    image: "/products/central-system.png",
    tagline: "Type: Central inverter systems",
    category: "ducted",
    ducted: true,
    description:
      "Type: Central inverter systems",
    bestFor: "New construction, full replacements, whole-home changeouts",
    seer2: 17,
    hspf2: 8.5,
    btuMin: 36000,
    btuMax: 48000,
    zones: 1,
    minTemp: "0°F",
    refrigerant: "R-454B",
    energyStar: "certified",
    warrantyCompressor: "10-yr",
    warrantyParts: "5-yr",
    stock: "lead",
    leadTime: "10-14 business days",
    highlights: [
      "High power and large-scale coverage",
      "Ideal for new construction or full replacements",
    ],
    confirm: ["seer2", "hspf2", "btu", "minTemp", "warranty"],
  },
];

export function getSeries(slug: string): Series | undefined {
  return SERIES.find((s) => s.slug === slug);
}

export function isUnconfirmed(s: Series, key: SpecKey): boolean {
  return s.confirm.includes(key);
}

export const CATEGORY_LABEL: Record<Category, string> = {
  ductless: "Ductless",
  ducted: "Ducted",
  commercial: "Light Commercial",
  ventilation: "Ventilation / IAQ",
};

export const ENERGY_STAR_LABEL: Record<Series["energyStar"], string | null> = {
  "most-efficient": "ENERGY STAR Most Efficient 2025",
  certified: "ENERGY STAR Certified",
  none: null,
};

export function btuLabel(s: Series): string {
  const fmt = (n: number) => `${(n / 1000).toLocaleString()}k`;
  return s.btuMin === s.btuMax ? fmt(s.btuMin) : `${fmt(s.btuMin)}-${fmt(s.btuMax)}`;
}
