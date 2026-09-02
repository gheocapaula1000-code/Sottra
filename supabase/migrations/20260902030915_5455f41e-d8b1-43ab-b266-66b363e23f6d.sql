-- Agency seats: telefoni illimitati su Agenzia / Rete sotto UN solo abbonamento.
create table if not exists public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'agent' check (role in ('owner','agent')),
  created_at timestamptz not null default now(),
  unique (user_id)
);

grant select on public.agency_members to authenticated;
grant all on public.agency_members to service_role;

alter table public.agency_members enable row level security;

create index if not exists idx_agency_members_agency_id on public.agency_members(agency_id);

create or replace function public.agency_id_of(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.agency_members where user_id = _user_id limit 1
$$;

revoke execute on function public.agency_id_of(uuid) from public, anon;
grant execute on function public.agency_id_of(uuid) to authenticated, service_role;

drop policy if exists "Members can view their agency roster" on public.agency_members;
create policy "Members can view their agency roster"
on public.agency_members
for select
to authenticated
using (agency_id = public.agency_id_of(auth.uid()));

drop policy if exists "Admins can view all agency members" on public.agency_members;
create policy "Admins can view all agency members"
on public.agency_members
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role));

create or replace function public.agency_shared_subscription(_user_id uuid)
returns table (owner_user_id uuid, price_id text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, s.price_id, s.status
  from public.agency_members me
  join public.agency_members peer on peer.agency_id = me.agency_id
  join public.subscriptions s on s.user_id = peer.user_id
  where me.user_id = _user_id
    and s.status in ('active','trialing')
    and s.price_id in (
      'price_1UAu3qGWMFww3yH424NM6o8d',
      'price_1UAu3uGWMFww3yH43u6K1Ect'
    )
  order by s.created_at asc
  limit 1
$$;

revoke execute on function public.agency_shared_subscription(uuid) from public, anon;
grant execute on function public.agency_shared_subscription(uuid) to authenticated, service_role;

create or replace function public.agency_scan_user_ids(_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select peer.user_id
  from public.agency_members me
  join public.agency_members peer on peer.agency_id = me.agency_id
  where me.user_id = _user_id
  union
  select _user_id
$$;

revoke execute on function public.agency_scan_user_ids(uuid) from public, anon;
grant execute on function public.agency_scan_user_ids(uuid) to authenticated, service_role;