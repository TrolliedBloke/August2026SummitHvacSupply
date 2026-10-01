/**
 * Operational return rules as versioned data, evaluated the same way by the
 * public checker on /returns and by the server when an RMA is started from an
 * order line. Legal wording stays in src/content/legal/returns.tsx; every
 * outcome here cites the section of that document whose rule fired.
 *
 * The result is always PRELIMINARY. Staff inspect every return; nothing here
 * approves one.
 *
 * TODO(summit-ops): confirm these values against the counter's practice.
 */

export const RETURNS_RULES = {
  version: "returns-rules-2026.08",
  documentVersion: "1.1",
  review: { status: "pending_operations" as "pending_operations" | "confirmed", reviewedAt: null as string | null },
  windowDays: 30,
  restockingFeePercent: 15,
  concealedDamageBusinessDays: 5,
  rmaValidDays: 15,
} as const;

export function returnsRulesAreConfirmed(): boolean {
  return RETURNS_RULES.review.status === "confirmed";
}

export type ReturnFacts = {
  /** Wrong item, damaged in transit, or dead on arrival. */
  arrivedDamagedOrWrong?: boolean;
  /** For damage: was it written on the delivery receipt before signing? */
  damageNotedOnReceipt?: boolean;
  /** Mounted, wired, brazed, energized, or charged with refrigerant. */
  installed?: boolean;
  specialOrder?: boolean;
  /** An opened or partially used refrigerant cylinder. */
  openedRefrigerant?: boolean;
  opened?: boolean;
  daysSinceDelivery?: number;
};

export type ReturnQuestion = keyof ReturnFacts;

export type ReturnOutcome =
  | { kind: "needs"; question: ReturnQuestion }
  | {
      kind: "result";
      verdict: "full_refund" | "refund_less_restocking" | "not_returnable" | "damage_claim" | "late_damage_claim" | "warranty";
      reasonCode: string;
      headline: string;
      explanation: string;
      sectionId: string;
      rulesVersion: string;
      documentVersion: string;
    };

function result(
  verdict: Extract<ReturnOutcome, { kind: "result" }>["verdict"],
  reasonCode: string,
  headline: string,
  explanation: string,
  sectionId: string
): ReturnOutcome {
  return {
    kind: "result",
    verdict,
    reasonCode,
    headline,
    explanation,
    sectionId,
    rulesVersion: RETURNS_RULES.version,
    documentVersion: RETURNS_RULES.documentVersion,
  };
}

/**
 * Ask only for the fact the next rule needs. Rules run in the order the policy
 * applies them: our error first (it overrides everything), then installation,
 * then the non-returnable classes, then condition and time.
 */
export function evaluateReturn(facts: ReturnFacts): ReturnOutcome {
  if (facts.arrivedDamagedOrWrong === undefined) return { kind: "needs", question: "arrivedDamagedOrWrong" };
  if (facts.arrivedDamagedOrWrong) {
    if (facts.damageNotedOnReceipt === undefined) return { kind: "needs", question: "damageNotedOnReceipt" };
    if (facts.damageNotedOnReceipt) {
      return result("damage_claim", "damage_noted", "Likely replaced at no cost", "Damage noted on the receipt, or a wrong or dead unit, is our error: we replace it and cover freight both ways, with no restocking fee.", "freight-damage-inspect-before-you-sign");
    }
    if (facts.daysSinceDelivery === undefined) return { kind: "needs", question: "daysSinceDelivery" };
    if (facts.daysSinceDelivery <= RETURNS_RULES.concealedDamageBusinessDays) {
      return result("damage_claim", "concealed_damage_in_window", "Report it now as concealed damage", `Concealed damage must be reported within ${RETURNS_RULES.concealedDamageBusinessDays} business days of delivery, with photos and the serial number.`, "freight-damage-inspect-before-you-sign");
    }
    // Five business days can span seven calendar days across a weekend.
    if (facts.daysSinceDelivery <= RETURNS_RULES.concealedDamageBusinessDays + 2) {
      return result("damage_claim", "concealed_damage_borderline", "Report it today -- it may still be in the window", `The carrier allows ${RETURNS_RULES.concealedDamageBusinessDays} business days. Depending on weekends and holidays you may still be inside it; staff will check the delivery date.`, "freight-damage-inspect-before-you-sign");
    }
    return result("late_damage_claim", "concealed_damage_late", "We will help, but recovery is not guaranteed", "Damage reported after the carrier's window, or a receipt signed clean, limits what the carrier will pay. Staff review these case by case.", "freight-damage-inspect-before-you-sign");
  }
  if (facts.installed === undefined) return { kind: "needs", question: "installed" };
  if (facts.installed) {
    return result("warranty", "installed", "Not returnable -- this is a warranty question", "Installed equipment is no longer resalable. Defects after installation are handled under the manufacturer warranty.", "warranty-is-separate-from-returns");
  }
  if (facts.specialOrder === undefined) return { kind: "needs", question: "specialOrder" };
  if (facts.specialOrder) {
    return result("not_returnable", "special_order", "Special orders are not returnable", "Items brought in for your job cannot be returned unless they arrived defective or damaged.", "what-cannot-be-returned");
  }
  if (facts.openedRefrigerant === undefined) return { kind: "needs", question: "openedRefrigerant" };
  if (facts.openedRefrigerant) {
    return result("not_returnable", "opened_refrigerant", "Opened refrigerant cannot come back", "Opened or partially used cylinders cannot be accepted for safety and regulatory reasons.", "what-cannot-be-returned");
  }
  if (facts.daysSinceDelivery === undefined) return { kind: "needs", question: "daysSinceDelivery" };
  if (facts.daysSinceDelivery > RETURNS_RULES.windowDays) {
    return result("not_returnable", "outside_window", `Past the ${RETURNS_RULES.windowDays}-day window`, "Returns after 30 days need prior authorization. Ask the counter -- it is their call, not this checker's.", "what-cannot-be-returned");
  }
  if (facts.opened === undefined) return { kind: "needs", question: "opened" };
  if (facts.opened) {
    return result("refund_less_restocking", "opened_uninstalled", `Likely refundable, less a ${RETURNS_RULES.restockingFeePercent}% restocking fee`, "Opened but uninstalled equipment must be complete, undamaged, and never charged, wired or mounted.", "what-can-be-returned");
  }
  return result("full_refund", "unopened_in_window", "Likely a full refund", "Unopened, resalable equipment in its original packaging, within 30 days of delivery or pickup.", "what-can-be-returned");
}

export const RETURN_QUESTIONS: Record<ReturnQuestion, { prompt: string; kind: "yesno" | "days"; hint?: string }> = {
  arrivedDamagedOrWrong: { prompt: "Did it arrive damaged, dead, or as the wrong item?", kind: "yesno" },
  damageNotedOnReceipt: { prompt: "Was the damage written on the delivery receipt before signing?", kind: "yesno", hint: "Answer yes for a wrong or dead unit." },
  installed: { prompt: "Has it been mounted, wired, brazed, or charged with refrigerant?", kind: "yesno" },
  specialOrder: { prompt: "Was it a special order brought in for your job?", kind: "yesno", hint: "Your order confirmation says so if it was." },
  openedRefrigerant: { prompt: "Is it an opened or partially used refrigerant cylinder?", kind: "yesno" },
  opened: { prompt: "Has the packaging been opened?", kind: "yesno" },
  daysSinceDelivery: { prompt: "How many days ago was it delivered or picked up?", kind: "days" },
};
