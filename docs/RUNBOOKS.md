# Runbooks

What to do when something goes wrong with an order, a payment, a return or a person's data. One page each; whoever is on duty should be able to follow it without asking. Background: `docs/LIABILITY-REMEDIATION-PLAN.md`. Setup: `BACKEND_SETUP.md` §10.

Every action below is taken in the admin, where it is logged under your name. Avoid fixing money or orders directly in Stripe or the database. When you have to (a runbook says so), write what you did in the order's notes or the alert.

---

## How the site tells you something is wrong

- **Email to the ops inbox** (`OPS_ALERT_EMAIL`), once per problem, subject starting `[URGENT]` when it is.
- **`/admin/alerts`**: every open alert, plus whether each scheduled job is running. The admin header shows the open count on every page.
- **Your task list** (`/admin/customers`): each new return, warranty claim and privacy request opens a task due the next business day.

Mark an alert handled only after you've done what it asks.

---

## 1. "I was charged but I have no order" (or no confirmation)

1. Ask for the email they used, the amount and the date. Never ask for card details.
2. In Stripe, search by email or amount. Find the PaymentIntent and open its metadata: `order_number`.
3. Look the order up in `/admin/fulfillment` (or the customer view).
   - **Order exists, authorized:** the card is only held, not charged. Tell them it's a temporary hold that becomes a charge once we confirm stock, or drops off if we can't. Then confirm stock and charge it, or cancel, today.
   - **Order exists, paid:** the confirmation email failed. Check the customer view's email log, then resend from your mailbox with the order number. Reconciliation retries this automatically, up to 5 times.
   - **Order is on hold, "paid after the order was cancelled":** decide in the holds section. Either the stock is there (release the hold, and it becomes a normal paid order) or refund in full.
   - **No order at all:** don't refund from Stripe yet. Check `/admin/alerts` for a "no matching order" reconciliation alert. Raise it with whoever maintains the site, then refund in Stripe with the reason in the refund note.
4. Reply to the customer the same day with what happened and what you did.

## 2. The order is paid (or authorized) but the stock is gone

- **Authorized only** (the "Confirm stock & charge" queue): click "Can't fulfil", with a reason the buyer will read. The card hold is released and the buyer is told they weren't charged. Offer an alternative by phone.
- **Already paid:** offer the alternative first. If they decline, refund in full from the holds section, or, for a paid order not on hold, refund from Stripe with the order number in the note, then cancel the order.
- Card holds lapse after about 7 days. The site alerts at 3 days and releases the hold itself a day before it lapses, telling the buyer. Don't let it get there.

## 3. A return

1. The RMA arrives in `/admin/returns` and the inbox. The customer has an acknowledgement saying not to ship anything yet.
2. Read the reason and the answers. The "preliminary" outcome follows draft rules until operations confirms them (O-1); you decide the terms.
3. Then:
   - **Approve:** write the terms (bring to the counter or ship back, restocking fee if any). The customer is emailed instructions and the RMA number to write on the box.
   - **Ask the customer:** request photos or details by email. The status becomes "waiting".
   - **Decline:** give the reason. It goes to the customer, with the warranty link if relevant.
4. When it comes back, mark "Received & inspected" with the condition.
5. **Refund:** enter the amount. The suggestion is the line price, less the draft restocking fee where it applies.
   - Card orders refund through Stripe, tagged with the RMA number.
   - For net-terms orders, issue the credit memo in QuickBooks; the RMA records it.
6. Close it.

A caller without the website: "Open a return for a caller" at the bottom of `/admin/returns`, by order number. A guest who ordered without an account can start one at `/returns/start` with their order email.

**Freight damage:** the buyer must note damage on the delivery receipt before signing. If they did, file the carrier claim the same day with their photos. If they signed clean, recovery isn't guaranteed; decide case by case.

## 4. A warranty claim

1. The claim arrives in `/admin/returns` (warranty section) and the inbox. The customer was asked to reply with photos of the data label, the problem and any error code.
2. Check the model, serial, install date and installer license. The manufacturer usually requires a licensed install and registration.
3. Then:
   - **Ask the customer** for anything missing.
   - **Sent to manufacturer**: open the claim on the manufacturer's portal and record their claim number. The customer is told.
4. Close it with the resolution: part shipped, unit replaced, or denied with the manufacturer's reason. The customer gets the resolution by email.
5. Summit doesn't decide cover and doesn't promise it. Don't say "it's covered" until the manufacturer has.

## 5. The Stripe webhook is failing

Signs: an urgent "reconciliation" alert; orders stuck in "payment pending" with a succeeded payment in Stripe; Stripe's webhook page showing failed deliveries.

1. In Stripe → Developers → Webhooks, open the endpoint and read the latest failed attempt's response.
   - `400 Invalid signature`: the signing secret changed. Copy it again, with no trailing newline, into `supabase secrets set STRIPE_WEBHOOK_SECRET=...`, then redeploy `stripe-webhook`.
   - `500 Order update failed`: a database error. Check the function logs in Supabase.
   - `404`: the function isn't deployed. Redeploy it.
2. Once it's fixed, use "Resend" on the failed events in Stripe. Every handler is idempotent, so a resend never double-counts.
3. The 15-minute reconciliation job repairs what it safely can on its own: it records missed payments and authorizations and releases holds on dead orders. Check `/admin/alerts` for what it couldn't repair.

## 6. A scheduled job stopped

Signs: `/admin/alerts` shows a job as stale or never ran, or the uptime monitor on `/api/health/jobs` fires.

1. `select count(*) from private.app_config;` must be 1. If it's 0, fill it (BACKEND_SETUP §3). This is the usual cause.
2. Check the cron history:
   ```sql
   select j.jobname, d.status, d.return_message, d.start_time
   from cron.job_run_details d join cron.job j using (jobid)
   order by d.start_time desc limit 20;
   ```
3. `CRON_SECRET` in Vercel must equal `cron_secret` in `private.app_config`. If they differ, the route returns 401.
4. While payment safety is down, nothing expires abandoned checkouts and nothing reconciles payments. Check `/admin/fulfillment` by hand twice a day until it's fixed.

## 7. A privacy request

California requires a response within 45 days of receipt (the due date is on the request).

1. The request arrives in `/admin/privacy` and the inbox. The person must click the confirmation link we emailed. **Don't send or delete anything for an unconfirmed request.** If it's still unconfirmed near the deadline, close it as "Reject (unverified)" and explain how to resubmit.
2. **Right to know:**
   1. Open the request and download the full report (JSON).
   2. Check it, then send it to the person by replying to their confirmation email.
   3. Complete the request.
3. **Delete:**
   1. Erase marketing and enquiry data (type the email to confirm). Orders, invoices, returns, warranty claims and dealer applications are kept until counsel sets retention (C-7).
   2. If they have a portal account, disable it in Supabase Auth.
   3. Complete the request with the outcome text.
4. **Correct:** fix the record in the admin or Supabase, then complete the request saying what changed.
5. Opt-out requests go through `/privacy/opt-out` and need no staff action.

## 8. Suspected data breach

1. **Contain first:** rotate the exposed key (Supabase service role, Stripe, Resend, ShipStation, QuickBooks). Revoke staff sessions in Supabase Auth if a staff account is involved.
2. **Write down** what happened and when you learned of it: what data, whose, how many people, the time window. Keep the logs and don't delete anything.
3. **Call counsel the same day.** California and other states have notification duties with deadlines, and the duties depend on what was exposed (C-7 covers this). Don't notify customers or post anything until counsel has advised.
4. If card data could be involved, tell Stripe. The site never stores card numbers, so this would be unusual.

---

## Who decides what

| Decision | Who | Where it's set |
|---|---|---|
| Return window, restocking fee, terms (O-1) | Owner / operations | `src/lib/returns-policy.ts`, `src/content/legal/returns.tsx` |
| Credit limits, hold vs block (O-3) | Owner | `accounts.credit_limit`, `src/lib/payments/credit.ts` |
| Checkout acknowledgement wording (C-6) | Counsel | `src/lib/compliance/order-checks.ts` |
| R-410A rules (C-2) | Counsel | `src/lib/refrigerant-policy.ts` |
| Tax source (A-1) | Accountant | `src/lib/backend/pricing.ts` (`VERIFIED_TAX_RATES`) |
| Data retention, breach duties (C-7) | Counsel | `private.apply_retention`, this page §8 |
