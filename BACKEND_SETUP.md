# Backend setup — provisioning checklist

All application code, migrations, Edge Functions, and email/cron jobs are
written and the Next app builds. These steps connect it to live cloud services
(the parts that need your accounts/keys). Run them in order.

## 0. Supabase project + env
1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Production also **requires** long random values for `CHECKOUT_TOKEN_SECRET`
     (checkout fails without it), `AUTH_COOKIE_SECRET` and `CRON_SECRET`, plus
     `NEXT_PUBLIC_SITE_URL`. `.env.example` lists every variable the code reads;
     set the same names in Vercel.
3. Apply migrations (in order) + seed:
   ```bash
   supabase link --project-ref <ref>
   supabase db push          # applies 001 → 002 → 003 → 004
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
4. `getOperationsMode()` now returns `"supabase"`; the admin dashboard reads live data.

## 1. Auth — first staff user
```bash
set -a; source .env.local; set +a
npm run seed:staff -- staff@summithvacsupply.com 'StrongPass!23' 'Avery Stocke'
```
Visit `/portal/login`, sign in, land on `/admin`. A non-staff session is
redirected, and (more importantly) blocked by RLS + the `assert_staff()` guard
even with a crafted request.

## 2. Stripe
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy send-receipt
```
- Set `STRIPE_SECRET_KEY` in `.env.local` too (used by the PaymentIntent route).
- In the Stripe dashboard, add a webhook to
  `https://<ref>.functions.supabase.co/stripe-webhook` for these events:
  `payment_intent.amount_capturable_updated` (card checkout only authorizes;
  this records the hold), `payment_intent.succeeded`, `payment_intent.canceled`,
  `payment_intent.payment_failed`, `refund.created` and `charge.dispute.created`.
  Redeploy the function after pulling (`supabase functions deploy stripe-webhook --no-verify-jwt`):
  the authorization branch is new and the deployed copy predates it.
- Test idempotency: `stripe trigger payment_intent.succeeded` twice with the same
  event → exactly one `payments` row (dedup on `stripe_event_id`).

## 3. Resend + scheduled jobs
```bash
supabase secrets set RESEND_API_KEY=re_... EMAIL_FROM="Summit HVAC Supply <orders@summithvacsupply.com>" OPS_ALERT_EMAIL=ops@summithvacsupply.com
supabase functions deploy low-stock-alert
supabase functions deploy ar-statements
```
Then enable **every** cron schedule by filling the private config once. All
four columns are needed: the first two drive the Edge Function jobs
(low-stock alert, AR statements, QuickBooks sync), the last two the site-route
jobs (lifecycle dispatch, payment safety).
```sql
insert into private.app_config (functions_base_url, service_role_key, site_base_url, cron_secret)
values ('https://<ref>.functions.supabase.co', '<service-role-key>',
        'https://www.summithvacsupply.com', '<same value as CRON_SECRET in Vercel>');
select cron.alter_job(jobid, active := true) from cron.job where jobname = 'lifecycle-dispatch-hourly';
```
Until this row exists every scheduled job **fails** in `cron.job_run_details`
(migration 042; before it they silently did nothing). Check after a run:
```sql
select j.jobname, d.status, d.return_message, d.start_time
from cron.job_run_details d join cron.job j using (jobid)
order by d.start_time desc limit 20;
```

## 4. QuickBooks inventory (live stock on the storefront)

Copies `QtyOnHand` from QuickBooks Online onto `catalog_products` every 15
minutes, so product pages show real counts without a redeploy.

**This never makes anything purchasable.** The catalog stays quote-only: the
sync writes `inventory_quantity` and `inventory_status` and nothing else, and
`quickbooks_apply_inventory()` is written so it *cannot* write anything else.

1. In the [Intuit Developer](https://developer.intuit.com) portal, create an app
   with the `com.intuit.quickbooks.accounting` scope and note its client id and
   secret. `QBO_REALM_ID` is the Company ID in QuickBooks settings.
2. Get an initial refresh token from the OAuth 2.0 Playground.
3. ```bash
   supabase secrets set QBO_CLIENT_ID=... QBO_CLIENT_SECRET=... QBO_REALM_ID=... QBO_ENVIRONMENT=production
   # Optional: lets a successful sync refresh the site immediately instead of
   # waiting out the 60s page cache.
   supabase secrets set SITE_REVALIDATE_URL=https://www.summithvacsupply.com/api/inventory/revalidate CRON_SECRET=...
   supabase functions deploy quickbooks-inventory-sync
   ```
4. Seed the refresh token once (migration `024` creates the table):
   ```sql
   insert into private.quickbooks_token (refresh_token) values ('<refresh-token>');
   ```
5. Verify before trusting the schedule:
   ```bash
   supabase functions invoke quickbooks-inventory-sync
   ```
   ```sql
   select * from quickbooks_sync_runs order by started_at desc limit 1;
   ```
   Check `matched`, `untracked`, `unmatched_qbo` and `ambiguous` look sane. Then
   confirm the guarantee held:
   ```sql
   select count(*) from catalog_products
   where inventory_status <> 'unknown' and purchase_eligible;  -- must be 0
   ```

**Matching.** QuickBooks items are matched to catalog rows by SKU, trying
`catalog_sku` then `source_sku`. Three cases to know about:

- An item with `TrackQtyOnHand = false` is left **unknown**, not zero. "We do
  not count this" is not "we have none of these."
- A catalog row QuickBooks never mentions keeps its last value. The sync never
  zeroes a product by omission.
- One QuickBooks SKU matching several catalog rows updates **none** of them and
  is reported in `ambiguous`. This happens where the importer split one sheet
  row into variants (`TCL36KMZODU` → `-R-410A` and `-R-454B`): one shelf count
  cannot be divided between two refrigerants. Fix it by creating separate
  QuickBooks items whose SKUs match the catalog SKUs.

**The refresh token rotates.** Intuit issues a new one on most exchanges and
kills the old one immediately, so the Edge Function persists each rotation
before doing any other work. Two consequences: never hand-edit
`private.quickbooks_token` while the schedule is running, and if the sync stays
broken for 100 days the token expires for good and step 2 must be repeated.
`rotated_at` in that table is the freshness signal.

## 5. Books (already live)
`003_ledger.sql` auto-posts a balanced journal entry on every invoice, payment,
and inventory receipt/shipment. Check the books with:
```sql
select * from trial_balance;
```

## 6. Customer view, auto-tasks and live updates (`/admin/customers`)

Migrations 036–038 are applied to the live project (`crm`). The site needs, in
Vercel:

- `SUPABASE_SERVICE_ROLE_KEY`: the customer view reads with it behind the
  staff login. Without it the page says it is not connected; it never shows
  invented data.
- A staff login (step 1) for anyone using the page.

Every new quote, contact, homeowner and dealer request opens a task due the next
business day at 5 pm Pacific; closing the request completes it. Live updates
use a private Realtime topic only staff can join; nothing to configure.

## 7. ShipStation (orders out, tracking back)

Uses ShipStation's **Custom Store** integration: ShipStation polls us for
orders and posts tracking back. Nothing is pushed from our side.

1. Pick a long random username and password and set them in Vercel:
   `SHIPSTATION_STORE_USERNAME`, `SHIPSTATION_STORE_PASSWORD`.
2. In ShipStation: Settings → Selling Channels → Store Setup → Connect a Store
   → **Custom Store**.
   - URL: `https://www.summithvacsupply.com/api/shipstation`
   - Username / password: the values from step 1.
   - Status mapping: Awaiting payment → *(none)*; Awaiting shipment → `paid`;
     Shipped → `shipped`; Cancelled → `cancelled`.
3. Click **Test connection**, then **Refresh store**.

What gets exported: card orders once Stripe has marked them paid, and confirmed
net-terms orders. When a label is bought (or a will-call order is marked
shipped), ShipStation notifies us: the order is marked shipped, reserved stock
is released, and buyers of delivered orders get one "shipped" email with the
tracking link. Repeat notifications for the same tracking number are ignored.

## 8. Resend inbound support email and delivery tracking

1. In Resend: Domains → add a receiving domain (or use the provided
   `<id>.resend.app` address) and point `support@` at it.
2. Webhooks → Add webhook → URL
   `https://www.summithvacsupply.com/api/resend/webhook`, events:
   `email.received`, `email.delivered`, `email.delivery_delayed`,
   `email.bounced`, `email.complained`, `email.opened`, `email.clicked`,
   `email.failed`, `email.suppressed`.
3. Copy the webhook's signing secret into Vercel as `RESEND_WEBHOOK_SECRET`
   (`RESEND_API_KEY` must also be set).
4. Redeploy the `send-receipt` and `ar-statements` Edge Functions so their
   sends are logged too: `supabase functions deploy send-receipt ar-statements`.

Inbound mail becomes a support request in the customer view (and a task).
Auto-replies, bounces, no-reply senders and our own domain are ignored, so two
auto-responders cannot loop through the inbox. Delivery events mark each
logged email delivered, opened, bounced, and so on.

## 9. AI assistants (optional, per person)

Official MCP servers let Claude answer questions across these systems. Add them
in your own Claude client; they authorize with your account, nothing is stored
in this repository:

```bash
claude mcp add --transport http stripe https://mcp.stripe.com
claude mcp add --transport http resend https://mcp.resend.com/mcp
```

ShipStation's API MCP and Intuit's QuickBooks MCP run locally with an API key;
follow their docs and keep QuickBooks read-only (it is an early preview).

## 10. Liability safeguards: what has to be switched on

Built per `docs/LIABILITY-REMEDIATION-PLAN.md` (migrations 039–046). Most of it
works as soon as it is deployed; these need a person:

1. **Alerts inbox.** Set `OPS_ALERT_EMAIL` in Vercel (and as a Supabase secret,
   §3). Without it alerts are still stored and shown at `/admin/alerts`, but
   nobody is emailed.
2. **Scheduled jobs.** Fill `private.app_config` (§3) and set `CRON_SECRET` in
   Vercel to the same value. `payment-safety-15min` (migration 041) then runs
   expiry, Stripe reconciliation, authorization deadlines, confirmation-email
   retries, held-order alerts and privacy-deadline alerts every 15 minutes.
3. **Outside monitor.** Point an uptime service at
   `GET https://www.summithvacsupply.com/api/health/jobs` with header
   `Authorization: Bearer <CRON_SECRET>`, alerting on any non-200. It returns 503
   when a job hasn't run in its window. It must run outside Supabase: if pg_cron
   or `app_config` is what broke, nothing scheduled there would notice.
4. **Stripe events** as listed in §2, then redeploy `stripe-webhook`.
5. **Credit limits.** Net-terms orders over `accounts.credit_limit` (open
   invoices + uninvoiced orders + the new order) are held for approval. A
   limit of 0 or none holds every net-terms order, so set limits per account
   (owner decision O-3; `CREDIT_POLICY` in `src/lib/payments/credit.ts`).
6. **Chat spend.** `CHAT_DAILY_CAP` (default 1000 messages a day across all
   visitors) caps API spend; the per-visitor limit is 20 a minute, shared
   across instances (migration 046). Run `npm run eval:chat` before changing
   the chat model or prompt (it calls the API; a few cents).
7. **Retention.** `private.apply_retention()` is written but not scheduled,
   and dry-runs by default. Schedule it once counsel approves the periods (C-7):
   ```sql
   select private.apply_retention();          -- counts only
   select private.apply_retention(false);     -- deletes
   ```

Where staff act: `/admin/fulfillment` (confirm stock and charge, holds,
pickup ID check), `/admin/returns` (returns and warranty claims),
`/admin/privacy` (know/delete requests), `/admin/alerts`. Procedures for each
are in `docs/RUNBOOKS.md`.

## Security invariants (built in, keep them)
- **RLS + `assert_staff()`** gate every operational write in the database.
- **Stripe webhook** verifies the signature and is idempotent on the event id.
- **Resend webhook** verifies the signature; **ShipStation** requires its store
  credentials. Both refuse everything when their secrets are unset.
- **Secrets are server-only**: service-role, Stripe secret, and Resend keys never
  ship to the browser.
