export type SeoGuide = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  jurisdiction: string;
  effectiveDate: string;
  pending: string;
  reviewedAt: string;
  nextReviewAt: string;
  sections: { heading: string; body: string; bullets?: string[] }[];
  sources: { label: string; href: string }[];
};

export const SEO_GUIDES: SeoGuide[] = [
  {
    slug: "baaqmd-rules-9-4-9-6",
    title: "BAAQMD Rules 9-4 and 9-6 - Bay Area HVAC Guide",
    description: "Current planning guidance for Bay Area zero-NOx furnace and water-heater rules, implementation dates, and equipment conversations.",
    eyebrow: "Bay Area air rules",
    h1: "What Rules 9-4 and 9-6 mean for Bay Area equipment planning.",
    intro: "The Bay Area Air District adopted future zero-NOx standards for covered furnaces and water heaters. The rules affect equipment manufactured after specified dates, not an immediate mandate to replace working equipment.",
    jurisdiction: "Bay Area Air Quality Management District",
    effectiveDate: "Phased dates currently begin January 1, 2027; furnace requirements are scheduled for January 1, 2029.",
    pending: "The Air District is actively evaluating implementation readiness and possible flexibilities. Confirm the adopted rule text and current Air District notices before specifying equipment.",
    reviewedAt: "August 5, 2026",
    nextReviewAt: "September 5, 2026",
    sections: [
      { heading: "The current schedule", body: "Air District materials list phased implementation by appliance type and capacity.", bullets: ["Small natural-gas water heaters: January 1, 2027 schedule.", "Applicable natural-gas furnaces: January 1, 2029 schedule.", "Larger water heaters and boilers: later phases may apply."] },
      { heading: "What buyers should do", body: "Treat this as a project-planning input, not a product-page badge. A contractor should confirm appliance type, manufacture date, project jurisdiction, electrical capacity, and any adopted exception or extension before purchase." },
    ],
    sources: [
      { label: "Bay Area Air District building-appliance rule development", href: "https://www.baaqmd.gov/en/rules-and-compliance/rule-development/building-appliances" },
      { label: "October 2025 implementation working-group slides", href: "https://www.baaqmd.gov/~/media/dotgov/files/rules/reg-9-rule-4-nitrogen-oxides-from-fan-type-residential-central-furnaces/2021-amendments/documents/102325_iwg-phase-2-kickoff-meeting-slides-pdf.pdf?rev=31b71a28b93e40f5af4b4a76cf59287c&sc_lang=en" },
    ],
  },
  {
    slug: "bay-area-hvac-permits",
    title: "Bay Area HVAC Permits - Changeout Planning Guide",
    description: "A practical guide to permit and inspection questions for Bay Area HVAC replacements, mini splits, and heat pumps.",
    eyebrow: "Permit planning",
    h1: "Start the permit check before ordering replacement HVAC equipment.",
    intro: "California HVAC replacements commonly require permits, energy-code documentation, and local inspection. The authority having jurisdiction makes the final determination for the project address.",
    jurisdiction: "California Energy Commission and local Bay Area building departments",
    effectiveDate: "Permit applications submitted on or after January 1, 2026 must comply with the 2025 California Energy Code.",
    pending: "Local submittal steps, fees, inspection procedures, and electrification rules vary by city and can change independently.",
    reviewedAt: "August 5, 2026",
    nextReviewAt: "November 5, 2026",
    sections: [
      { heading: "Questions to answer", body: "Give the installer the exact job address and existing-system details before equipment is finalized.", bullets: ["Which building department has jurisdiction?", "Is this an alteration, replacement, addition, or new system?", "Are electrical service, disconnect, condensate, duct, or structural changes included?", "Which compliance documents and inspections are required?"] },
      { heading: "Equipment supply is not permit approval", body: "Summit can provide model information and manufacturer documents. The installer and local authority confirm the permitted design, code path, and final scope." },
    ],
    sources: [
      { label: "California Energy Commission 2025 Energy Code", href: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/2025-building-energy-efficiency" },
      { label: "California Energy Commission HVAC support", href: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/energy-code-support-center/hvac-0" },
    ],
  },
  {
    slug: "bay-area-heat-pump-rebates-by-zip",
    title: "Bay Area Heat Pump Rebates by ZIP - 2026 Starting Points",
    description: "Check 2026 Bay Area heat pump incentive starting points by project ZIP, utility, equipment match, and contractor requirements.",
    eyebrow: "Rebate verification",
    h1: "Rebate eligibility starts with the project address, not the equipment badge.",
    intro: "Programs can depend on ZIP code, utility, income, building type, matched-system performance, installer enrollment, and reservation timing. Use the lookup as a starting point, then verify with the program administrator before purchase.",
    jurisdiction: "Federal, California, utility, and regional programs",
    effectiveDate: "Current as reviewed August 5, 2026.",
    pending: "Funding levels, eligible equipment lists, and contractor requirements can change or close without a product-page update.",
    reviewedAt: "August 5, 2026",
    nextReviewAt: "September 5, 2026",
    sections: [
      { heading: "Federal status", body: "The IRS states that the Energy Efficient Home Improvement Credit under section 25C is not allowed for property placed in service after December 31, 2025." },
      { heading: "What to collect", body: "Before asking for an incentive estimate, collect the project ZIP, electric and gas utilities, building type, existing fuel, proposed AHRI match, installer information, and expected installation date." },
    ],
    sources: [
      { label: "IRS clean-energy credit modification FAQ", href: "https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb" },
      { label: "TECH Clean California", href: "https://techcleanca.com/" },
      { label: "BayREN residential programs", href: "https://www.bayren.org/" },
    ],
  },
  {
    slug: "r-32-r-454b-a2l-transition",
    title: "R-32 and R-454B A2L Refrigerants - HVAC Transition Guide",
    description: "Understand the R-32 and R-454B A2L transition, lower-GWP requirements, compatibility, and installer handling questions.",
    eyebrow: "A2L refrigerant transition",
    h1: "R-32 and R-454B systems must be treated as their own designed systems.",
    intro: "R-32 and R-454B are lower-flammability A2L refrigerants used in newer equipment. They are not drop-in replacements for R-410A, and components must be selected and installed for the refrigerant identified by the manufacturer.",
    jurisdiction: "United States Environmental Protection Agency and applicable mechanical/fire codes",
    effectiveDate: "Federal technology-transition restrictions began January 1, 2025 for covered residential and light-commercial equipment.",
    pending: "EPA transition rules and sell-through provisions have changed during implementation. Verify the current EPA table and manufacturer instructions for each project.",
    reviewedAt: "August 5, 2026",
    nextReviewAt: "October 5, 2026",
    sections: [
      { heading: "Compatibility is non-negotiable", body: "Do not mix indoor units, outdoor units, controls, or service procedures across refrigerants unless the manufacturer explicitly lists the combination. EPA notes that A2L refrigerants may not be used in systems that were not designed for them." },
      { heading: "What the contractor confirms", body: "The installer should confirm the listed system match, charge and line requirements, tools and recovery equipment, leak-detection or mitigation requirements, transport/storage practices, labeling, and local code adoption." },
    ],
    sources: [
      { label: "EPA HFC phasedown frequently asked questions", href: "https://www.epa.gov/hfcs/frequent-questions-phasedown-hydrofluorocarbons" },
      { label: "EPA technology-transition restrictions by sector", href: "https://www.epa.gov/hfcs/technology-transitions-hfc-restrictions-sector" },
      { label: "EPA acceptable substitutes for residential HVAC", href: "https://www.epa.gov/snap/substitutes-residential-and-light-commercial-air-conditioning-and-heat-pumps" },
    ],
  },
  {
    slug: "california-title-24-hvac-changeouts",
    title: "California Title 24 HVAC Changeouts - 2025 Energy Code",
    description: "Plan California HVAC changeouts under the 2025 Energy Code, including permit timing, documentation, and installer responsibilities.",
    eyebrow: "California energy code",
    h1: "HVAC changeouts applied for in 2026 use the 2025 California Energy Code.",
    intro: "The 2025 Building Energy Efficiency Standards apply to permit applications submitted on or after January 1, 2026. Replacement scope and documentation still depend on building type, climate zone, system design, and local enforcement.",
    jurisdiction: "California Energy Commission; enforced by local authorities having jurisdiction",
    effectiveDate: "January 1, 2026 for permit applications.",
    pending: "Local enforcement guidance and project-specific compliance paths should be confirmed with the building department and responsible contractor.",
    reviewedAt: "August 5, 2026",
    nextReviewAt: "November 5, 2026",
    sections: [
      { heading: "Before selecting equipment", body: "Confirm the permit application date, building type, climate zone, existing ducts, equipment match, controls, ventilation, electrical scope, and required acceptance or verification steps." },
      { heading: "Keep the documentation chain intact", body: "Product submittals and AHRI references support the equipment decision, but they do not replace the permit, compliance forms, installation verification, or inspection." },
    ],
    sources: [
      { label: "California Energy Commission 2025 standards", href: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/2025-building-energy-efficiency" },
      { label: "California Energy Code compliance program", href: "https://www.energy.ca.gov/programs-and-topics/programs/energy-code-compliance-program" },
    ],
  },
];

export function getSeoGuide(slug: string) {
  return SEO_GUIDES.find((guide) => guide.slug === slug);
}
