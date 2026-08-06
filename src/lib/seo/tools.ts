export type SeoTool = {
  slug: "model-number-decoder" | "rebate-lookup" | "ahri-match-finder" | "system-sizing-estimator" | "operating-cost-comparison";
  title: string;
  description: string;
  h1: string;
  intro: string;
};

export const SEO_TOOLS: SeoTool[] = [
  { slug: "model-number-decoder", title: "TCL HVAC Model Number Decoder", description: "Enter a TCL HVAC model or part number to find the matching Summit product record, specs, stock, and documents.", h1: "Find a TCL HVAC product from the model number.", intro: "Enter the code from the nameplate, carton, quote, or submittal. Dashes, slashes, spaces, and letter case do not have to match exactly." },
  { slug: "rebate-lookup", title: "Bay Area Heat Pump Rebate Lookup by ZIP", description: "Use a Bay Area project ZIP to organize current heat pump incentive checks before equipment is ordered.", h1: "Start a heat pump rebate check with the project ZIP.", intro: "This lookup returns programs and verification steps to investigate. It does not determine eligibility or reserve funding." },
  { slug: "ahri-match-finder", title: "AHRI Match Finder for TCL HVAC Systems", description: "Search Summit product records by AHRI reference, model, or part number and continue to official certification records.", h1: "Find the product record behind an AHRI reference.", intro: "Search Summit records first, then verify the complete indoor/outdoor combination in the official AHRI Directory before ordering." },
  { slug: "system-sizing-estimator", title: "Bay Area Heat Pump Sizing Estimator", description: "Get a preliminary equipment capacity lane based on area, rooms, and ducts before a contractor performs a load calculation.", h1: "Estimate a starting capacity lane, not the final system size.", intro: "Square footage alone cannot size HVAC. This tool helps a buyer start the conversation; a qualified contractor must complete the project-specific load and equipment selection." },
  { slug: "operating-cost-comparison", title: "Heat Pump vs Gas Operating Cost Calculator", description: "Compare rough annual heat-pump electricity cost with gas heating cost using your own usage and utility rates.", h1: "Compare annual energy cost using the rates on your bills.", intro: "Enter annual usage and current utility rates. This is arithmetic, not a building-energy model; weather, equipment efficiency, ducts, and rate schedules materially affect actual cost." },
];

export function getSeoTool(slug: string) { return SEO_TOOLS.find((tool) => tool.slug === slug); }
