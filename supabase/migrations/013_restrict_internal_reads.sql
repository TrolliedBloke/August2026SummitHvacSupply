-- Migration 001 granted anonymous SELECT on eight tables via `using (true)`.
-- Six of those are genuinely public catalog data. Two are not:
--
--   inventory_lots -- on-hand and reserved quantities per SKU. Published to
--                     anon, this hands competitors Summit's stock position and
--                     lets anyone infer purchasing volume. Same class of
--                     disclosure as the unit-cost leak fixed in 15c37e5.
--   bins           -- internal warehouse bin codes and layout.
--
-- Storefront availability does not depend on these: the public catalog is
-- served from src/data/catalog.generated.json, and every operational read runs
-- through the service role. Restricting them breaks no customer-facing path.

drop policy if exists "public inventory read" on inventory_lots;
drop policy if exists "public bin read" on bins;

create policy "staff inventory read" on inventory_lots
  for select using (current_profile_role() = 'staff');

create policy "staff bin read" on bins
  for select using (current_profile_role() = 'staff');
