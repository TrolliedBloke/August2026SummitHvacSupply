-- Order lines could not reference a production catalog product.
--
-- `order_lines.sku_id` is `uuid references skus(id)` -- the demo/legacy catalog.
-- The production storefront resolves products from `catalog_products`, whose
-- primary key is TEXT (`inventory-row-2`, ...). Checkout inserted that text id
-- into the uuid column, so every real catalog checkout died with Postgres
-- 22P02 (invalid input syntax for type uuid) while inserting order lines, and
-- the already-inserted sales_orders row then had to be deleted as compensation.
--
-- Identity decision: `catalog_products.id` (text) stays the canonical product
-- identifier. Converting it to uuid would have to rewrite the primary key of
-- catalog_product_evidence, _costs, _media, _documents and _relationships --
-- the tables holding the manufacturer research and its provenance. That is a
-- large, lossy migration to fix a column type, so instead order_lines learns to
-- reference the catalog directly.
--
-- Legacy rows keep `sku_id`. New catalog rows use `catalog_product_id`.
-- Exactly one of the two is set, enforced by a check constraint rather than by
-- convention.

alter table order_lines
  add column if not exists catalog_product_id text references catalog_products(id);

-- 006 already dropped NOT NULL on sku_id; assert it so this migration is
-- correct when replayed against a database that skipped 006.
alter table order_lines alter column sku_id drop not null;

alter table order_lines
  drop constraint if exists order_lines_product_identity;
alter table order_lines
  add constraint order_lines_product_identity check (
    (sku_id is not null and catalog_product_id is null)
    or (sku_id is null and catalog_product_id is not null)
  );

create index if not exists order_lines_catalog_product_id_idx
  on order_lines (catalog_product_id);

-- Reservation must fail closed for catalog products.
--
-- The original function reserved FIFO from inventory_lots keyed by sku_id. A
-- line carrying catalog_product_id matches no lot, so the loop found nothing,
-- left v_fully true when the line was the only one, and the order was marked
-- 'reserved' having reserved nothing. Production inventory for catalog products
-- is not modelled yet, so the honest behaviour is to refuse the reservation
-- instead of inventing one.
create or replace function reserve_public_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  l record;
  lot record;
  v_need int;
  v_alloc int;
  v_fully boolean := true;
begin
  for l in select * from order_lines where order_id = p_order_id loop
    if l.catalog_product_id is not null then
      raise exception 'Cannot reserve catalog product % : production inventory is not tracked for catalog_products yet', l.catalog_product_id
        using errcode = 'check_violation';
    end if;

    v_need := l.quantity - l.reserved_quantity;
    for lot in
      select * from inventory_lots
      where sku_id = l.sku_id and (on_hand - reserved) > 0
      order by created_at asc
    loop
      exit when v_need <= 0;
      v_alloc := least(v_need, lot.on_hand - lot.reserved);
      update inventory_lots set reserved = reserved + v_alloc where id = lot.id;
      insert into inventory_reservations (order_line_id, lot_id, quantity, status)
      values (l.id, lot.id, v_alloc, 'active');
      insert into inventory_movements (sku_id, lot_id, movement_type, quantity, reference_type, reference_id, note)
      values (l.sku_id, lot.id, 'reservation', v_alloc, 'sales_order', p_order_id, 'Reserved at checkout');
      update order_lines set reserved_quantity = reserved_quantity + v_alloc where id = l.id;
      v_need := v_need - v_alloc;
    end loop;
    if v_need > 0 then v_fully := false; end if;
  end loop;

  update sales_orders set status = case when v_fully then 'reserved' else 'pending' end
  where id = p_order_id;
end;
$$;
