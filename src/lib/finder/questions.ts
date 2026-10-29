import { z } from "zod";

/**
 * The system finder's questions, as data. The component renders whatever this
 * file says, so copy and branching change here without touching UI code.
 *
 * Shape: one fork question, then 4-5 questions per path. Every question after
 * the fork can be skipped. Nothing here asks about income or health ("air
 * quality is a priority" is a preference, not a medical question), and the
 * only free-form input is an optional ZIP whose purpose is stated beside it.
 */

export type FinderPath = "homeowner" | "contractor";

export type FinderOption = { value: string; label: string; hint?: string };

export type FinderQuestion = {
  id: string;
  prompt: string;
  /** Why we ask, shown under the prompt. */
  help?: string;
  kind: "choice" | "zip";
  options?: readonly FinderOption[];
};

/* ---------------------------------------------------------------- the fork */

export const FORK_OPTIONS = [
  { value: "homeowner", label: "My home", hint: "Help choosing a system and finding an installer" },
  { value: "contractor", label: "I'm a contractor", hint: "Stock, will-call and trade accounts" },
  { value: "browse", label: "I know what I need", hint: "Go straight to the catalog" },
] as const satisfies readonly FinderOption[];

/* ----------------------------------------------------------- homeowner path */

export const HOMEOWNER_GOALS = [
  { value: "replace_failed", label: "My system stopped working" },
  { value: "replace_aging", label: "Replacing an aging system" },
  { value: "add_rooms", label: "Cooling or heating for some rooms" },
  { value: "new_space", label: "A new space, addition or ADU" },
] as const satisfies readonly FinderOption[];

export const CURRENT_SYSTEMS = [
  { value: "ducted_central", label: "Central system with ducts" },
  { value: "furnace_only", label: "Furnace only, no air conditioning" },
  { value: "no_ducts", label: "No ducts", hint: "Wall, baseboard or space heaters" },
  { value: "unsure", label: "Not sure" },
] as const satisfies readonly FinderOption[];

/** Representative floor area per choice, read by lib/sizing.ts. */
export const HOME_SIZES = [
  { value: "room_small", label: "One room", hint: "Up to 400 sq ft", sqft: 400 },
  { value: "room_large", label: "One large room or open area", hint: "400 to 750 sq ft", sqft: 750 },
  { value: "several_rooms", label: "Two to four rooms", hint: "750 to 1,250 sq ft", sqft: 1_250 },
  { value: "home_mid", label: "Whole home", hint: "1,250 to 1,750 sq ft", sqft: 1_500 },
  { value: "home_large", label: "Larger whole home", hint: "1,750 to 2,500 sq ft", sqft: 2_000 },
  { value: "unsure", label: "Not sure", sqft: null },
] as const;

export const PRIORITIES = [
  { value: "upfront", label: "Lowest upfront cost" },
  { value: "bills", label: "Lower energy bills" },
  { value: "comfort", label: "Quiet, even comfort" },
  { value: "air_quality", label: "Air quality is a priority" },
] as const satisfies readonly FinderOption[];

/* ---------------------------------------------------------- contractor path */

export const CONTRACTOR_NEEDS = [
  { value: "job_equipment", label: "Equipment for a job" },
  { value: "parts_supplies", label: "Parts and installation supplies" },
  { value: "open_account", label: "Open a trade account" },
] as const satisfies readonly FinderOption[];

export const CONTRACTOR_SYSTEMS = [
  { value: "mini_split", label: "Mini split" },
  { value: "ducted_heat_pump", label: "Ducted heat pump" },
  { value: "central_ac", label: "Central air conditioner" },
  { value: "air_handler_coil", label: "Air handler or coil" },
  { value: "furnace", label: "Furnace" },
  { value: "cassette", label: "Ceiling cassette" },
] as const satisfies readonly FinderOption[];

export const CONTRACTOR_CAPACITIES = [
  { value: "9000", label: "9,000 BTU" },
  { value: "12000", label: "12,000 BTU" },
  { value: "18000", label: "18,000 BTU" },
  { value: "24000", label: "24,000 BTU (2 tons)" },
  { value: "36000", label: "36,000 BTU (3 tons)" },
  { value: "48000", label: "48,000 BTU (4 tons)" },
  { value: "60000", label: "60,000 BTU (5 tons)" },
] as const satisfies readonly FinderOption[];

export const CONTRACTOR_TIMING = [
  { value: "today", label: "Will-call today" },
  { value: "this_week", label: "This week" },
  { value: "planning", label: "Planning a job" },
] as const satisfies readonly FinderOption[];

const ZIP_QUESTION_HOMEOWNER: FinderQuestion = {
  id: "zip",
  prompt: "What ZIP code is the home in?",
  help: "For climate zone and local permit info only, not marketing.",
  kind: "zip",
};

const ZIP_QUESTION_CONTRACTOR: FinderQuestion = {
  id: "zip",
  prompt: "Where is the job?",
  help: "ZIP code. Used to check delivery routes, not for marketing.",
  kind: "zip",
};

/* ------------------------------------------------------------------ schema */

const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map((option) => option.value) as [T[number]["value"], ...T[number]["value"][]];

const zip = z.string().trim().regex(/^\d{5}$/, "Enter a five-digit ZIP code, or skip this question.");

export const homeownerAnswersSchema = z.object({
  goal: z.enum(values(HOMEOWNER_GOALS)).optional(),
  current: z.enum(values(CURRENT_SYSTEMS)).optional(),
  size: z.enum(values(HOME_SIZES)).optional(),
  priority: z.enum(values(PRIORITIES)).optional(),
  zip: zip.optional(),
});

export const contractorAnswersSchema = z.object({
  need: z.enum(values(CONTRACTOR_NEEDS)).optional(),
  system: z.enum(values(CONTRACTOR_SYSTEMS)).optional(),
  capacity: z.enum(values(CONTRACTOR_CAPACITIES)).optional(),
  timing: z.enum(values(CONTRACTOR_TIMING)).optional(),
  zip: zip.optional(),
});

export const finderSubmissionSchema = z.discriminatedUnion("path", [
  z.object({ path: z.literal("homeowner"), answers: homeownerAnswersSchema }),
  z.object({ path: z.literal("contractor"), answers: contractorAnswersSchema }),
]);

export type HomeownerAnswers = z.infer<typeof homeownerAnswersSchema>;
export type ContractorAnswers = z.infer<typeof contractorAnswersSchema>;
export type FinderSubmission = z.infer<typeof finderSubmissionSchema>;

/* ---------------------------------------------------------------- branching */

/**
 * The questions for a path given the answers so far. Branching keeps each path
 * at four or five questions: a contractor opening an account is not asked for
 * a tonnage, and parts buyers are not asked for a capacity.
 */
export function questionsFor(path: FinderPath, answers: Record<string, string | undefined>): FinderQuestion[] {
  if (path === "homeowner") {
    return [
      { id: "goal", prompt: "What's the project?", kind: "choice", options: HOMEOWNER_GOALS },
      { id: "current", prompt: "What heats and cools the space today?", help: "This decides whether ducted or ductless equipment fits.", kind: "choice", options: CURRENT_SYSTEMS },
      { id: "size", prompt: "How much space?", help: "A rough size is enough. Your installer measures properly.", kind: "choice", options: HOME_SIZES.map((option) => ({ value: option.value, label: option.label, hint: "hint" in option ? option.hint : undefined })) },
      { id: "priority", prompt: "What matters most?", kind: "choice", options: PRIORITIES },
      ZIP_QUESTION_HOMEOWNER,
    ];
  }
  const questions: FinderQuestion[] = [
    { id: "need", prompt: "What do you need?", kind: "choice", options: CONTRACTOR_NEEDS },
  ];
  if (answers.need === "open_account") return questions;
  if (answers.need !== "parts_supplies") {
    questions.push({ id: "system", prompt: "What kind of system?", kind: "choice", options: CONTRACTOR_SYSTEMS });
    if (answers.system !== "furnace") {
      questions.push({ id: "capacity", prompt: "What capacity?", kind: "choice", options: CONTRACTOR_CAPACITIES });
    }
  }
  questions.push({ id: "timing", prompt: "When do you need it?", kind: "choice", options: CONTRACTOR_TIMING });
  questions.push(ZIP_QUESTION_CONTRACTOR);
  return questions;
}

/** Drop answers to questions the final branch no longer asks. */
export function prunedAnswers(path: FinderPath, answers: Record<string, string | undefined>): Record<string, string> {
  const asked = new Set(questionsFor(path, answers).map((question) => question.id));
  return Object.fromEntries(
    Object.entries(answers).filter((entry): entry is [string, string] => asked.has(entry[0]) && typeof entry[1] === "string" && entry[1] !== "")
  );
}

/* ----------------------------------------------------------------- segments */

/**
 * Ad audiences are broad on purpose (docs/FINDER-AND-AUDIENCE-PLAN.md 3.7): an
 * audience needs ~100 matched users before Meta or Google will serve it, so
 * these four are the only segments. Finer personas ride along as tags for
 * email copy and never become audiences.
 */
export type FinderSegment = "contractor" | "homeowner_active" | "homeowner_researching" | "customer";

export const SEGMENT_LABEL: Record<FinderSegment, string> = {
  contractor: "Contractors",
  homeowner_active: "Homeowners replacing now",
  homeowner_researching: "Homeowners researching",
  customer: "Past purchasers",
};

export function segmentFor(submission: FinderSubmission): FinderSegment {
  if (submission.path === "contractor") return "contractor";
  const goal = submission.answers.goal;
  return goal === "replace_failed" || goal === "replace_aging" ? "homeowner_active" : "homeowner_researching";
}

export function tagsFor(submission: FinderSubmission): string[] {
  if (submission.path === "contractor") {
    const { need, timing } = submission.answers;
    return [need === "open_account" ? "account_prospect" : null, timing === "today" ? "will_call_today" : null].filter(
      (tag): tag is string => Boolean(tag)
    );
  }
  const { goal, priority, current } = submission.answers;
  const tags: Array<string | null> = [
    goal === "replace_failed" ? "emergency" : null,
    goal === "new_space" ? "new_construction" : null,
    priority === "upfront" ? "budget" : null,
    priority === "bills" ? "efficiency" : null,
    priority === "comfort" ? "comfort" : null,
    priority === "air_quality" ? "air_quality" : null,
    current === "no_ducts" || goal === "add_rooms" ? "ductless_interest" : null,
  ];
  return tags.filter((tag): tag is string => Boolean(tag));
}

/* ------------------------------------------------------- recap and contract */

/** What each path delivers, stated before the first question (UX fix plan WS-5). */
export const FINDER_CONTRACT: Record<FinderPath, string> = {
  homeowner: "You get a starting size (not a load calculation), matched systems that meet California efficiency rules, and an installer handoff.",
  contractor: "You get matching stock with live Newark counts, then a will-call, quote or trade-account handoff.",
};

export type RecapItem = { index: number; id: string; prompt: string; answer: string };

/**
 * The answers so far, in question order, in the words the buyer chose. Only
 * questions before `upTo` are included, so the recap never shows an answer to
 * the question on screen.
 */
export function finderRecap(path: FinderPath, answers: Record<string, string | undefined>, upTo: number): RecapItem[] {
  return questionsFor(path, answers)
    .slice(0, upTo)
    .map((question, index) => {
      const value = answers[question.id];
      const answer =
        value === undefined
          ? "Skipped"
          : question.kind === "zip"
            ? `ZIP ${value}`
            : question.options?.find((option) => option.value === value)?.label ?? value;
      return { index, id: question.id, prompt: question.prompt, answer };
    });
}
