-- ============================================================================
--  LizExpress — Migration 002
--  Seeds the single super-admin account.
--
--  Admin self-registration is removed from the API (see the handover note).
--  Staff accounts exist only because this file put them there, or because an
--  existing super_admin invited them. There is no public path to an admin role.
--
--  Re-running this file is safe: it updates the password and role in place
--  rather than failing or creating a duplicate.
--
--  ⚠  Change the password after first sign-in. It is in version control.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

do $$
declare
  v_email    text := 'lizexpressorg@gmail.com';
  v_password text := 'LizExpress@2026';
  v_name     text := 'LizExpress Admin';
  v_user_id  uuid;
  v_hash     text := crypt('LizExpress@2026', gen_salt('bf'));
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email);

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      lower(v_email),
      v_hash,
      now(), null, null,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name, 'seeded', true),
      now(), now(), '', '', '', ''
    );

    -- GoTrue will not accept a password sign-in without a matching identity row.
    -- provider_id is required from GoTrue v2.60 onward; the exception branch
    -- keeps this working on older projects where that column does not exist.
    begin
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_user_id, v_user_id::text,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email), 'email_verified', true),
        'email', now(), now(), now()
      );
    exception when undefined_column then
      insert into auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email), 'email_verified', true),
        'email', now(), now(), now()
      );
    end;

    -- Newer Supabase Auth cannot read NULL in these token columns and fails
    -- the sign-in with "Database error querying schema". Blank them. Each is
    -- set separately so an older project missing one of them still works.
    begin update auth.users set phone_change = '' where id = v_user_id and phone_change is null;
    exception when undefined_column then null; end;
    begin update auth.users set phone_change_token = '' where id = v_user_id and phone_change_token is null;
    exception when undefined_column then null; end;
    begin update auth.users set email_change_token_current = '' where id = v_user_id and email_change_token_current is null;
    exception when undefined_column then null; end;
    begin update auth.users set reauthentication_token = '' where id = v_user_id and reauthentication_token is null;
    exception when undefined_column then null; end;

    raise notice 'Created admin auth user %', v_user_id;
  else
    -- Already present: reset the credential and make sure it is confirmed and
    -- not locked out, so a half-finished earlier attempt cannot leave it unusable.
    update auth.users
       set encrypted_password = v_hash,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           banned_until       = null,
           updated_at         = now(),
           raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                                || jsonb_build_object('full_name', v_name, 'seeded', true)
     where id = v_user_id;

    raise notice 'Updated existing admin auth user %', v_user_id;
  end if;

  -- Mirror profile. account_types / onboarding columns come from migration 001,
  -- so the admin is never shown the onboarding wizard.
  insert into public.users (
    id, full_name, role, is_verified, is_suspended,
    profile_completed, onboarding_completed, onboarding_step,
    account_types, country, created_at, updated_at
  ) values (
    v_user_id, v_name, 'super_admin', true, false,
    true, true, 99,
    array['swapper','advertiser']::text[], 'Nigeria', now(), now()
  )
  on conflict (id) do update
     set role                 = 'super_admin',
         full_name            = excluded.full_name,
         is_verified          = true,
         is_suspended         = false,
         profile_completed    = true,
         onboarding_completed = true,
         onboarding_step      = 99,
         updated_at           = now();
end $$;

-- Guard rail: the role column must never be writable by the account that owns
-- the row, or a user could promote themselves with a direct PostgREST call.
create or replace function public.guard_role_escalation()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.role is distinct from old.role and auth.uid() = new.id then
    raise exception 'A user cannot change their own role.';
  end if;
  return new;
end $$;

drop trigger if exists users_guard_role_trg on public.users;
create trigger users_guard_role_trg
  before update of role on public.users
  for each row execute function public.guard_role_escalation();

commit;

-- Verify:
--   select u.email, p.role, u.email_confirmed_at
--     from auth.users u join public.users p on p.id = u.id
--    where u.email = 'lizexpressorg@gmail.com';
