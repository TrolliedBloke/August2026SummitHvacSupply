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

## 4. Catalog and inventory (CSV import)

The catalog CSV is the single source for product identity, price and on-hand
counts. There is no live inventory integration: the QuickBooks sync was retired
in migration `026`.

```bash
# 1. Put the approved export at data/catalog/inventory-source.csv
npm run catalog:import     # -> src/data/catalog.generated.json + reports
npm test && npm run build  # the generated catalog is baked into the build
# 2. With production service-role credentials, from an approved environment:
npm run catalog:sync       # upserts catalog_products, costs, evidence, media
```

`catalog:import` reads these columns (header row, exact names):

| Column | Required | Notes |
|---|---|---|
| `SKU` | yes | The key. Duplicates become separate variants pending review. |
| `Product Name` | yes | Absent means the row is held back as `needs_review`. |
| `Sell Price` | for purchase | No price, or `$0`, keeps the product quote-only. |
| `Current Stock` | for purchase | Blank means *unknown*, which is never published as zero. |
| `Unit Cost` | no | Isolated into `costs.generated.json`, never reaches the browser. |
| `Brand`, `Category`, `Product Type` | no | Drive categorisation and the SEO gate. |
| `BTU`, `Voltage`, `Refrigerant`, `Zones` | no | Shown as specifications where present. |
| `Min Stock`, `Bundle/Kit Name`, `Compatible Outdoor SKU` | no | |
| `OEM Barcode/UPC`, `Location`, `Notes` | no | |

A product becomes directly purchasable only with a confirmed price, a known
quantity **and** a non-conflicted identity. That rule lives in the importer and
is backed by a check constraint on `catalog_products`.

**Keep the source files safe.** `inventory-source.csv` and
`costs.generated.json` are gitignored — deliberately, since the cost file
carries what Summit pays per unit — so they exist only on the machine that runs
the import. Back them up somewhere that is not one laptop.

The storefront reads counts from `catalog_products` at request time
(`src/lib/storefront/live-inventory.ts`), so a corrected count can be written to
the database and appear without a rebuild. That is also the seam a future ERP
writes into.

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
