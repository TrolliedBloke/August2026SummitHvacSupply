import {
  homeownerEligibleSystems,
  type MatchedSystem,
  type SystemLane,
} from "@/lib/catalog/compliance";
import { isR410a, R410A_POLICY } from "@/lib/refrigerant-policy";
import { capacityLabel, estimateCapacityBtu } from "@/lib/sizing";
import { productHref, type CatalogCategory, type StorefrontSku } from "@/lib/storefront/catalog";
import {
  CONTRACTOR_SYSTEMS,
  HOME_SIZES,
  type ContractorAnswers,
  type FinderSubmission,
  type HomeownerAnswers,
} from "./questions";

/**
 * Finder results. Pure functions over the catalog (with live stock already
 * applied by the caller), so the API route and the shortlist email compute the
 * same answer from the same stored session.
 *
 * Homeowners are shown only matched systems that pass the California
 * eligibility gate (lib/catalog/compliance.ts), at most three. When none fits,
 * the result says so and leads with the installer introduction -- an empty
 * shortlist is an honest answer, not a failure to hide.
 *
 * Contractors are shown matching records with stock first. Nothing here
 * carries a price: account pricing comes from the signed-in account only.
 */

export const MAX_HOMEOWNER_OPTIONS = 3;
export const MAX_CONTRACTOR_OPTIONS = 6;

export type ResultItem = {
  id: string;
  sku: string;
  title: string;
  brand: string;
  btu: number;
  refrigerant: string;
  href: string;
  image: string;
  stock: { verified: boolean; quantity: number };
  notice: string | null;
};

export type HomeownerSystemOption = {
  ahriReference: string;
  title: string;
  lane: SystemLane;
  capacity: string;
  ratings: string;
  components: ResultItem[];
};

export type InstallStep = { title: string; body: string; href?: string };

export type HomeownerResult = {
  path: "homeowner";
  lane: SystemLane | "either";
  laneLabel: string;
  targetBtu: number | null;
  capacity: string | null;
  options: HomeownerSystemOption[];
  browseHref: string;
  installSteps: InstallStep[];
};

export type ContractorResult = {
  path: "contractor";
  heading: string;
  items: ResultItem[];
  browseHref: string;
  accountPrompt: boolean;
  /** The lane a stock alert would watch, when the answers name one. */
  alert: { category: CatalogCategory; label: string; btu: number | null } | null;
};

export type FinderResult = HomeownerResult | ContractorResult;

function toItem(sku: StorefrontSku): ResultItem {
  return {
    id: sku.id,
    sku: sku.sku,
    title: sku.title,
    brand: sku.brand,
    btu: sku.btu,
    refrigerant: sku.refrigerant,
    href: productHref(sku),
    image: sku.image,
    stock: { verified: sku.availabilityVerified, quantity: sku.availabilityVerified ? sku.available : 0 },
    notice: isR410a(sku.refrigerant) ? R410A_POLICY.contractorNotice : null,
  };
}

/* ------------------------------------------------------------------ homeowner */

export function homeownerLane(answers: HomeownerAnswers): SystemLane | "either" {
  const wholeHome = answers.size === "home_mid" || answers.size === "home_large";
  const hasDucts = answers.current === "ducted_central" || answers.current === "furnace_only";
  if (answers.goal === "add_rooms" || answers.current === "no_ducts") return "ductless";
  if (hasDucts) return wholeHome || !answers.size || answers.size === "unsure" ? "ducted" : "ductless";
  if (answers.goal === "new_space") return "ductless";
  return "either";
}

const LANE_LABEL: Record<SystemLane | "either", string> = {
  ducted: "Ducted heat pump system",
  ductless: "Ductless mini split",
  either: "Ducted or ductless, depending on your ductwork",
};

export function targetBtuFor(answers: HomeownerAnswers): number | null {
  const size = HOME_SIZES.find((option) => option.value === answers.size);
  return size?.sqft ? estimateCapacityBtu(size.sqft) : null;
}

/** Nearest systems in the lane, within half the target either way. */
export function pickSystems(systems: MatchedSystem[], lane: SystemLane | "either", targetBtu: number | null): MatchedSystem[] {
  const inLane = systems.filter((system) => lane === "either" || system.lane === lane);
  const near = targetBtu === null ? inLane : inLane.filter((system) => Math.abs(system.btu - targetBtu) <= targetBtu * 0.5);
  return near
    .sort((a, b) => (targetBtu === null ? 0 : Math.abs(a.btu - targetBtu) - Math.abs(b.btu - targetBtu)) || a.btu - b.btu)
    .slice(0, MAX_HOMEOWNER_OPTIONS);
}

function installSteps(lane: SystemLane | "either"): InstallStep[] {
  const steps: InstallStep[] = [
    {
      title: "A load calculation",
      body: "Your installer sizes the system with a Manual J. The size here is a starting point.",
    },
    {
      title: "A mechanical permit",
      body: "Replacing a condenser, coil, air handler or furnace in California needs one. The installer pulls it.",
      href: "/guides/bay-area-hvac-permits",
    },
    {
      title: "A HERS verification visit",
      body:
        lane === "ductless"
          ? "A third-party rater checks the refrigerant charge and airflow before the permit closes."
          : "A third-party rater checks duct leakage, refrigerant charge and airflow before the permit closes.",
      href: "/guides/california-title-24-hvac-changeouts",
    },
    {
      title: "A licensed installer",
      body: "Connecting refrigerant lines, even pre-charged ones, requires EPA 608 certification. Summit supplies the equipment; a licensed contractor installs it.",
    },
  ];
  return steps;
}

function ratingsLine(system: MatchedSystem): string {
  const parts = [
    system.ratings.seer2 !== null ? `SEER2 ${system.ratings.seer2}` : null,
    system.ratings.eer2 !== null ? `EER2 ${system.ratings.eer2}` : null,
    system.ratings.hspf2 !== null ? `HSPF2 ${system.ratings.hspf2}` : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(" · ")} (AHRI ${system.ahriReference})` : `AHRI ${system.ahriReference}`;
}

export function recommendForHomeowner(answers: HomeownerAnswers, skus: StorefrontSku[]): HomeownerResult {
  const lane = homeownerLane(answers);
  const targetBtu = targetBtuFor(answers);
  const live = new Map(skus.map((sku) => [sku.id, sku]));
  const options = pickSystems(homeownerEligibleSystems(skus), lane, targetBtu).map((system) => ({
    ahriReference: system.ahriReference,
    title: `${system.brand} ${capacityLabel(system.btu)} ${system.lane === "ducted" ? "ducted heat pump" : "ductless"} system`,
    lane: system.lane,
    capacity: capacityLabel(system.btu),
    ratings: ratingsLine(system),
    components: system.components.map((component) => toItem(live.get(component.id) ?? component)),
  }));
  const browseCategory: CatalogCategory = lane === "ducted" ? "central-heat-pumps" : "mini-splits";
  return {
    path: "homeowner",
    lane,
    laneLabel: LANE_LABEL[lane],
    targetBtu,
    capacity: targetBtu ? capacityLabel(targetBtu) : null,
    options,
    browseHref: `/products?category=${browseCategory}`,
    installSteps: installSteps(lane),
  };
}

/* ----------------------------------------------------------------- contractor */

const SYSTEM_CATEGORIES: Record<NonNullable<ContractorAnswers["system"]>, CatalogCategory[]> = {
  mini_split: ["mini-splits"],
  ducted_heat_pump: ["central-heat-pumps", "air-handlers"],
  central_ac: ["central-air-conditioners", "evaporator-coils"],
  air_handler_coil: ["air-handlers", "evaporator-coils"],
  furnace: ["furnaces"],
  cassette: ["cassettes"],
};

function contractorCategories(answers: ContractorAnswers): CatalogCategory[] | null {
  if (answers.need === "parts_supplies") return ["line-sets", "installation-supplies", "controls"];
  if (answers.system) return SYSTEM_CATEGORIES[answers.system];
  return null;
}

export function recommendForContractor(answers: ContractorAnswers, skus: StorefrontSku[]): ContractorResult {
  if (answers.need === "open_account") {
    return { path: "contractor", heading: "Open a trade account", items: [], browseHref: "/products", accountPrompt: true, alert: null };
  }
  const categories = contractorCategories(answers);
  const btu = answers.capacity ? Number(answers.capacity) : null;
  const items = skus
    .filter((sku) => !categories || categories.includes(sku.category))
    .filter((sku) => btu === null || sku.btu === 0 || Math.abs(sku.btu - btu) <= btu * 0.25)
    .sort((a, b) => {
      // Counted stock first, then closest capacity, then catalog order.
      const stock = Number(b.availabilityVerified && b.available > 0) - Number(a.availabilityVerified && a.available > 0);
      if (stock !== 0) return stock;
      if (btu !== null) return Math.abs(a.btu - btu) - Math.abs(b.btu - btu);
      return 0;
    })
    .slice(0, MAX_CONTRACTOR_OPTIONS)
    .map(toItem);
  const category = categories?.[0];
  const system = CONTRACTOR_SYSTEMS.find((option) => option.value === answers.system);
  return {
    path: "contractor",
    heading: answers.timing === "today" ? "Matching equipment for will-call" : "Matching equipment",
    items,
    browseHref: category ? `/products?category=${category}` : "/products",
    accountPrompt: true,
    alert: category && system ? { category, label: `${btu ? `${btu.toLocaleString("en-US")} BTU ` : ""}${system.label.toLowerCase()} equipment`, btu } : null,
  };
}

export function recommend(submission: FinderSubmission, skus: StorefrontSku[]): FinderResult {
  return submission.path === "homeowner"
    ? recommendForHomeowner(submission.answers, skus)
    : recommendForContractor(submission.answers, skus);
}

/** The SKU ids a result shows, stored on the session for later analysis. */
export function resultSkuIds(result: FinderResult): string[] {
  return result.path === "homeowner"
    ? result.options.flatMap((option) => option.components.map((component) => component.id))
    : result.items.map((item) => item.id);
}
