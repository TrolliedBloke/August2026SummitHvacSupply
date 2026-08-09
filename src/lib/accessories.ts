import type { Category } from "@/lib/products";

/**
 * Companion items commonly needed alongside a system. These are real accessory
 * categories (not fabricated SKUs) surfaced to lift attach rate -- the team
 * prices and confirms exact parts on the quote. Filtered by the product's
 * category so a ducted air handler doesn't suggest a mini-split line set.
 */
export type Accessory = {
  key: string;
  name: string;
  blurb: string;
  categories: Category[] | "all";
};

export const ACCESSORIES: Accessory[] = [
  {
    key: "line-set",
    name: "Refrigerant line set",
    blurb: "Insulated 1/4\" + 3/8\" copper set, sized to the indoor/outdoor run.",
    categories: ["ductless", "commercial"],
  },
  {
    key: "wall-bracket",
    name: "Wall bracket / ground stand",
    blurb: "Powder-coated condenser mount with anti-vibration isolators.",
    categories: ["ductless", "ducted", "commercial"],
  },
  {
    key: "line-set-cover",
    name: "Line set cover kit",
    blurb: "Paintable raceway to protect and finish the exterior refrigerant run.",
    categories: ["ductless", "commercial"],
  },
  {
    key: "surge-protector",
    name: "HVAC surge protector",
    blurb: "Protects the inverter board from utility spikes. Cheap insurance.",
    categories: "all",
  },
  {
    key: "smart-thermostat",
    name: "Smart / compatible thermostat",
    blurb: "Wi-Fi control for ducted systems and zoned setups.",
    categories: ["ducted", "commercial", "ventilation"],
  },
  {
    key: "condensate-pump",
    name: "Condensate pump",
    blurb: "For installs without a gravity drain path to the exterior.",
    categories: ["ductless", "ducted", "commercial"],
  },
];

export function accessoriesForCategory(category: Category): Accessory[] {
  return ACCESSORIES.filter((a) => a.categories === "all" || a.categories.includes(category));
}
