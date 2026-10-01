/* The category rail, shared by the header and the footer so the two cannot
   drift. Every target is a real catalog view -- tests/design-remediation.test.ts
   checks each one resolves to a non-empty result. */
export const CATEGORY_RAIL = [
  { href: "/products?category=mini-splits", label: "Mini splits" },
  { href: "/products?q=condenser", label: "Condensers" },
  { href: "/products?category=furnaces", label: "Furnaces" },
  { href: "/products?category=air-handlers", label: "Air handlers" },
  { href: "/products?category=evaporator-coils", label: "Coils" },
  { href: "/products?category=line-sets", label: "Line sets" },
  { href: "/products?refrigerant=R-454B", label: "Refrigerant" },
  { href: "/products?category=controls", label: "Thermostats" },
] as const;
