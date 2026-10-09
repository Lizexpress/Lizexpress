-- ============================================================================
--  CHECK ONLY — read-only. Changes nothing.
--
--  The backend joins some tables to user profiles through named links. If a
--  link points at Supabase's internal login table instead of public.users,
--  that screen fails with PGRST200 (the error you saw on checkout).
--
--  Paste into Supabase → SQL Editor → Run, and send me any row that is not OK.
-- ============================================================================

with expected(link, used_for) as (values
  ('admin_actions_actor_id_fkey',    'Admin audit log'),
  ('admin_tasks_assignee_id_fkey',   'Admin tasks'),
  ('chats_receiver_id_fkey',         'Chats list'),
  ('chats_sender_id_fkey',           'Chats list'),
  ('feedback_user_id_fkey',          'Feedback and testimonials'),
  ('items_user_id_fkey',             'Item owner'),
  ('messages_sender_id_fkey',        'Chat messages'),
  ('verifications_reviewed_by_fkey', 'KYC review'),
  ('verifications_user_id_fkey',     'KYC review'),
  ('adverts_user_id_fkey',           'Advert owner'),
  ('comments_user_id_fkey',          'Comments')
)
select e.used_for,
       e.link,
       case
         when c.oid is null                         then 'MISSING'
         when c.confrelid = 'public.users'::regclass then 'OK'
         else 'POINTS TO ' || c.confrelid::regclass::text
       end as status
  from expected e
  left join pg_constraint c on c.conname = e.link and c.contype = 'f'
 order by (case when c.confrelid = 'public.users'::regclass then 1 else 0 end), e.used_for;
