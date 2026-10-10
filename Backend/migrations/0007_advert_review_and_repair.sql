-- ============================================================================
--  LizExpress — Migration 007
--  Paid adverts: review before going live, and repair adverts that were paid
--  for but never switched on.
--
--  What it does
--    1. Adds the advert status "pending_review" (paid, waiting for an admin).
--    2. Turns review ON: advert_auto_approve = false. An admin can switch it
--       back in Admin → Settings to publish adverts the moment they are paid.
--    3. Repairs every advert that has a successful payment but was left
--       unpaid: marks its photos paid, records the amount paid, and moves it
--       to "pending_review" so it appears in Admin → Adverts → Needs approval.
--       Adverts that are already live, suspended or expired keep their status;
--       only the amount and photo flags are corrected.
--
--  Safe on live data: never deletes anything. Re-running is safe.
--  Run after 0001–0006.
--
--  Why two transactions: Postgres only lets a new status value be used after
--  the transaction that added it has committed.
-- ============================================================================

begin;
alter type public.advert_status add value if not exists 'pending_review' after 'pending_payment';
commit;

begin;

-- 2. Review before live.
insert into public.platform_settings (key, value)
values ('advert_auto_approve', 'false'::jsonb)
on conflict (key) do update set value = excluded.value;

-- When the advertiser paid, separate from when it went live.
alter table public.adverts add column if not exists paid_at timestamptz;

-- The app writes these on every payment; make sure older tables have them.
alter table public.payments
  add column if not exists paid_at    timestamptz,
  add column if not exists updated_at timestamptz;

-- 3. Repair. Each statement works out what was paid on its own (no temporary
--    tables: the Supabase SQL editor does not keep them between statements).

-- Amount paid can only go up, never down.
update public.adverts a
   set amount_paid_kobo = greatest(a.amount_paid_kobo, x.paid_kobo),
       paid_at          = coalesce(a.paid_at, x.last_paid_at),
       updated_at       = now()
  from (
    select p.advert_id,
           round(sum(p.amount) * 100)::bigint                  as paid_kobo,
           max(coalesce(p.paid_at, p.updated_at, p.created_at)) as last_paid_at
      from public.payments p
     where p.advert_id is not null
       and p.status = 'successful'
       and coalesce(p.purpose, 'advert_photos') in ('advert_photos', 'advert_renewal')
     group by p.advert_id
  ) x
 where x.advert_id = a.id
   and (a.amount_paid_kobo < x.paid_kobo or a.paid_at is null);

-- Photos that were covered by a payment.
update public.advert_photos ph
   set is_paid = true
 where ph.is_paid = false
   and exists (
     select 1 from public.payments p
      where p.advert_id = ph.advert_id
        and p.status = 'successful'
        and coalesce(p.purpose, 'advert_photos') in ('advert_photos', 'advert_renewal')
   );

-- Paid but never switched on (including any archived while stuck) → review queue.
update public.adverts a
   set status     = 'pending_review',
       updated_at = now()
 where a.status in ('draft', 'pending_payment', 'archived')
   and exists (
     select 1 from public.payments p
      where p.advert_id = a.id
        and p.status = 'successful'
        and coalesce(p.purpose, 'advert_photos') in ('advert_photos', 'advert_renewal')
   );

commit;

-- Check: paid adverts and where they stand now.
select a.title, a.status, a.amount_paid_kobo / 100 as paid_naira, a.expires_at
  from public.adverts a
 where a.amount_paid_kobo > 0
 order by a.updated_at desc
 limit 20;
