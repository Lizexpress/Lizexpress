-- ============================================================================
--  LizExpress — Migration 001
--  Advertising channel, onboarding account types, Nigerian location reference,
--  and the auth lookup fix.
--
--  SAFE ON A LIVE DATABASE WITH EXISTING USERS.
--  Every statement is idempotent (IF NOT EXISTS / ON CONFLICT), nothing is
--  dropped, and no existing row is rewritten except to backfill new columns
--  with defaults that preserve current behaviour.
--
--  Run order:  0001 (this file)  →  0002_seed_admin.sql
-- ============================================================================

begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============================================================================
--  1. AUTH LOOKUP FIX
--
--  The API resolved accounts by calling auth.admin.listUsers({ perPage: 200 })
--  and scanning the first page in memory. Every user past row 200 was simply
--  invisible, so sign-up collision checks, "resend code", forgot-password and
--  email verification all behaved as though the account did not exist. That is
--  the root cause behind the reports of failed sign-in, dead reset links and
--  verification codes that never arrive.
--
--  This replaces the scan with an indexed single-row lookup. SECURITY DEFINER
--  because auth.users is not reachable through PostgREST; EXECUTE is granted to
--  service_role only, so it is callable from the API and from nowhere else.
-- ============================================================================

create or replace function public.find_auth_user_by_email(p_email text)
returns table (
  id                 uuid,
  email              text,
  email_confirmed_at timestamptz,
  banned_until       timestamptz,
  created_at         timestamptz
)
language plpgsql
stable
security definer
set search_path = auth, public
as $$
declare
  clean text := lower(btrim(p_email));
begin
  -- Supabase stores emails lowercased, so an exact match uses the index
  -- Supabase already keeps on auth.users.email and returns instantly.
  return query
    select u.id, u.email::text, u.email_confirmed_at, u.banned_until, u.created_at
      from auth.users u
     where u.email = clean
     limit 1;
  if found then return; end if;

  -- Fallback for any legacy row stored with capitals. Slower, but only runs
  -- when the fast path finds nothing.
  return query
    select u.id, u.email::text, u.email_confirmed_at, u.banned_until, u.created_at
      from auth.users u
     where lower(u.email) = clean
     limit 1;
end;
$$;

revoke all on function public.find_auth_user_by_email(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_by_email(text) to service_role;

-- No index is created on auth.users: that table is owned by Supabase's auth
-- service and the SQL editor may not alter it ("must be owner of table users").
-- The function above uses the email index Supabase already maintains.

-- Bulk export for the launch announcement and any future broadcast.
create or replace function public.list_user_emails(p_after timestamptz default null)
returns table (id uuid, email text, full_name text, created_at timestamptz)
language sql
security definer
set search_path = auth, public
as $$
  select u.id, u.email::text, p.full_name, u.created_at
    from auth.users u
    join public.users p on p.id = u.id
   where u.email is not null
     and u.email_confirmed_at is not null
     and coalesce(p.is_suspended, false) = false
     and (p_after is null or u.created_at > p_after)
   order by u.created_at asc;
$$;

revoke all on function public.list_user_emails(timestamptz) from public, anon, authenticated;
grant execute on function public.list_user_emails(timestamptz) to service_role;

-- ============================================================================
--  2. ONBOARDING — ACCOUNT TYPES
--
--  A user may swap, advertise, or do both. Stored as an array rather than a
--  single enum precisely because "both" is a first-class choice, and the
--  dashboard renders its sections from this value.
--
--  Existing users are backfilled to {swapper} with onboarding_completed = true
--  so that nobody who already has an account is thrown into an onboarding wall
--  on their next sign-in. They are offered advertising as an opt-in instead.
-- ============================================================================

alter table public.users
  add column if not exists account_types        text[]  not null default array['swapper']::text[],
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_step      smallint not null default 0,
  add column if not exists business_name        text,
  add column if not exists business_phone       text,
  add column if not exists business_about       text,
  add column if not exists business_lga         text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_account_types_valid'
  ) then
    alter table public.users
      add constraint users_account_types_valid check (
        array_length(account_types, 1) between 1 and 2
        and account_types <@ array['swapper', 'advertiser']::text[]
      );
  end if;
end $$;

-- Backfill: grandfather every pre-existing account straight past onboarding.
update public.users
   set onboarding_completed = true,
       onboarding_step      = 99
 where onboarding_completed = false
   and created_at < now();

create index if not exists users_account_types_idx on public.users using gin (account_types);

-- ============================================================================
--  3. NIGERIAN LOCATION REFERENCE
--
--  Adverts are searched by state / LGA / city, so the state and LGA values must
--  come from a controlled list — free text produces "Lagos", "lagos", "LAG" and
--  a search that matches none of them.
--
--  All 36 states + FCT are seeded below. LGAs are seeded by 0001b (see the
--  handover note) because that list is 774 rows and must be verified against
--  the INEC register rather than typed from memory.
-- ============================================================================

create table if not exists public.ng_states (
  code       text primary key,
  name       text not null unique,
  zone       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ng_lgas (
  id         bigserial primary key,
  state_code text not null references public.ng_states(code) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (state_code, name)
);

create index if not exists ng_lgas_state_idx     on public.ng_lgas (state_code);
create index if not exists ng_lgas_name_trgm_idx on public.ng_lgas using gin (name gin_trgm_ops);

insert into public.ng_states (code, name, zone) values
  ('AB','Abia','South East'),          ('AD','Adamawa','North East'),
  ('AK','Akwa Ibom','South South'),    ('AN','Anambra','South East'),
  ('BA','Bauchi','North East'),        ('BY','Bayelsa','South South'),
  ('BE','Benue','North Central'),      ('BO','Borno','North East'),
  ('CR','Cross River','South South'),  ('DE','Delta','South South'),
  ('EB','Ebonyi','South East'),        ('ED','Edo','South South'),
  ('EK','Ekiti','South West'),         ('EN','Enugu','South East'),
  ('FC','Federal Capital Territory','North Central'),
  ('GO','Gombe','North East'),         ('IM','Imo','South East'),
  ('JI','Jigawa','North West'),        ('KD','Kaduna','North West'),
  ('KN','Kano','North West'),          ('KT','Katsina','North West'),
  ('KE','Kebbi','North West'),         ('KO','Kogi','North Central'),
  ('KW','Kwara','North Central'),      ('LA','Lagos','South West'),
  ('NA','Nasarawa','North Central'),   ('NI','Niger','North Central'),
  ('OG','Ogun','South West'),          ('ON','Ondo','South West'),
  ('OS','Osun','South West'),          ('OY','Oyo','South West'),
  ('PL','Plateau','North Central'),    ('RI','Rivers','South South'),
  ('SO','Sokoto','North West'),        ('TA','Taraba','North East'),
  ('YO','Yobe','North East'),          ('ZA','Zamfara','North West')
on conflict (code) do nothing;

-- ============================================================================
--  4. ADVERTISEMENTS
--
--  Deliberately a separate table from `items`, not a flag on it. An advert is a
--  different object with different rules: it is never swapped, it carries no
--  swap_for, it is paid per photo rather than per listing, and it expires.
--  Overloading `items` would have put four nullable columns and a status enum
--  branch into every existing swap query.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'advert_status') then
    create type advert_status as enum (
      'draft',            -- being composed, photos may still be added
      'pending_payment',  -- submitted, awaiting Flutterwave confirmation
      'active',           -- paid and publicly visible
      'expired',          -- ran past expires_at
      'suspended',        -- pulled by an admin
      'archived'          -- retired by the advertiser
    );
  end if;
end $$;

create table if not exists public.adverts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,

  business_name     text not null,
  title             text not null,
  description       text not null,
  category          text not null,
  subcategory       text,

  -- Price is optional: many vendors advertise services without a fixed figure.
  price_from        numeric(12,2),
  price_to          numeric(12,2),
  price_note        text,

  contact_phone     text not null,
  contact_whatsapp  text,
  contact_email     text,
  website_url       text,

  country           text not null default 'Nigeria',
  state_code        text references public.ng_states(code),
  state             text not null,
  lga               text not null,
  city              text,
  address           text,

  status            advert_status not null default 'draft',
  photo_count       integer not null default 0,
  amount_due_kobo   bigint  not null default 0,
  amount_paid_kobo  bigint  not null default 0,

  published_at      timestamptz,
  expires_at        timestamptz,

  view_count        integer not null default 0,
  contact_count     integer not null default 0,

  suspended_reason  text,
  reviewed_by       uuid references public.users(id) on delete set null,

  -- Maintained by trigger; one tsvector beats four ILIKEs on a growing table.
  search_vector     tsvector,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint adverts_price_range_sane check (
    price_to is null or price_from is null or price_to >= price_from
  )
);

-- Each photo is a separately-billed line item, which is why they are rows and
-- not a text[] on the advert: ₦1,000 is charged per photo and each one needs
-- its own paid flag and its own audit trail.
create table if not exists public.advert_photos (
  id           uuid primary key default gen_random_uuid(),
  advert_id    uuid not null references public.adverts(id) on delete cascade,
  storage_path text not null,
  url          text not null,
  caption      text,
  position     smallint not null default 0,
  width        integer,
  height       integer,
  bytes        integer,
  is_paid      boolean not null default false,
  price_kobo   bigint  not null default 100000,   -- ₦1,000
  payment_id   uuid,
  created_at   timestamptz not null default now()
);

create index if not exists advert_photos_advert_idx on public.advert_photos (advert_id, position);

-- Location search is the whole point of the feature, so it gets real indexes.
create index if not exists adverts_user_idx       on public.adverts (user_id, created_at desc);
create index if not exists adverts_status_idx     on public.adverts (status, published_at desc);
create index if not exists adverts_state_idx      on public.adverts (state_code, status);
create index if not exists adverts_lga_idx        on public.adverts (lower(lga), status);
create index if not exists adverts_city_idx       on public.adverts (lower(city), status);
create index if not exists adverts_category_idx   on public.adverts (category, status);
create index if not exists adverts_expiry_idx     on public.adverts (expires_at) where status = 'active';
create index if not exists adverts_search_idx     on public.adverts using gin (search_vector);
create index if not exists adverts_lga_trgm_idx   on public.adverts using gin (lga gin_trgm_ops);
create index if not exists adverts_city_trgm_idx  on public.adverts using gin (city gin_trgm_ops);

create or replace function public.adverts_search_refresh()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
      setweight(to_tsvector('simple', coalesce(new.business_name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(new.title, '')),        'A')
    || setweight(to_tsvector('simple', coalesce(new.category, '')),     'B')
    || setweight(to_tsvector('simple', coalesce(new.lga, '')),          'B')
    || setweight(to_tsvector('simple', coalesce(new.city, '')),         'B')
    || setweight(to_tsvector('simple', coalesce(new.state, '')),        'B')
    || setweight(to_tsvector('simple', coalesce(new.description, '')),  'C');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists adverts_search_refresh_trg on public.adverts;
create trigger adverts_search_refresh_trg
  before insert or update on public.adverts
  for each row execute function public.adverts_search_refresh();

-- Keeps adverts.photo_count honest without the API having to remember to.
create or replace function public.adverts_sync_photo_count()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.advert_id, old.advert_id);
begin
  update public.adverts
     set photo_count = (select count(*) from public.advert_photos where advert_id = target),
         updated_at  = now()
   where id = target;
  return null;
end $$;

drop trigger if exists advert_photos_count_trg on public.advert_photos;
create trigger advert_photos_count_trg
  after insert or delete on public.advert_photos
  for each row execute function public.adverts_sync_photo_count();

create or replace function public.increment_advert_views(p_advert_id uuid)
returns void
language sql
as $$
  update public.adverts set view_count = view_count + 1 where id = p_advert_id;
$$;

create or replace function public.increment_advert_contacts(p_advert_id uuid)
returns void
language sql
as $$
  update public.adverts set contact_count = contact_count + 1 where id = p_advert_id;
$$;

grant execute on function public.increment_advert_views(uuid)    to anon, authenticated, service_role;
grant execute on function public.increment_advert_contacts(uuid) to anon, authenticated, service_role;

-- Sweeps lapsed adverts. Point pg_cron at this, or call it from the API.
create or replace function public.expire_lapsed_adverts()
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  update public.adverts
     set status = 'expired', updated_at = now()
   where status = 'active'
     and expires_at is not null
     and expires_at < now();
  get diagnostics affected = row_count;
  return affected;
end $$;

-- ============================================================================
--  5. PAYMENTS — ADVERT SUPPORT
--
--  Reuses the existing payments table rather than standing up a parallel one,
--  so Flutterwave reconciliation, the admin payments screen and the webhook all
--  keep working untouched. `purpose` tells the two product lines apart.
-- ============================================================================

alter table public.payments
  add column if not exists purpose     text not null default 'item_listing',
  add column if not exists advert_id   uuid references public.adverts(id) on delete set null,
  add column if not exists photo_count integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_purpose_valid') then
    alter table public.payments
      add constraint payments_purpose_valid
      check (purpose in ('item_listing', 'advert_photos', 'advert_renewal'));
  end if;
end $$;

create index if not exists payments_purpose_idx on public.payments (purpose, created_at desc);
create index if not exists payments_advert_idx  on public.payments (advert_id);

-- ============================================================================
--  6. PRICING — ADMIN EDITABLE
--
--  ₦1,000 per photo lives in platform_settings, not in code, so changing the
--  price is an admin action rather than a redeploy.
-- ============================================================================

insert into public.platform_settings (key, value)
values
  ('advert_photo_price_kobo', '100000'::jsonb),   -- ₦1,000.00
  ('advert_duration_days',    '30'::jsonb),
  ('advert_max_photos',       '12'::jsonb),
  ('advert_min_photos',       '1'::jsonb),
  ('advert_auto_approve',     'true'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
--  7. ROW LEVEL SECURITY
--
--  The API runs as service_role and bypasses all of this. These policies exist
--  for the browser client (realtime subscriptions and any direct reads), so a
--  leaked anon key cannot be used to enumerate drafts or unpaid adverts.
-- ============================================================================

alter table public.adverts        enable row level security;
alter table public.advert_photos  enable row level security;
alter table public.ng_states      enable row level security;
alter table public.ng_lgas        enable row level security;

drop policy if exists adverts_public_read on public.adverts;
create policy adverts_public_read on public.adverts
  for select using (status = 'active');

drop policy if exists adverts_owner_all on public.adverts;
create policy adverts_owner_all on public.adverts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists advert_photos_public_read on public.advert_photos;
create policy advert_photos_public_read on public.advert_photos
  for select using (
    exists (select 1 from public.adverts a where a.id = advert_id and a.status = 'active')
  );

drop policy if exists advert_photos_owner_all on public.advert_photos;
create policy advert_photos_owner_all on public.advert_photos
  for all using (
    exists (select 1 from public.adverts a where a.id = advert_id and a.user_id = auth.uid())
  );

drop policy if exists ng_states_read on public.ng_states;
create policy ng_states_read on public.ng_states for select using (true);

drop policy if exists ng_lgas_read on public.ng_lgas;
create policy ng_lgas_read on public.ng_lgas for select using (true);

commit;
