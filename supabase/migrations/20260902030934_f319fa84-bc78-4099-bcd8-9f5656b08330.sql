drop policy if exists "Members can view their agency roster" on public.agency_members;

create policy "Users can view own agency membership"
on public.agency_members
for select
to authenticated
using (user_id = auth.uid());

revoke execute on function public.agency_id_of(uuid) from authenticated;
revoke execute on function public.agency_shared_subscription(uuid) from authenticated;
revoke execute on function public.agency_scan_user_ids(uuid) from authenticated;