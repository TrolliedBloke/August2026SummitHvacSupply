import { HOME_SIZES, type HomeownerAnswers } from "./questions";

/**
 * Finder answers carried into the homeowner request so nobody types them
 * twice. Lives in sessionStorage (this tab only) and holds only what the form
 * shows; the server links the two records through the finder's signed cookie,
 * not through anything in here.
 */
export const FINDER_HANDOFF_KEY = "summit-finder-handoff-v1";
const HANDOFF_TTL_MS = 2 * 60 * 60_000;

export type HomeownerPrefill = {
  zip?: string;
  zones?: string;
  existingDucts?: "yes" | "no" | "unknown";
  timeline?: "asap" | "month" | "quarter" | "researching";
};

export function prefillFromAnswers(answers: HomeownerAnswers): HomeownerPrefill {
  const size = HOME_SIZES.find((option) => option.value === answers.size);
  const ducts =
    answers.current === "ducted_central" || answers.current === "furnace_only"
      ? "yes"
      : answers.current === "no_ducts"
        ? "no"
        : answers.current === "unsure"
          ? "unknown"
          : undefined;
  return {
    zip: answers.zip,
    zones: size && size.value !== "unsure" ? `${size.label} (${"hint" in size ? size.hint : ""})`.replace(" ()", "") : undefined,
    existingDucts: ducts,
    timeline: answers.goal === "replace_failed" ? "asap" : undefined,
  };
}

export function storeHandoff(prefill: HomeownerPrefill): void {
  try {
    window.sessionStorage.setItem(FINDER_HANDOFF_KEY, JSON.stringify({ savedAt: Date.now(), prefill }));
  } catch {
    /* storage unavailable: the form simply starts empty */
  }
}

/** Read once and clear, so a later visit to the form starts clean. */
export function takeHandoff(): HomeownerPrefill | null {
  try {
    const raw = window.sessionStorage.getItem(FINDER_HANDOFF_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(FINDER_HANDOFF_KEY);
    const parsed = JSON.parse(raw) as { savedAt: number; prefill: HomeownerPrefill };
    if (Date.now() - parsed.savedAt > HANDOFF_TTL_MS) return null;
    return parsed.prefill;
  } catch {
    return null;
  }
}
