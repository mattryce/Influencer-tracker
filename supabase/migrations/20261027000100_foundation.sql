-- Phase 1 foundation: organizations, brands, team access, creators, campaigns, deals,
-- plus the cross-cutting integration_health / api_logs / alerts tables.
--
-- Tenancy model (see DECISIONS.md D-002):
--   organization (Marcosm) -> brands -> campaigns -> deals
--   organization -> creators (shared across brands so cross-brand ROI works)
-- Org admins see every brand. Org members see only brands they are added to.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.org_role as enum ('admin', 'member');
create type public.brand_role as enum ('editor', 'viewer');
create type public.platform as enum ('instagram', 'tiktok', 'youtube');
create type public.oauth_status as enum ('not_connected', 'connected', 'expiring', 'expired', 'revoked', 'error');
create type public.campaign_status as enum ('draft', 'active', 'completed', 'archived');
create type public.deal_status as enum ('proposed', 'active', 'completed', 'cancelled');
create type public.discount_sync_status as enum ('not_requested', 'pending', 'created', 'failed');
create type public.health_status as enum ('not_connected', 'connected', 'token_expiring', 'broken', 'rate_limited');
create type public.alert_severity as enum ('info', 'warning', 'critical');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizations, profiles, membership
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_uniq on public.profiles (lower(email));

create table public.org_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members (user_id);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  website_url text,
  -- Connection references. Tokens themselves live in Supabase Vault, never in this table.
  shopify_store_domain text,
  shopify_token_secret_id uuid,
  instagram_business_account_id text,
  instagram_username text,
  instagram_token_secret_id uuid,
  -- Which EMV rate table to use: null = organization-wide defaults.
  emv_rate_brand_id uuid references public.brands (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);
create index brands_org_idx on public.brands (org_id);

create table public.brand_members (
  brand_id uuid not null references public.brands (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.brand_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create index brand_members_user_idx on public.brand_members (user_id);

-- Invites are keyed by email so that a teammate can be invited before they have
-- ever logged in. They are converted into memberships on first login (trigger below)
-- or immediately if the person already has an account.
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  org_role public.org_role not null default 'member',
  brand_ids uuid[] not null default '{}',
  brand_role public.brand_role not null default 'editor',
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so RLS policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function private.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org_id and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

create or replace function private.can_view_brand(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brands b
    join public.org_members m on m.org_id = b.org_id and m.user_id = (select auth.uid())
    where b.id = p_brand_id
      and (
        m.role = 'admin'
        or exists (
          select 1 from public.brand_members bm
          where bm.brand_id = b.id and bm.user_id = m.user_id
        )
      )
  );
$$;

create or replace function private.is_brand_member(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.brand_members bm
    where bm.brand_id = p_brand_id and bm.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit_brand(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brands b
    join public.org_members m on m.org_id = b.org_id and m.user_id = (select auth.uid())
    where b.id = p_brand_id
      and (
        m.role = 'admin'
        or exists (
          select 1 from public.brand_members bm
          where bm.brand_id = b.id and bm.user_id = m.user_id and bm.role = 'editor'
        )
      )
  );
$$;

-- Org-level data (creators) is editable by admins and by anyone who is an editor on
-- at least one brand in the org. Pure viewers can read but not change the roster.
create or replace function private.can_edit_org_data(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_admin(p_org_id) or exists (
    select 1
    from public.brand_members bm
    join public.brands b on b.id = bm.brand_id
    where b.org_id = p_org_id and bm.user_id = (select auth.uid()) and bm.role = 'editor'
  );
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profile creation + invite acceptance
-- ---------------------------------------------------------------------------
create or replace function private.accept_invites_for(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record;
begin
  for inv in
    select * from public.org_invites
    where email = lower(trim(p_email)) and accepted_at is null
  loop
    insert into public.org_members (org_id, user_id, role)
    values (inv.org_id, p_user_id, inv.org_role)
    on conflict (org_id, user_id) do update
      set role = case when excluded.role = 'admin' then 'admin'::public.org_role else public.org_members.role end;

    insert into public.brand_members (brand_id, user_id, role)
    select b.id, p_user_id, inv.brand_role
    from public.brands b
    where b.id = any (inv.brand_ids) and b.org_id = inv.org_id
    on conflict (brand_id, user_id) do update set role = excluded.role;

    update public.org_invites set accepted_at = now() where id = inv.id;
  end loop;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', null))
  on conflict (id) do nothing;
  perform private.accept_invites_for(new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- If someone is invited after they already have an account, apply it right away.
create or replace function private.handle_new_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  select id into existing from public.profiles where lower(email) = new.email;
  if existing is not null then
    perform private.accept_invites_for(existing, new.email);
  end if;
  return null;
end;
$$;

create trigger on_org_invite_created
  after insert or update of brand_ids, org_role, brand_role on public.org_invites
  for each row execute function private.handle_new_invite();

-- ---------------------------------------------------------------------------
-- Creators
-- ---------------------------------------------------------------------------
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  email text,
  phone text,
  notes text,
  tags text[] not null default '{}',
  -- Free-form rate card, e.g. {"instagram_reel": 500, "tiktok_video": 300}. Values in USD.
  rate_card jsonb not null default '{}'::jsonb check (jsonb_typeof(rate_card) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creators_org_idx on public.creators (org_id);
create index creators_name_idx on public.creators (org_id, lower(name));

create table public.creator_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  platform public.platform not null,
  -- Normalized: lowercase, no leading @. See lib/creators/handles.ts.
  handle text not null check (handle = lower(handle) and handle !~ '^@' and length(handle) > 0),
  platform_user_id text,
  profile_url text,
  oauth_status public.oauth_status not null default 'not_connected',
  token_secret_id uuid,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Dedupe rule: one account per handle per platform within an org.
  unique (org_id, platform, handle)
);
create index creator_accounts_creator_idx on public.creator_accounts (creator_id);

-- Keep org_id consistent with the parent creator so RLS can't be bypassed by a mismatched org_id.
create or replace function private.creator_accounts_set_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select c.org_id into new.org_id from public.creators c where c.id = new.creator_id;
  if new.org_id is null then
    raise exception 'creator % not found', new.creator_id;
  end if;
  return new;
end;
$$;

create trigger creator_accounts_set_org
  before insert or update of creator_id, org_id on public.creator_accounts
  for each row execute function private.creator_accounts_set_org();

-- Follower count history (time series, never overwritten).
create table public.creator_follower_snapshots (
  id bigint generated always as identity primary key,
  creator_account_id uuid not null references public.creator_accounts (id) on delete cascade,
  fetched_at timestamptz not null default now(),
  source text not null check (source in ('creator_oauth', 'brand_graph_api', 'public_api', 'screenshot_ocr', 'manual')),
  followers bigint check (followers >= 0)
);
create index creator_follower_snapshots_account_idx
  on public.creator_follower_snapshots (creator_account_id, fetched_at desc);

-- ---------------------------------------------------------------------------
-- Campaigns and deals
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  status public.campaign_status not null default 'draft',
  starts_on date,
  ends_on date,
  budget numeric(12, 2) check (budget >= 0),
  goal text,
  -- Stored normalized: lowercase, without the leading # / @.
  required_hashtags text[] not null default '{}',
  required_mentions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index campaigns_brand_idx on public.campaigns (brand_id);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- Denormalized from the campaign (kept in sync by trigger) so RLS and reporting stay cheap.
  brand_id uuid not null references public.brands (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete restrict,
  status public.deal_status not null default 'proposed',
  fee numeric(12, 2) not null default 0 check (fee >= 0),
  product_value numeric(12, 2) not null default 0 check (product_value >= 0),
  -- Structured deliverables, e.g. [{"platform":"instagram","type":"reel","count":2}]
  deliverables jsonb not null default '[]'::jsonb check (jsonb_typeof(deliverables) = 'array'),
  due_date date,
  discount_code text check (discount_code is null or discount_code ~ '^[A-Z0-9_-]+$'),
  utm_tag text check (utm_tag is null or utm_tag ~ '^[a-z0-9_-]+$'),
  create_shopify_discount boolean not null default false,
  shopify_discount_status public.discount_sync_status not null default 'not_requested',
  shopify_discount_id text,
  shopify_discount_error text,
  usage_rights boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
create index deals_brand_idx on public.deals (brand_id);
create index deals_creator_idx on public.deals (creator_id);
-- A discount code identifies a single deal per brand, otherwise attribution is ambiguous.
create unique index deals_brand_discount_code_uniq on public.deals (brand_id, discount_code)
  where discount_code is not null;
create unique index deals_brand_utm_tag_uniq on public.deals (brand_id, utm_tag)
  where utm_tag is not null;

create or replace function private.deals_sync_brand()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_campaign_org uuid;
  v_creator_org uuid;
begin
  select c.brand_id, b.org_id into new.brand_id, v_campaign_org
  from public.campaigns c join public.brands b on b.id = c.brand_id
  where c.id = new.campaign_id;
  select org_id into v_creator_org from public.creators where id = new.creator_id;
  if v_campaign_org is null or v_creator_org is distinct from v_campaign_org then
    raise exception 'campaign and creator must belong to the same organization';
  end if;
  if new.create_shopify_discount and new.discount_code is null then
    raise exception 'a discount code is required when auto-creating a Shopify discount';
  end if;
  if new.create_shopify_discount and new.shopify_discount_status = 'not_requested' then
    new.shopify_discount_status = 'pending';
  end if;
  return new;
end;
$$;

create trigger deals_sync_brand
  before insert or update on public.deals
  for each row execute function private.deals_sync_brand();

-- ---------------------------------------------------------------------------
-- Integration health, API logs, alerts
-- ---------------------------------------------------------------------------
create table public.integration_health (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete cascade,
  creator_account_id uuid references public.creator_accounts (id) on delete cascade,
  -- e.g. 'instagram_graph', 'shopify', 'youtube_data', 'tiktok', 'gmail'
  integration text not null,
  status public.health_status not null default 'not_connected',
  last_success_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  token_expires_at timestamptz,
  rate_limited_until timestamptz,
  updated_at timestamptz not null default now()
);
create unique index integration_health_scope_uniq on public.integration_health (
  integration,
  org_id,
  coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(creator_account_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create table public.api_logs (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  platform text not null,
  endpoint text not null,
  method text not null default 'GET',
  status_code int,
  duration_ms int,
  error text,
  created_at timestamptz not null default now()
);
create index api_logs_created_idx on public.api_logs (created_at desc);
create index api_logs_platform_idx on public.api_logs (platform, created_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete cascade,
  kind text not null,
  severity public.alert_severity not null default 'warning',
  title text not null,
  body text,
  -- Dedupe key so the same broken connection doesn't email every hour.
  dedupe_key text,
  emailed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index alerts_open_dedupe_uniq on public.alerts (org_id, dedupe_key)
  where resolved_at is null and dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.organizations for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.brands for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.creators for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.creator_accounts for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.campaigns for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.deals for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.integration_health for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.org_members enable row level security;
alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.org_invites enable row level security;
alter table public.creators enable row level security;
alter table public.creator_accounts enable row level security;
alter table public.creator_follower_snapshots enable row level security;
alter table public.campaigns enable row level security;
alter table public.deals enable row level security;
alter table public.integration_health enable row level security;
alter table public.api_logs enable row level security;
alter table public.alerts enable row level security;

-- organizations
create policy "members read their org" on public.organizations
  for select to authenticated using (private.is_org_member(id));
create policy "admins update their org" on public.organizations
  for update to authenticated using (private.is_org_admin(id)) with check (private.is_org_admin(id));

-- profiles: see yourself and people who share an org with you
create policy "read own and teammates' profiles" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1 from public.org_members mine
      join public.org_members theirs on theirs.org_id = mine.org_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- org_members
create policy "members read org membership" on public.org_members
  for select to authenticated using (private.is_org_member(org_id));
create policy "admins manage org membership" on public.org_members
  for all to authenticated using (private.is_org_admin(org_id)) with check (private.is_org_admin(org_id));

-- org_invites
create policy "admins manage invites" on public.org_invites
  for all to authenticated using (private.is_org_admin(org_id)) with check (private.is_org_admin(org_id));

-- brands
-- Not private.can_view_brand(id): that looks the brand row up, which isn't visible yet when
-- evaluating INSERT ... RETURNING on a brand that is being created.
create policy "read accessible brands" on public.brands
  for select to authenticated using (private.is_org_admin(org_id) or private.is_brand_member(id));
create policy "admins create brands" on public.brands
  for insert to authenticated with check (private.is_org_admin(org_id));
create policy "admins update brands" on public.brands
  for update to authenticated using (private.is_org_admin(org_id)) with check (private.is_org_admin(org_id));
create policy "admins delete brands" on public.brands
  for delete to authenticated using (private.is_org_admin(org_id));

-- brand_members
create policy "read brand membership" on public.brand_members
  for select to authenticated using (private.can_view_brand(brand_id));
create policy "admins manage brand membership" on public.brand_members
  for all to authenticated
  using (exists (select 1 from public.brands b where b.id = brand_id and private.is_org_admin(b.org_id)))
  with check (exists (select 1 from public.brands b where b.id = brand_id and private.is_org_admin(b.org_id)));

-- creators (org-scoped)
create policy "org members read creators" on public.creators
  for select to authenticated using (private.is_org_member(org_id));
create policy "editors insert creators" on public.creators
  for insert to authenticated with check (private.can_edit_org_data(org_id));
create policy "editors update creators" on public.creators
  for update to authenticated using (private.can_edit_org_data(org_id)) with check (private.can_edit_org_data(org_id));
create policy "admins delete creators" on public.creators
  for delete to authenticated using (private.is_org_admin(org_id));

create policy "org members read creator accounts" on public.creator_accounts
  for select to authenticated using (private.is_org_member(org_id));
create policy "editors insert creator accounts" on public.creator_accounts
  for insert to authenticated with check (private.can_edit_org_data(org_id));
create policy "editors update creator accounts" on public.creator_accounts
  for update to authenticated using (private.can_edit_org_data(org_id)) with check (private.can_edit_org_data(org_id));
create policy "editors delete creator accounts" on public.creator_accounts
  for delete to authenticated using (private.can_edit_org_data(org_id));

create policy "org members read follower history" on public.creator_follower_snapshots
  for select to authenticated using (
    exists (select 1 from public.creator_accounts a where a.id = creator_account_id and private.is_org_member(a.org_id))
  );

-- campaigns (brand-scoped)
create policy "read campaigns" on public.campaigns
  for select to authenticated using (private.can_view_brand(brand_id));
create policy "editors write campaigns" on public.campaigns
  for insert to authenticated with check (private.can_edit_brand(brand_id));
create policy "editors update campaigns" on public.campaigns
  for update to authenticated using (private.can_edit_brand(brand_id)) with check (private.can_edit_brand(brand_id));
create policy "editors delete campaigns" on public.campaigns
  for delete to authenticated using (private.can_edit_brand(brand_id));

-- deals (brand-scoped). Insert check goes through the campaign because brand_id is set by trigger.
create policy "read deals" on public.deals
  for select to authenticated using (private.can_view_brand(brand_id));
create policy "editors insert deals" on public.deals
  for insert to authenticated with check (
    exists (select 1 from public.campaigns c where c.id = campaign_id and private.can_edit_brand(c.brand_id))
  );
create policy "editors update deals" on public.deals
  for update to authenticated using (private.can_edit_brand(brand_id)) with check (private.can_edit_brand(brand_id));
create policy "editors delete deals" on public.deals
  for delete to authenticated using (private.can_edit_brand(brand_id));

-- integration health: readable by anyone who can see the scope; written only by the service role.
create policy "read integration health" on public.integration_health
  for select to authenticated using (
    case
      when brand_id is not null then private.can_view_brand(brand_id)
      else private.is_org_member(org_id)
    end
  );

-- api logs: admins only (debugging tool). Written by the service role.
create policy "admins read api logs" on public.api_logs
  for select to authenticated using (org_id is not null and private.is_org_admin(org_id));

-- alerts
create policy "read alerts" on public.alerts
  for select to authenticated using (
    case
      when brand_id is not null then private.can_view_brand(brand_id)
      else private.is_org_member(org_id)
    end
  );
create policy "editors resolve alerts" on public.alerts
  for update to authenticated using (
    case when brand_id is not null then private.can_edit_brand(brand_id) else private.is_org_admin(org_id) end
  ) with check (
    case when brand_id is not null then private.can_edit_brand(brand_id) else private.is_org_admin(org_id) end
  );

-- ---------------------------------------------------------------------------
-- RPC: organizations the signed-in user belongs to
-- ---------------------------------------------------------------------------
create or replace function public.my_orgs()
returns table (org_id uuid, org_name text, role public.org_role)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.id, o.name, m.role
  from public.org_members m join public.organizations o on o.id = m.org_id
  where m.user_id = (select auth.uid())
  order by o.name;
$$;
