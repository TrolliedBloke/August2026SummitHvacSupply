import { z } from "zod";

/** A California privacy request (know, delete, correct). Opt-out has its own page. */
export const PRIVACY_REQUEST_KINDS = [
  { value: "know", label: "Tell me what you hold about me (and send a copy)" },
  { value: "delete", label: "Delete my personal information" },
  { value: "correct", label: "Correct something you hold about me" },
] as const;

export const privacyRequestSchema = z.object({
  kind: z.enum(["know", "delete", "correct"], { message: "Choose what you'd like us to do." }),
  email: z.string().trim().max(254).email("Enter the email address the request is about."),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  details: z.string().trim().max(2000, "Keep it under 2,000 characters.").optional().or(z.literal("")),
  clientRequestId: z.uuid().optional(),
});

export type PrivacyRequestForm = z.infer<typeof privacyRequestSchema>;
