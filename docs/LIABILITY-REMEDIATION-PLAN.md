# Liability remediation plan

Status: technical work built 2026-10-05 (see "Build status" below); owner, counsel and accountant decisions still open. Owners: Vincent La and Gabriel Chi (build), the owner of Summit HVAC Supply (operations decisions), counsel and the accountant (legal and tax questions).

Source: the liability review of 2026-10-04, traced through the code and the live database. Every finding below was checked against code or data, and the file references are where it lives today.

## Why this matters, in one paragraph

Summit is the seller of record: it takes the money, owns the stock, sets the return and warranty terms, collects sales tax and makes claims about products. Most exposure comes from three things:
- taking money without delivering
- promising something the operation does not do
- selling a product to someone who cannot legally use or install it

The site was built carefully on the third point (honest stock, photo and compatibility labelling). The gaps are mostly in what happens *after* a customer acts: payments that land late, returns and warranty claims nobody sees, and tax, consent and privacy obligations that need a process rather than a page.

## Where we are today

- **No product can be bought by card yet.** All 100 catalog records are quote-only (`purchaseEligible` is false for every product). The payment risks in Phase 1 are dormant until card sales are switched on; Phase 1 is the gate for doing that.
- **Live today:** returns nobody is notified about, no warranty intake, the published returns policy, the privacy wording, the AI chat's claims, R-410A quote requests, and the hourly background job being off.
- **Contract context:** under the e-commerce agreement, the owner is the merchant of record and keeps responsibility for taxes, fulfilment, warranties, returns and product liability. The site still has to carry out those obligations correctly, or the operator's work creates the exposure.

## Build status (2026-10-05)

Everything that doesn't wait on a decision is built, with safe defaults (hold or block, never promise) where a decision is pending. Migrations 039–046 are applied to the live database. The code is in the working tree, not yet committed.

| Item | State | Where |
|---|---|---|
| 1.1 Authorize, then capture after stock check | Built | `capture_method: "manual"` in `src/lib/backend/checkout.ts`; capture/cancel in `/admin/fulfillment`; webhook `amount_capturable_updated` (redeploy needed) |
| 1.2 Reconciliation every 15 min | Built; **runs once `private.app_config` is filled** | `src/lib/payments/reconcile.ts`, `src/lib/backend/payments.ts`, `/api/payments/safety`, migration 041 |
| 1.3 Late payment held, never silent | Built | migrations 039/040 (`paid_needs_review`); declines no longer release the order (webhook) |
| 1.4 Confirmation email, retried and alerted | Built | `ensureOrderConfirmation`, `claim_order_confirmation` (040) |
| 1.5 Hourly job back on, heartbeat | Heartbeats built; **owner must fill `app_config` and activate** | BACKEND_SETUP §3, §10 |
| 1.6 Credit limits | Built; **every net-terms order holds until limits are set (O-3)** | `src/lib/payments/credit.ts` |
| 2.1–2.3 Returns reach staff; `/admin/returns`; guest and phone returns | Built | `src/lib/backend/returns.ts`, `/returns/start`, `/admin/returns` |
| 2.4 Delivery dates | Built (uses `fulfilled_at`) | `daysSince` in returns |
| 2.5 Warranty intake | Built | `/warranty`, `src/lib/backend/warranty.ts` |
| 2.6 Returns page wording | Built: no outcome shown until O-1/C-1 confirm the rules | `return-checker.tsx`, `start-return-form.tsx` |
| 3.1 Install/warranty acknowledgement | Built with **draft wording pending C-6** | `src/lib/compliance/order-checks.ts` |
| 3.2 R-410A gate | Built (contractor-only + attestation, quotes flagged) pending C-2 | same; `src/lib/backend/quote.ts` |
| 3.3 CA efficiency at checkout | Built (noncompliant holds; unrated notes for staff) | same |
| 3.4 Refrigerant gate | Built (trade + EPA 608); no refrigerant products listed yet | same |
| 3.5 Structured address | **Not built** (needs an address service choice); ShipStation sends free text | |
| 3.6 Inspect before you sign | Built | shipped email, confirmation, checkout copy |
| 3.7 Pickup ID check | Built, enforced in the database (043) | `/admin/fulfillment` |
| 4 Sales tax | Safe default built: computed for Newark only; other addresses are quoted. **A-1 decides the source** | `VERIFIED_TAX_RATES` in `src/lib/backend/pricing.ts` |
| 5.1 Chat | Shared rate limit + daily cap built (046); claim eval `npm run eval:chat` written, not yet run (needs API key, costs cents); model unchanged (owner) | `src/app/api/chat/route.ts`, `scripts/chat-eval.ts` |
| 5.2 Ads | Already gated (`src/lib/ads-config.ts`) | |
| 5.3 Referral wording | **Waiting on C-4** | |
| 6.1–6.2 Privacy requests | Built: intake with email confirmation, report, JSON export, erasure | `/privacy/request`, `/admin/privacy`, migrations 044/045 |
| 6.3 Retention | Function built, dry-run default, **not scheduled until C-7** | `private.apply_retention` |
| 7.1 Alerts | Built; **set `OPS_ALERT_EMAIL`** | `/admin/alerts`, `/api/health/jobs` |
| 7.2 Sentry | **Not built** (needs an account) | |
| 7.3 Audit trail | Built for capture, cancel, refund, holds, RMA, warranty, privacy | `activity_log` |
| 7.4 Runbooks | Written | `docs/RUNBOOKS.md` |

## Priority and phases

| Phase | Theme | Blocks | Effort |
|---|---|---|---|
| 0 | Decisions and counsel questions | Everything legal-dependent | 1 week (people time) |
| 1 | Money safety | **Enabling card sales** | 1–1.5 weeks |
| 2 | Returns and warranty intake | Nothing; live gap today | 1 week |
| 3 | Checkout acknowledgements and compliance gates | Enabling card sales to homeowners | 1 week |
| 4 | Sales tax | **Enabling card sales** outside Alameda County | 2–3 days with a tax service |
| 5 | Claims and content | Turning on ads; chat in production | 3–5 days |
| 6 | Privacy operations | Nothing; legal deadline exposure today | 3–4 days |
| 7 | Monitoring, alerts and runbooks | Supports every phase | 2–3 days |

Phases 1, 3 and 4 together form the **card-sales launch gate** (section 9). Phases 2 and 6 fix gaps that exist today and should start immediately, in parallel.

---

## Phase 0: Decisions and counsel questions

Nothing in later phases should guess at these. Each answer is recorded in `docs/DESIGN-REMEDIATION-STATUS.md`, with the source and date.

### Operations decisions (owner)

| # | Decision | Needed by |
|---|---|---|
| O-1 | The returns window, restocking fee, concealed-damage window and RMA validity. Confirm or change the values in `src/lib/returns-policy.ts` (30 days / 15% / 5 business days / 15 days). | Phase 2 |
| O-2 | Who may collect a will-call order (named buyer only, with ID? a company employee with the PO?). | Phase 3 |
| O-3 | The credit limit and payment terms per contractor account, and what happens when an order would exceed them (block, or hold for approval). | Phase 3 |
| O-4 | Whether online stock confirmation is done by the counter before the card is charged (recommended), and within what time. | Phase 1 |
| O-5 | Who receives the alert emails: returns, warranty claims, payment problems (one shared inbox, e.g. `orders@`). | Phases 1–2 |

### Counsel questions (lawyer)

| # | Question | Finding |
|---|---|---|
| C-1 | Does the published returns policy (document v1.1) bind us even though the operational values are unconfirmed? What must change before launch? | Returns policy published but unconfirmed |
| C-2 | Can pre-2025 R-410A split equipment be sold for installation in California, and to whom? Is a contractor attestation enough? | R-410A sales in California |
| C-3 | Do refrigerant sales need EPA 608 certification checks at the point of sale (none are listed yet; the menu has a "Refrigerant" category)? | Refrigerant sales |
| C-4 | What wording do installer referrals need (independent contractor, no endorsement, no warranty of work)? | Installer referrals |
| C-5 | Does uploading customer emails to Meta or Google ad audiences count as "sharing" under CCPA/CPRA? Approve `docs/PRIVACY-AD-SHARING-DRAFT.md` before ads are switched on. | Privacy policy says "we do not sell or share" |
| C-6 | What wording, and what buyer acknowledgement, is needed for manufacturer warranty limits on internet sales and unlicensed installation? | No warranty acknowledgement at checkout |
| C-7 | How long should chat transcripts, the email log and order records be kept? | Retention |

### Accountant question

| # | Question |
|---|---|
| A-1 | The sales-tax approach for California deliveries outside Alameda County (district rates). Should we use a service (Stripe Tax or similar)? How do we handle tax already over- or under-collected, if any orders were taxed before the fix? |

---

## Phase 1: Money safety (launch gate)

**Goal:** a customer is never charged for something we cannot deliver, and any payment problem is caught within 15 minutes.

### 1.1 Authorize at checkout, capture after the stock is confirmed

- **Problem:** the counter sells from QuickBooks, which syncs to the site every 15 minutes, and online orders never reach QuickBooks. The counter can sell a unit an online customer has just paid for.
- **Fix:**
  - Create card PaymentIntents with `capture_method: "manual"` (`src/lib/backend/checkout.ts`). The card is authorized at checkout but no money moves.
  - The order appears in a new **"Confirm stock"** queue in `/admin/fulfillment`, also as a CRM task and an email to the O-5 inbox.
  - The counter checks the shelf and clicks **Confirm**, which captures the payment. **Can't fulfil** cancels the authorization, so the customer is never charged, and the customer gets an email.
  - If nobody acts within the operations window (O-4, at most 5 days, because card authorizations expire after about 7), an alert fires. At the hard limit, the authorization is cancelled automatically and the customer is emailed.
  - The order state machine gains `authorized` (between `payment_pending` and `paid`). Only `paid` orders export to ShipStation (`src/lib/backend/shipstation.ts`, `readyToFulfil`).
- **Acceptance:**
  - A test order shows "authorized" in Stripe, with no capture until Confirm.
  - Cancelling releases the authorization and stock and emails the buyer.
  - An unconfirmed authorization alerts on day 3 and cancels at the limit.

### 1.2 Payment reconciliation job

- **Problem:** if Stripe's payment message never reaches us (function not deployed, wrong secret, database error), the order sits at "payment pending" forever and nobody knows.
- **Fix:**
  - A scheduled job every 15 minutes lists Stripe PaymentIntents from the last 7 days with `metadata.order_id`.
  - It compares each with `sales_orders` and `order_payments`, and finds:
    - authorized or succeeded in Stripe but not recorded
    - recorded as paid but refunded in Stripe and not reversed
    - amounts that differ
  - Each mismatch is repaired where safe (record the payment through the same `mark_order_paid` path, idempotent on the event id). It always creates a `payment_issue` task and an alert email.
  - Results go into a new `payment_reconciliation_runs` table (counts, issues found, fixed).
- **Acceptance:** with the webhook disabled, a test payment is detected and recorded within 15 minutes and an alert is sent. A refund made only in Stripe is caught.

### 1.3 Never silently cancel a paid order

- **Problem:** if payment arrives after the 30-minute hold expires, the order is cancelled and its stock released, but the money is taken (`expire_stale_checkout_orders`, `mark_order_paid`, migration 010).
- **Fix:**
  - When an order expires, cancel its PaymentIntent in Stripe (called by the dispatch route that runs the expiry), so a late payment can't go through.
  - Change `mark_order_paid`: if the order is already cancelled or expired, record the payment, set `checkout_state = 'paid_needs_review'` and do **not** treat the order as live.
  - Then raise an urgent task and alert: re-reserve the stock if it is still available, otherwise refund. A paid order is never left in a cancelled state without someone being told.
  - The confirmation page (`src/lib/order-confirmation.ts`) must never show "payment failed" to a customer whose payment succeeded. It shows "Payment received, we're confirming your order".
- **Acceptance:** a payment simulated after expiry produces a review task, an alert and the correct customer message. No shipment and no silent cancellation.

### 1.4 Order confirmation email

- **Problem:** card buyers get no confirmation email from Summit. `sales_orders.confirmation_email_status` exists but nothing writes it.
- **Fix:**
  - Send the confirmation from the payment path (after authorization in 1.1, and again with "payment captured" after Confirm).
  - Write `confirmation_email_status` and its attempts, and retry failures from the hourly job, up to 5 attempts.
  - Content: the order number, items, total, fulfilment method, what happens next (the stock confirmation), how to contact us, the returns and warranty links, and for freight "inspect before signing" (see 3.6).
  - Logged in `email_messages` like every other send.
- **Acceptance:** every authorized order has `confirmation_email_status = sent` or an open alert.

### 1.5 Turn the hourly job back on

- **Problem:** `lifecycle-dispatch-hourly` is **inactive** on the live database. It runs checkout expiry, retries and reminder emails.
- **Fix:**
  - Find out why it was disabled (check `cron.job_run_details` and the setup history).
  - Set `CRON_SECRET` in Vercel and in `private.app_config`, then re-enable the job.
  - Add a heartbeat: each run writes a row, and the monitoring in Phase 7 alerts if no run is recorded for 2 hours.
- **Acceptance:** the job runs every hour, the heartbeat is visible, and a missed run alerts.

### 1.6 Contractor credit limits

- **Problem:** net-terms orders don't check `accounts.credit_limit` (`src/lib/checkout-snapshot.ts`).
- **Fix:** at checkout, open AR balance + new order total ≤ credit limit (O-3). Over the limit, the order is held for approval and staff are alerted, or blocked, depending on O-3. Unapproved trade accounts can never use net terms.
- **Acceptance:** a test account at its limit cannot place a net-terms order without approval.

---

## Phase 2: Returns and warranty intake (live gap; start now)

**Goal:** every return and warranty claim reaches a person the same day, and is tracked to a resolution.

### 2.1 Returns reach staff

- **Problem:** an RMA created in the portal (`src/lib/backend/returns.ts`) sends no email, creates no task and has no admin page.
- **Fix:**
  - Extend the auto-task trigger (migration 038) to `rmas`: a new RMA opens a task due the next business day.
  - Email the O-5 inbox: the RMA number, order, item, reason, the customer's answers and the preliminary outcome.
  - Email the customer an acknowledgement with the RMA number, the next steps and how long the RMA is valid.
  - Show returns in the customer view (the person page lists their RMAs).
- **Acceptance:** creating an RMA produces a staff email, a customer email, a task and a row in `/admin/returns` within a minute.

### 2.2 `/admin/returns`

- A staff page listing RMAs by status (open, waiting, approved, closed), age and preliminary outcome.
- Actions:
  - approve with the refund amount (restocking fee per policy)
  - request photos or information (emails the customer)
  - record "received and inspected"
  - close with the reason

  Each action is logged with the staff member.
- **Refund linking:** approving a refund calls Stripe (`refunds.create` with `metadata.rma_number`), so the refund is tied to the RMA and the existing webhook records the reversal. No more untraceable dashboard refunds.
- **Acceptance:** an RMA can go from open to refunded entirely in the admin. The refund shows in Stripe with the RMA number, and the ledger matches.

### 2.3 Guest buyers and phone returns

- Guest orders have no portal account. Add a "Start a return" page that verifies the order number and email with a signed link sent to the order's email (no account needed), then follows the same flow.
- Staff can also open an RMA for a customer who calls.
- **Acceptance:** a guest can start a return with only their order email; nobody can start one for someone else's order.

### 2.4 Delivery dates

- **Problem:** there's no recorded delivery date for shipped orders, so a "within 30 days" claim can't be checked.
- **Fix:**
  - Record `delivered_at` from ShipStation or carrier tracking when available, otherwise from staff marking it delivered.
  - Use this instead of the customer's own answer in `evaluateReturn` whenever it is known.

### 2.5 Warranty claim intake

- **Problem:** there is no way to file a warranty claim. Installed equipment returns end at "this is a warranty question", and nobody at Summit is told. The `warranty_claims` table is unused.
- **Fix:** a **"Warranty claim"** form (`/warranty`), linked from:
  - the returns flow's warranty outcome
  - the order confirmation and shipped emails
  - product pages and the portal

  It collects:
  - the order (looked up, or entered for counter sales)
  - product, model and serial number
  - install date, and the installer's name and license number
  - the symptom, photos and any error codes

  On submit:
  - a `warranty_claims` row, a staff task and an email to the O-5 inbox
  - a customer acknowledgement explaining the manufacturer's process and what Summit will do (coordinate with the manufacturer, not decide the claim)
- **Registration reminders:** once 1.5 is done, the existing warranty-registration email resumes. Add a staff-visible list of orders whose registration window is closing.
- **Acceptance:** submitting a claim produces the row, task, staff email and customer email. Claims appear in the customer view.

### 2.6 Returns policy page

- Depends on C-1 and O-1. Until the values are confirmed, the public returns page should say "Returns are reviewed by our team; call or start a return and we'll confirm the terms for your order", instead of stating numbers operations hasn't approved. When confirmed, publish the new version (`src/content/legal/returns.tsx`, a new document version) and set `RETURNS_RULES.review` to confirmed.

---

## Phase 3: Checkout acknowledgements and compliance gates (launch gate for homeowners)

**Goal:** a buyer can't purchase equipment without knowing the conditions that affect its warranty and legality, and can't buy what they may not use.

### 3.1 Warranty and licensed-installation acknowledgement

- For equipment categories (not supplies), checkout requires a checkbox. Wording from counsel (C-6), for example: "This equipment must be installed by a licensed HVAC contractor, with any required permit. Manufacturer warranty may be limited or void otherwise. I've read the warranty terms."
- Store the acknowledgement (the text version, timestamp, order) on the order, so it is evidence in a dispute.
- **Acceptance:** an equipment order cannot be submitted without it; the stored text matches what was shown.

### 3.2 R-410A gate

- Until C-2 is answered, R-410A equipment (17 records today) can be requested or ordered only by an approved contractor account, with an attestation ("for an installation permitted under current California rules").
- Homeowners and guests see a notice and a "talk to the counter" path. This applies to quotes as well as checkout (the quote drawer and `/api/quote-requests`).
- Drive it from `src/lib/refrigerant-policy.ts`, so a counsel answer changes one value.

### 3.3 California efficiency minimums at quote and checkout

- The finder already excludes non-compliant equipment for homeowners (`src/lib/catalog/compliance.ts`).
- Apply the same rule at quote and checkout: a homeowner order or quote containing non-compliant equipment for their ZIP shows a notice and requires counter review.

### 3.4 Refrigerant sales gate

- Before any refrigerant product is listed: require an approved trade account with an EPA 608 certification on file (`epa608_on_file` / `epa608_sighted_at` already exist), per C-3. Add a catalog check that refuses to publish a refrigerant product without this gate.

### 3.5 Address checking

- Use an address-checking service at checkout for delivery and freight (structured fields: street, city, state, ZIP), instead of one free-text box. Store the structured address, so ShipStation gets real fields (`src/lib/backend/shipstation.ts` currently sends one line).
- When a delivery ZIP falls outside the service area, block it before payment, not after.

### 3.6 Freight inspection notice

- The shipped email (`sendShippedEmail`), the order confirmation for freight, and the delivery page all say: "Inspect before you sign. Note any damage on the delivery receipt, or the carrier may refuse the claim." This keeps the returns policy's damage rule enforceable.

### 3.7 Will-call pickup check

- Per O-2: the pickup confirmation email includes the name allowed to collect. Staff confirm the name and ID (or company PO) in `/admin/fulfillment` before marking it picked up; the record stores who confirmed it.

---

## Phase 4: Sales tax (launch gate outside Alameda County)

- **Problem:** every California ZIP is charged Newark's 10.75% (`src/lib/backend/pricing.ts`). The code's own comment says that rate is valid only in Newark.
- **Fix, per A-1:**
  - Recommended: turn on Stripe Tax (destination-based California district rates; returns calculated tax on the PaymentIntent).
  - Alternative: a California district-rate table by ZIP, kept current quarterly.
  - Pickup stays at the Newark rate.
  - Show tax as final at payment, not "estimated", and store the rate and jurisdiction on the order.
- Ask the accountant how to report or correct any tax already collected before the fix.
- **Acceptance:** test deliveries to Newark, San Jose, San Francisco and Oakland ZIPs charge each one's district rate, and the stored rate matches what was shown.

---

## Phase 5: Claims and content

### 5.1 AI chat

- **Model:** confirm the model id in `src/app/api/chat/route.ts` (`claude-opus-4-8`) is valid. A cheaper current model may fit a store assistant better.
- **Claim limits:**
  - add a test suite of the questions most likely to produce a promise, and run it before each deploy:
    - prices and discounts
    - stock and lead times
    - compatibility
    - rebates
    - installation advice
    - legal (R-410A)
    - attempts to override its instructions ("ignore your instructions")
  - a failing answer blocks the deploy
- **Rate limit:** move it from memory per server instance to a shared store (Supabase or Vercel KV), so the real limit holds under load. Add a daily spend cap.
- Retention: see 6.3.

### 5.2 Advertising and privacy wording

- Keep ads off until C-5 is answered.
- Before switching on any ad audience: publish the approved privacy-policy version; add "Do not share my personal information" in the footer and on `/privacy/opt-out`; make audience exports honour opt-outs and GPC (they already require consent).
- Add a check so `ads enabled` can't be set while the published policy version still says "we do not share".

### 5.3 Installer referrals

- Add the counsel-approved wording (C-4) to referral introductions, the homeowner request confirmation and the email the installer receives.
- Keep the existing license-verified-only rule.

### 5.4 Product and marketing claims

- Keep the media and compatibility honesty rules. Add a release check: no page or email may claim "verified", "in stock", "matched", "certified", a delivery time, a response time, a fee or a rebate amount unless the source record is confirmed. Use the existing review states in `src/lib/fulfillment-policy.ts` and `returns-policy.ts`.

---

## Phase 6: Privacy operations

### 6.1 Request handling (know, delete, correct)

- A staff page: **"Privacy request"**. Enter an email to get a report of every record held about that person across all tables:
  - orders, requests, carts, alerts, finder, consents
  - email log, chat transcripts, reviews, account
- **Export:** a downloadable file for "right to know".
- **Delete:** erase or anonymise everything not needed for legal retention. Orders, tax and warranty records are kept but stripped of marketing data, per C-7.
- A request log records the received date, the identity check and the completion date, with a 45-day due date and a task.

### 6.2 Request intake

- A privacy request form (in addition to email) that creates the logged request and a task, and emails the person a verification link.

### 6.3 Retention

- Scheduled deletion per C-7, for example:
  - chat transcripts after 90 days
  - abandoned carts after 90 days
  - finder sessions without an email after 30 days
  - email log bodies were never stored; the rows are kept for 2 years
- Recorded in `BACKEND_SETUP.md`.

---

## Phase 7: Monitoring, alerts and runbooks

### 7.1 Alerts

One alert path (an email to the O-5 inbox, plus Sentry or similar for errors) for:
- payment reconciliation issues (1.2)
- paid orders needing review (1.3)
- authorizations near expiry (1.1)
- webhook failures: Stripe, ShipStation, Resend (any 5xx)
- the hourly job heartbeat missing (1.5)
- QuickBooks sync failures (`quickbooks_sync_runs`)
- confirmation emails failing after retries (1.4)
- new returns and warranty claims (2.1, 2.5)
- open privacy requests nearing their deadline (6.1)

### 7.2 Error tracking and logs

- Add Sentry (or Vercel's equivalent) to the Next.js app and the Supabase edge functions, with customer emails redacted.
- Keep server logs for at least 30 days.

### 7.3 Audit trail

- Every money or customer-affecting staff action is written to `activity_log` with the staff member: capture, cancel, refund, RMA decision, warranty decision, privacy deletion.

### 7.4 Runbooks (`docs/RUNBOOKS.md`)

One page each, so whoever is on duty knows exactly what to do:
- Customer says they were charged but have no order.
- An order is paid but the stock is gone.
- A refund or return request.
- A warranty claim.
- The Stripe webhook is failing.
- A privacy request.
- A suspected data breach: who to contact and the notification duties (C-7).

---

## 8. Tests for every phase

Each fix ships with automated tests (unit and end-to-end, like `tests/pipeline.test.ts`), plus a rolled-back live-database check where it touches the database (`docs/QA-PROMPT.md` §2). Add these scenarios to the QA prompt:

- payment arriving after expiry
- the webhook down for an hour
- authorization near expiry
- an over-limit contractor
- an R-410A homeowner quote
- a guest return
- a warranty claim
- tax by ZIP
- a privacy export and delete

## 9. Card-sales launch gate

Do not set any product to `purchaseEligible` until all of these are true:

- [ ] Phase 1 complete:
  - authorize then capture
  - reconciliation running
  - no silent cancellation of paid orders
  - confirmation email
  - hourly job on, with a heartbeat
  - credit limits enforced
- [ ] Phase 3.1–3.5 complete (acknowledgement, R-410A gate, efficiency gate, address checking).
- [ ] Phase 4 complete (tax by destination), or card sales limited to pickup at Newark.
- [ ] Phase 7.1 alerts live and tested.
- [ ] Returns flow live (Phase 2.1–2.3), and the published returns policy confirmed (2.6).
- [ ] Counsel answers C-1, C-2, C-6 recorded.
- [ ] Stripe live webhook verified with a real low-value test order and refund.
- [ ] The QA prompt run with no open P0 or P1.

## 10. Order of work

1. **Now, in parallel:**
   - send the Phase 0 questions to the owner, counsel and the accountant
   - Phase 2 (returns and warranty), which fixes a live gap
   - Phase 6.1 (privacy requests, also a live obligation)
   - 1.5 (turn the hourly job on)
2. **Then:** Phase 1 and Phase 7 (money safety and alerts).
3. **Then:** Phase 3 and Phase 4 once counsel and the accountant answer.
4. **Then:** Phase 5 before ads or a wider chat rollout.
5. **Launch card sales** only when section 9 is fully checked.
