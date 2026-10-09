-- ============================================================================
--  TEST ONLY — does the database accept an advert payment?
--
--  Paste into Supabase → SQL Editor → Run. It tries to save an advert payment
--  exactly the way checkout does, then ALWAYS cancels, so nothing is saved.
--
--  The red error box at the bottom tells you the result:
--    "TEST PASSED ..."   → the database is fine; the problem is elsewhere
--                          (send me the Vercel log line, see the guide).
--    anything else       → that message is the exact reason checkout fails.
--                          Send it to me.
-- ============================================================================

do $$
declare
  v_advert record;
begin
  select id, user_id into v_advert
    from public.adverts
   order by created_at desc
   limit 1;

  if v_advert.id is null then
    raise exception 'TEST SKIPPED: there are no adverts yet. Create one first.';
  end if;

  insert into public.payments
    (user_id, advert_id, tx_ref, amount, currency, status, purpose, photo_count, fee_percentage, item_value)
  values
    (v_advert.user_id, v_advert.id, 'LXAD-TEST-' || floor(random() * 1e9)::text,
     1000, 'NGN', 'pending', 'advert_photos', 1, 0, 1000);

  -- Reaching here means the row was accepted. Cancel it.
  raise exception 'TEST PASSED: the database accepts advert payments (nothing was saved).';
end $$;
