/**
 * The seeded (no database) fallback for customer request forms.
 *
 * Locally it lets the forms run without Supabase. In production a missing
 * database means the request would be dropped while the customer is shown a
 * reference number, so production throws instead and the route answers with
 * its "could not send" message -- the same rule checkout follows
 * (src/lib/backend/checkout.ts, CheckoutUnavailableError).
 */
export class RequestStoreUnavailableError extends Error {}

export function assertSeededAllowed(form: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new RequestStoreUnavailableError(`${form}: the request store is not configured, so nothing was saved.`);
  }
}
