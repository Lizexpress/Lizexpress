-- ============================================================================
--  LizExpress — Migration 006
--  Makes the old payments table accept advert payments, whatever rules it
--  was originally created with.
--
--  0005 relaxed the three item columns we knew about. The original table may
--  have more: other required columns with no default, or CHECK rules that
--  insist every payment has an item. Any one of them makes advert checkout
--  fail with "Something went wrong on our end". This finds and relaxes them
--  all, and prints a NOTICE for every change so you can see what it did.
--
--  Safe on live data: only relaxes rules, never deletes or changes rows.
--  Re-running is safe. Run after 0001–0005.
-- ============================================================================

begin;

-- Make sure the advert columns exist even if 0001 was skipped on this table.
alter table public.payments
  add column if not exists purpose     text not null default 'item_listing',
  add column if not exists advert_id   uuid,
  add column if not exists photo_count integer;

do $$
declare
  rec record;
  -- What every payment, item or advert, always provides.
  core text[] := array['id', 'user_id', 'tx_ref', 'amount', 'currency', 'status', 'purpose', 'created_at', 'updated_at'];
begin
  -- 1. Required columns with no default that an advert payment cannot fill.
  for rec in
    select column_name
      from information_schema.columns
     where table_schema = 'public' and table_name = 'payments'
       and is_nullable = 'NO' and column_default is null
       and column_name <> all (core)
  loop
    execute format('alter table public.payments alter column %I drop not null', rec.column_name);
    raise notice 'Relaxed: payments.% is now optional', rec.column_name;
  end loop;

  -- 2. Old CHECK rules that require an item (or item-only fields).
  for rec in
    select con.conname, pg_get_constraintdef(con.oid) as def
      from pg_constraint con
     where con.conrelid = 'public.payments'::regclass
       and con.contype = 'c'
       and con.conname not in ('payments_purpose_valid', 'payments_has_subject')
       and pg_get_constraintdef(con.oid) ~* '(item_id|fee_percentage|item_value|listing)'
  loop
    execute format('alter table public.payments drop constraint %I', rec.conname);
    raise notice 'Removed old rule %: %', rec.conname, rec.def;
  end loop;

  -- 3. Purpose rule: make sure advert purposes are allowed.
  if exists (select 1 from pg_constraint where conname = 'payments_purpose_valid'
              and conrelid = 'public.payments'::regclass) then
    alter table public.payments drop constraint payments_purpose_valid;
  end if;
  alter table public.payments
    add constraint payments_purpose_valid
    check (purpose in ('item_listing', 'advert_photos', 'advert_renewal'));

  -- 4. Every payment still belongs to an item or an advert.
  if not exists (select 1 from pg_constraint where conname = 'payments_has_subject') then
    alter table public.payments
      add constraint payments_has_subject check (item_id is not null or advert_id is not null) not valid;
  end if;

  -- 5. Advert link, so admin payment screens can join to the advert.
  if not exists (select 1 from pg_constraint where conname = 'payments_advert_id_fkey') then
    alter table public.payments
      add constraint payments_advert_id_fkey foreign key (advert_id)
      references public.adverts(id) on delete set null not valid;
  end if;

  -- 6. Report (not change) triggers on the table, in case one assumes an item.
  for rec in
    select tgname from pg_trigger
     where tgrelid = 'public.payments'::regclass and not tgisinternal
  loop
    raise notice 'Note: payments has trigger % (left unchanged)', rec.tgname;
  end loop;
end $$;

commit;
