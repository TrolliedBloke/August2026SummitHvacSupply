# Backend setup — provisioning checklist

All application code, migrations, Edge Functions, and email/cron jobs are
written and the Next app builds. These steps connect it to live cloud services
(the parts that need your accounts/keys). Run them in order.

## 0. Supabase project + env
1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
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
  `https://<ref>.functions.supabase.co/stripe-webhook` for `payment_intent.succeeded`.
- Test idempotency: `stripe trigger payment_intent.succeeded` twice with the same
  event → exactly one `payments` row (dedup on `stripe_event_id`).

## 3. Resend + scheduled jobs
```bash
supabase secrets set RESEND_API_KEY=re_... EMAIL_FROM="Summit HVAC Supply <orders@summithvacsupply.com>" OPS_ALERT_EMAIL=ops@summithvacsupply.com
supabase functions deploy low-stock-alert
supabase functions deploy ar-statements
```
Then enable the cron schedules by filling the private config once:
```sql
insert into private.app_config (functions_base_url, service_role_key)
values ('https://<ref>.functions.supabase.co', '<service-role-key>');
```
(`004_cron.sql` already created the `low-stock-alert-daily` and
`ar-statements-monthly` schedules.)

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
4. Seed the refresh token once (migration `022` creates the table):
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

## Security invariants (built in, keep them)
- **RLS + `assert_staff()`** gate every operational write in the database.
- **Stripe webhook** verifies the signature and is idempotent on the event id.
- **Secrets are server-only**: service-role, Stripe secret, and Resend keys never
  ship to the browser.
