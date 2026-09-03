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
      'price_1UBRDpGhKJTTu87hNtUKeWJ3',
      'price_1UBRDqGhKJTTu87h7Qj9n6Hd'
    )
  order by s.created_at asc
  limit 1
$$;

revoke execute on function public.agency_shared_subscription(uuid) from public, anon;
grant execute on function public.agency_shared_subscription(uuid) to authenticated, service_role;