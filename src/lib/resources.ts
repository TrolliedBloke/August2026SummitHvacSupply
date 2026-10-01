/**
 * Resources as one discriminated model. Guides, tools, documents and external
 * sites used to be separate arrays rendered with separate assumptions; now each
 * is adapted into a ResourceItem whose type says what activating it does --
 * open an article, run a tool, download a file, or leave the site -- so the
 * card can say so in words before anyone clicks, and filtering, analytics and
 * accessibility all read the same fields.
 */

export const RESOURCE_TOPICS = ["Rebates", "Permits & code", "Refrigerants", "Model lookup", "Sizing & cost", "Product documents"] as const;
export type ResourceTopic = (typeof RESOURCE_TOPICS)[number];
export type ResourceAudience = "homeowner" | "contractor";

type Base = {
  id: string;
  title: string;
  summary: string;
  topics: ResourceTopic[];
  audience: ResourceAudience[];
  /** ISO date or a human date string from the source; null when unknown. */
  updated: string | null;
  destination: string;
};

export type ResourceItem =
  | (Base & { type: "guide" })
  | (Base & { type: "tool" })
  | (Base & {
      type: "document";
      fileType: "PDF" | "Web page";
      /** Bytes, or null when the host does not tell us. */
      sizeBytes: number | null;
      source: string;
      opensInNewTab: boolean;
      covers: string[];
      /** False when a hosted file is missing: shown as unavailable, never as a dead link. */
      available: boolean;
    })
  | (Base & { type: "external"; source: string; opensInNewTab: true });

export type ResourceType = ResourceItem["type"];

export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  guide: "Guide",
  tool: "Interactive tool",
  document: "Document",
  external: "External site",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The visible "what happens" label: "PDF, 1.2 MB · Opens in a new tab". */
export function behaviorLabel(item: ResourceItem): string {
  switch (item.type) {
    case "guide":
      return "Guide";
    case "tool":
      return "Interactive tool";
    case "external":
      return `${item.source} · Opens in a new tab`;
    case "document": {
      const size = item.sizeBytes !== null ? `, ${formatBytes(item.sizeBytes)}` : "";
      const tab = item.opensInNewTab ? " · Opens in a new tab" : "";
      return `${item.fileType}${size} · ${item.source}${tab}`;
    }
  }
}

export class InvalidResourceError extends Error {}

/** Reject items missing the fields their variant requires. */
export function validateResource(item: ResourceItem): ResourceItem {
  if (!item.id || !item.title.trim() || !item.destination) throw new InvalidResourceError(`Resource ${item.id || "(no id)"} is missing identity fields`);
  if (item.type === "document" && (!item.source || !item.fileType)) throw new InvalidResourceError(`Document ${item.id} needs a source and file type`);
  if (item.type === "external" && (!item.source || !/^https?:\/\//.test(item.destination))) throw new InvalidResourceError(`External resource ${item.id} needs a source and an absolute URL`);
  if ((item.type === "guide" || item.type === "tool") && !item.destination.startsWith("/")) throw new InvalidResourceError(`${item.type} ${item.id} must link inside the site`);
  return item;
}

/* Adapters ------------------------------------------------------------------ */

const GUIDE_TOPICS: Record<string, ResourceTopic[]> = {
  "baaqmd-rules-9-4-9-6": ["Permits & code"],
  "bay-area-hvac-permits": ["Permits & code"],
  "bay-area-heat-pump-rebates-by-zip": ["Rebates"],
  "r-32-r-454b-a2l-transition": ["Refrigerants"],
  "california-title-24-hvac-changeouts": ["Permits & code"],
};

export function fromGuide(guide: { slug: string; eyebrow: string; title: string; description: string; reviewedAt: string }): ResourceItem {
  return validateResource({
    type: "guide",
    id: `guide:${guide.slug}`,
    title: guide.eyebrow,
    summary: guide.description,
    topics: GUIDE_TOPICS[guide.slug] ?? ["Permits & code"],
    audience: ["homeowner", "contractor"],
    updated: guide.reviewedAt,
    destination: `/guides/${guide.slug}`,
  });
}

const TOOL_TOPICS: Record<string, ResourceTopic[]> = {
  "model-number-decoder": ["Model lookup"],
  "ahri-match-finder": ["Model lookup"],
  "rebate-lookup": ["Rebates"],
  "system-sizing-estimator": ["Sizing & cost"],
  "operating-cost-comparison": ["Sizing & cost"],
};

export function fromTool(tool: { slug: string; title: string; description: string }): ResourceItem {
  return validateResource({
    type: "tool",
    id: `tool:${tool.slug}`,
    title: tool.title,
    summary: tool.description,
    topics: TOOL_TOPICS[tool.slug] ?? ["Model lookup"],
    audience: tool.slug === "operating-cost-comparison" || tool.slug === "rebate-lookup" ? ["homeowner", "contractor"] : ["contractor", "homeowner"],
    updated: null,
    destination: `/tools/${tool.slug}`,
  });
}

export function fromRebate(rebate: { name: string; detail: string }): ResourceItem {
  return validateResource({
    type: "guide",
    id: `rebate:${rebate.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: rebate.name,
    summary: rebate.detail,
    topics: ["Rebates"],
    audience: ["homeowner", "contractor"],
    updated: null,
    destination: "/tools/rebate-lookup",
  });
}

const DOCUMENT_KIND: Record<string, string> = {
  spec_sheet: "Spec sheet",
  installation_manual: "Installation manual",
  submittal: "Submittal",
  product_data: "Product data",
  wiring_diagram: "Wiring diagram",
  brochure: "Brochure",
  manual: "Manual",
  product_page: "Product page",
};

/**
 * One resource per distinct document URL, listing every SKU it covers.
 * Manufacturer product pages are external sites; files are documents.
 */
export function fromDocuments(
  skus: Array<{ sku: string; documents: Array<{ kind: string; title: string; url: string; modelCoverageVerified: boolean; retrievedAt?: string }> }>,
  fileInfo: (url: string) => { sizeBytes: number | null; exists: boolean }
): ResourceItem[] {
  const byUrl = new Map<string, { doc: (typeof skus)[number]["documents"][number]; covers: string[] }>();
  for (const sku of skus) {
    for (const doc of sku.documents) {
      if (!doc.modelCoverageVerified) continue;
      const entry = byUrl.get(doc.url);
      if (entry) entry.covers.push(sku.sku);
      else byUrl.set(doc.url, { doc, covers: [sku.sku] });
    }
  }
  return Array.from(byUrl.values()).map(({ doc, covers }) => {
    const local = doc.url.startsWith("/");
    const host = local ? "Summit" : new URL(doc.url).hostname.replace(/^www\./, "");
    const base = {
      id: `doc:${doc.url}`,
      title: doc.title,
      summary: `${DOCUMENT_KIND[doc.kind] ?? "Document"} for ${covers.slice(0, 4).join(", ")}${covers.length > 4 ? ` and ${covers.length - 4} more` : ""}.`,
      topics: ["Product documents"] as ResourceTopic[],
      audience: ["contractor", "homeowner"] as ResourceAudience[],
      updated: doc.retrievedAt ?? null,
      destination: doc.url,
    };
    if (doc.kind === "product_page") {
      return validateResource({ ...base, type: "external", source: host, opensInNewTab: true, destination: doc.url });
    }
    const info = local ? fileInfo(doc.url) : { sizeBytes: null, exists: true };
    return validateResource({
      ...base,
      type: "document",
      fileType: /\.pdf($|\?)/i.test(doc.url) ? "PDF" : "Web page",
      sizeBytes: info.sizeBytes,
      source: local ? "Hosted by Summit" : `From ${host}`,
      opensInNewTab: true,
      covers,
      available: info.exists,
    });
  });
}

/* Filtering ------------------------------------------------------------------ */

export type ResourceFilters = { q: string; type: ResourceType | null; topic: ResourceTopic | null };

export function parseResourceFilters(params: { get(name: string): string | null }): ResourceFilters {
  const type = params.get("type");
  const topic = params.get("topic");
  return {
    q: (params.get("q") ?? "").trim().slice(0, 100),
    type: type && type in RESOURCE_TYPE_LABEL ? (type as ResourceType) : null,
    topic: topic && (RESOURCE_TOPICS as readonly string[]).includes(topic) ? (topic as ResourceTopic) : null,
  };
}

export function serializeResourceFilters(filters: ResourceFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.topic) params.set("topic", filters.topic);
  return params.toString();
}

export function filterResources(items: ResourceItem[], filters: ResourceFilters): ResourceItem[] {
  const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (filters.type && item.type !== filters.type) return false;
    if (filters.topic && !item.topics.includes(filters.topic)) return false;
    if (words.length) {
      const haystack = `${item.title} ${item.summary} ${item.topics.join(" ")} ${item.type === "document" ? item.covers.join(" ") : ""}`.toLowerCase();
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}
