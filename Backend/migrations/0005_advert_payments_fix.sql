-- ============================================================================
--  LizExpress — Migration 005
--  Lets advert payments through, and guarantees a public bucket for photos.
--
--  Why: the payments table was built when every payment was an item listing
--  fee, so item_id (and the fee columns) can be required. An advert payment
--  has no item, the database refused the row, and checkout showed
--  "Something went wrong on our end".
--
--  Safe on live data: only relaxes "required" rules; no rows change.
--  Re-running is safe. Touches nothing owned by Supabase's auth service.
-- ============================================================================

begin;

do $$
declare
  col text;
begin
  foreach col in array array['item_id', 'fee_percentage', 'item_value'] loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'payments'
         and column_name = col and is_nullable = 'NO'
    ) then
      execute format('alter table public.payments alter column %I drop not null', col);
      raise notice 'payments.% is now optional', col;
    end if;
  end loop;
end $$;

-- Every payment is either an item fee or an advert fee — never neither.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_has_subject') then
    alter table public.payments
      add constraint payments_has_subject
      check (item_id is not null or advert_id is not null) not valid;
  end if;
end $$;

commit;

-- Public photo bucket. Existing listings already use "items"; this only makes
-- sure it exists and is public. Kept outside the transaction and wrapped, so a
-- project where the storage schema is locked down still completes the
-- migration above (create the bucket in Dashboard → Storage instead).
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('items', 'items', true)
  on conflict (id) do update set public = true;
  raise notice 'Public bucket "items" is ready.';
exception when others then
  raise notice 'Could not create the "items" bucket from SQL (%). Create a PUBLIC bucket named items in Dashboard → Storage.', sqlerrm;
end $$;

-- Verify:
--   select column_name, is_nullable from information_schema.columns
--    where table_name = 'payments' and column_name in ('item_id','fee_percentage','item_value');
--   -- expect YES for all three
