-- ============================================================================
--  LizExpress — Migration 004
--  Engagement: likes, saves, comments, shares, views and contacts on both
--  business adverts and swap items, plus the activity log that powers the
--  admin Engagement page.
--
--  Run after 0001–0003. Safe on a live database: only adds tables, columns,
--  functions and triggers; existing rows are untouched apart from new counter
--  columns starting at 0. Re-running is safe.
--
--  Touches only LizExpress's own tables in the public schema — nothing in
--  Supabase's auth schema.
-- ============================================================================

begin;

-- ============================================================================
--  1. ACTIVITY LOG
--
--  One row per engagement. The counters on adverts/items answer "how many in
--  total"; this log answers the questions an admin actually asks: how many
--  DIFFERENT people engaged, which day, which vendor, and what kind.
--
--  owner_id is denormalised (the advertiser or lister at the time) so "how
--  much engagement did this vendor get" is one indexed filter, not a join.
-- ============================================================================

create table if not exists public.engagement_events (
  id          bigserial primary key,
  entity_type text not null,
  entity_id   uuid not null,
  kind        text not null,
  actor_id    uuid references public.users(id) on delete set null,  -- null = signed-out visitor
  owner_id    uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint engagement_events_type_valid check (entity_type in ('advert', 'item')),
  constraint engagement_events_kind_valid check (kind in ('view', 'like', 'save', 'comment', 'share', 'contact', 'chat'))
);

create index if not exists engagement_events_entity_idx on public.engagement_events (entity_type, entity_id, created_at desc);
create index if not exists engagement_events_owner_idx  on public.engagement_events (owner_id, created_at desc);
create index if not exists engagement_events_time_idx   on public.engagement_events (created_at desc, kind);
create index if not exists engagement_events_actor_idx  on public.engagement_events (actor_id, created_at desc) where actor_id is not null;

-- ============================================================================
--  2. COUNTERS
-- ============================================================================

alter table public.adverts
  add column if not exists like_count    integer not null default 0,
  add column if not exists save_count    integer not null default 0,
  add column if not exists comment_count integer not null default 0,
  add column if not exists share_count   integer not null default 0;

-- Items already have view_count and favorite_count (saves).
alter table public.items
  add column if not exists like_count    integer not null default 0,
  add column if not exists comment_count integer not null default 0,
  add column if not exists share_count   integer not null default 0,
  add column if not exists chat_count    integer not null default 0;

-- ============================================================================
--  3. REACTIONS (likes for both; saves for adverts)
--
--  Item saves stay in the existing `favorites` table so every saved item your
--  users already have keeps working; they are logged below by trigger.
-- ============================================================================

create table if not exists public.reactions (
  user_id     uuid not null references public.users(id) on delete cascade,
  entity_type text not null,
  entity_id   uuid not null,
  kind        text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id, kind),
  constraint reactions_type_valid check (entity_type in ('advert', 'item')),
  constraint reactions_kind_valid check (kind in ('like', 'save')),
  constraint reactions_item_save  check (not (entity_type = 'item' and kind = 'save'))
);

create index if not exists reactions_entity_idx on public.reactions (entity_type, entity_id, kind);

-- ============================================================================
--  4. COMMENTS (one level of replies, so a vendor can answer a question)
-- ============================================================================

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id   uuid not null,
  user_id     uuid not null references public.users(id) on delete cascade,
  parent_id   uuid references public.comments(id) on delete cascade,
  body        text not null,
  is_hidden   boolean not null default false,
  hidden_by   uuid references public.users(id) on delete set null,
  hidden_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint comments_type_valid check (entity_type in ('advert', 'item')),
  constraint comments_body_length check (char_length(btrim(body)) between 1 and 1000)
);

create index if not exists comments_entity_idx on public.comments (entity_type, entity_id, created_at);
create index if not exists comments_parent_idx on public.comments (parent_id);
create index if not exists comments_recent_idx on public.comments (created_at desc);

-- ============================================================================
--  5. HELPERS
-- ============================================================================

-- Who owns the advert or item being engaged with.
create or replace function public.engagement_owner(p_type text, p_id uuid)
returns uuid
language sql
stable
as $$
  select case p_type
    when 'advert' then (select user_id from public.adverts where id = p_id)
    when 'item'   then (select user_id from public.items   where id = p_id)
  end;
$$;

-- Adds `delta` to one counter column. Column names are whitelisted, so the
-- dynamic SQL cannot be steered by input.
create or replace function public.bump_engagement_counter(p_type text, p_id uuid, p_kind text, p_delta integer)
returns void
language plpgsql
as $$
declare
  col text;
  tbl text := case p_type when 'advert' then 'adverts' when 'item' then 'items' end;
begin
  col := case
    when p_kind = 'view'                         then 'view_count'
    when p_kind = 'like'                         then 'like_count'
    when p_kind = 'save'    and p_type = 'advert' then 'save_count'
    when p_kind = 'save'    and p_type = 'item'   then null   -- favorites keeps its own count
    when p_kind = 'comment'                      then 'comment_count'
    when p_kind = 'share'                        then 'share_count'
    when p_kind = 'contact' and p_type = 'advert' then 'contact_count'
    when p_kind = 'chat'    and p_type = 'item'   then 'chat_count'
  end;
  if tbl is null or col is null then return; end if;
  execute format('update public.%I set %I = greatest(%I + $1, 0) where id = $2', tbl, col, col)
    using p_delta, p_id;
end;
$$;

/**
 * Writes one log row — unless the person acting owns the advert or item.
 * A vendor liking their own post or replying to a question is not client
 * engagement, so it never reaches the analytics (public counters still
 * include it, e.g. a reply still shows in the comment count).
 */
create or replace function public.log_engagement(p_type text, p_id uuid, p_kind text, p_actor uuid)
returns void
language plpgsql
as $$
declare
  v_owner uuid := public.engagement_owner(p_type, p_id);
begin
  if p_actor is not null and p_actor = v_owner then return; end if;
  insert into public.engagement_events (entity_type, entity_id, kind, actor_id, owner_id)
  values (p_type, p_id, p_kind, p_actor, v_owner);
end;
$$;

/**
 * The single entry point the API uses for views, shares and contacts:
 * bumps the counter and writes the log row in one call.
 */
create or replace function public.record_engagement(p_type text, p_id uuid, p_kind text, p_actor uuid default null)
returns void
language plpgsql
as $$
begin
  perform public.bump_engagement_counter(p_type, p_id, p_kind, 1);
  perform public.log_engagement(p_type, p_id, p_kind, p_actor);
end;
$$;

-- ============================================================================
--  6. TRIGGERS — counters and the log can never drift from the source rows
-- ============================================================================

create or replace function public.reactions_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.bump_engagement_counter(new.entity_type, new.entity_id, new.kind, 1);
    perform public.log_engagement(new.entity_type, new.entity_id, new.kind, new.user_id);
  elsif tg_op = 'DELETE' then
    -- Un-liking lowers the counter; the log keeps the original event, because
    -- "someone engaged on Tuesday" stays true.
    perform public.bump_engagement_counter(old.entity_type, old.entity_id, old.kind, -1);
  end if;
  return null;
end;
$$;

drop trigger if exists reactions_after_change_trg on public.reactions;
create trigger reactions_after_change_trg
  after insert or delete on public.reactions
  for each row execute function public.reactions_after_change();

create or replace function public.comments_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.bump_engagement_counter(new.entity_type, new.entity_id, 'comment', 1);
    perform public.log_engagement(new.entity_type, new.entity_id, 'comment', new.user_id);
  elsif tg_op = 'DELETE' and not old.is_hidden then
    perform public.bump_engagement_counter(old.entity_type, old.entity_id, 'comment', -1);
  elsif tg_op = 'UPDATE' and new.is_hidden is distinct from old.is_hidden then
    -- Hidden comments stop counting publicly; restoring brings them back.
    perform public.bump_engagement_counter(new.entity_type, new.entity_id, 'comment', case when new.is_hidden then -1 else 1 end);
  end if;
  return null;
end;
$$;

drop trigger if exists comments_after_change_trg on public.comments;
create trigger comments_after_change_trg
  after insert or update of is_hidden or delete on public.comments
  for each row execute function public.comments_after_change();

-- Existing item saves (favorites) are logged as 'save' events from now on.
create or replace function public.favorites_after_insert()
returns trigger
language plpgsql
as $$
begin
  perform public.log_engagement('item', new.item_id, 'save', new.user_id);
  return null;
end;
$$;

drop trigger if exists favorites_engagement_trg on public.favorites;
create trigger favorites_engagement_trg
  after insert on public.favorites
  for each row execute function public.favorites_after_insert();

-- A new conversation about an item is that item's equivalent of a phone call.
create or replace function public.chats_after_insert()
returns trigger
language plpgsql
as $$
begin
  if new.item_id is not null then
    perform public.bump_engagement_counter('item', new.item_id, 'chat', 1);
    perform public.log_engagement('item', new.item_id, 'chat', new.sender_id);
  end if;
  return null;
end;
$$;

drop trigger if exists chats_engagement_trg on public.chats;
create trigger chats_engagement_trg
  after insert on public.chats
  for each row execute function public.chats_after_insert();

-- Backfill chat_count from conversations that already exist.
update public.items i
   set chat_count = c.n
  from (select item_id, count(*)::int n from public.chats where item_id is not null group by item_id) c
 where c.item_id = i.id and i.chat_count = 0;

-- ============================================================================
--  7. ADMIN ANALYTICS
--
--  Aggregation runs in the database, so the admin page stays fast as the log
--  grows. Execute is limited to the API's service role.
-- ============================================================================

create or replace function public.engagement_summary(p_since timestamptz, p_owner uuid default null)
returns table (kind text, total bigint, people bigint)
language sql
stable
as $$
  select e.kind, count(*)::bigint, count(distinct e.actor_id)::bigint
    from public.engagement_events e
   where e.created_at >= p_since
     and (p_owner is null or e.owner_id = p_owner)
   group by e.kind;
$$;

-- People who did anything beyond viewing: the "engaged clients" number.
create or replace function public.engagement_people(p_since timestamptz, p_owner uuid default null)
returns bigint
language sql
stable
as $$
  select count(distinct e.actor_id)::bigint
    from public.engagement_events e
   where e.created_at >= p_since
     and e.kind <> 'view'
     and e.actor_id is not null
     and (p_owner is null or e.owner_id = p_owner);
$$;

create or replace function public.engagement_daily(p_days integer, p_owner uuid default null)
returns table (day date, kind text, total bigint)
language sql
stable
as $$
  select (e.created_at at time zone 'Africa/Lagos')::date, e.kind, count(*)::bigint
    from public.engagement_events e
   where e.created_at >= (now() - make_interval(days => p_days))
     and (p_owner is null or e.owner_id = p_owner)
   group by 1, 2
   order by 1;
$$;

/**
 * Leaderboard for one entity type over a window. The score weights actions by
 * intent: a call or chat is worth more than a like, a view the least.
 */
create or replace function public.engagement_top(p_type text, p_since timestamptz, p_limit integer default 10)
returns table (
  entity_id uuid, title text, subtitle text, owner_id uuid, owner_name text, cover text, status text,
  views bigint, likes bigint, saves bigint, comments bigint, shares bigint, contacts bigint,
  people bigint, score bigint
)
language sql
stable
as $$
  with agg as (
    select e.entity_id,
           count(*) filter (where e.kind = 'view')                         as views,
           count(*) filter (where e.kind = 'like')                         as likes,
           count(*) filter (where e.kind = 'save')                         as saves,
           count(*) filter (where e.kind = 'comment')                      as comments,
           count(*) filter (where e.kind = 'share')                        as shares,
           count(*) filter (where e.kind in ('contact', 'chat'))           as contacts,
           count(distinct e.actor_id) filter (where e.kind <> 'view')      as people
      from public.engagement_events e
     where e.entity_type = p_type and e.created_at >= p_since
     group by e.entity_id
  )
  select a.entity_id,
         coalesce(ad.title, it.name),
         coalesce(ad.business_name, it.category),
         coalesce(ad.user_id, it.user_id),
         u.full_name,
         coalesce((select p.url from public.advert_photos p where p.advert_id = ad.id order by p.position limit 1), it.images[1]),
         coalesce(ad.status::text, it.status::text),
         a.views, a.likes, a.saves, a.comments, a.shares, a.contacts, a.people,
         (a.views + a.likes * 3 + a.saves * 4 + a.comments * 5 + a.shares * 5 + a.contacts * 8)::bigint
    from agg a
    left join public.adverts ad on p_type = 'advert' and ad.id = a.entity_id
    left join public.items   it on p_type = 'item'   and it.id = a.entity_id
    left join public.users   u  on u.id = coalesce(ad.user_id, it.user_id)
   where coalesce(ad.id, it.id) is not null
   order by 15 desc
   limit p_limit;
$$;

-- Vendors/listers ranked by engagement received.
create or replace function public.engagement_top_owners(p_since timestamptz, p_limit integer default 10)
returns table (owner_id uuid, owner_name text, avatar_url text, business_name text, people bigint, interactions bigint, views bigint)
language sql
stable
as $$
  select e.owner_id, u.full_name, u.avatar_url, u.business_name,
         count(distinct e.actor_id) filter (where e.kind <> 'view'),
         count(*) filter (where e.kind <> 'view'),
         count(*) filter (where e.kind = 'view')
    from public.engagement_events e
    join public.users u on u.id = e.owner_id
   where e.created_at >= p_since
   group by e.owner_id, u.full_name, u.avatar_url, u.business_name
   order by 6 desc, 5 desc
   limit p_limit;
$$;

revoke all on function public.engagement_summary(timestamptz, uuid)     from public, anon, authenticated;
revoke all on function public.engagement_people(timestamptz, uuid)      from public, anon, authenticated;
revoke all on function public.engagement_daily(integer, uuid)           from public, anon, authenticated;
revoke all on function public.engagement_top(text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.engagement_top_owners(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.record_engagement(text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.log_engagement(text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.bump_engagement_counter(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.engagement_summary(timestamptz, uuid)     to service_role;
grant execute on function public.engagement_people(timestamptz, uuid)      to service_role;
grant execute on function public.engagement_daily(integer, uuid)           to service_role;
grant execute on function public.engagement_top(text, timestamptz, integer) to service_role;
grant execute on function public.engagement_top_owners(timestamptz, integer) to service_role;
grant execute on function public.record_engagement(text, uuid, text, uuid) to service_role;
grant execute on function public.log_engagement(text, uuid, text, uuid) to service_role;
grant execute on function public.bump_engagement_counter(text, uuid, text, integer) to service_role;

-- ============================================================================
--  8. ROW LEVEL SECURITY
--  The API (service role) bypasses these. They stop the public browser key
--  from reading who liked what, or reading hidden comments.
-- ============================================================================

alter table public.engagement_events enable row level security;
alter table public.reactions         enable row level security;
alter table public.comments          enable row level security;

drop policy if exists comments_public_read on public.comments;
create policy comments_public_read on public.comments for select using (not is_hidden);

drop policy if exists reactions_own_read on public.reactions;
create policy reactions_own_read on public.reactions for select using (auth.uid() = user_id);
-- engagement_events: no policies, so only the API can read it.

commit;

-- Verify:
--   select kind, total, people from public.engagement_summary(now() - interval '30 days');
