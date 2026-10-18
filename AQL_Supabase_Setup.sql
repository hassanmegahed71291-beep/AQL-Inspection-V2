-- AQL Inspection Platform — Supabase cloud foundation (Stage 1)
-- Run in Supabase SQL Editor as project owner. Never expose service_role keys in the app.
create extension if not exists pgcrypto;

create table if not exists public.aql_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default upper(substr(encode(gen_random_bytes(12),'hex'),1,12)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.aql_workspace_members (
  workspace_id uuid not null references public.aql_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'inspector' check (role in ('owner','manager','inspector')),
  joined_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);
create table if not exists public.aql_cloud_records (
  workspace_id uuid not null references public.aql_workspaces(id) on delete cascade,
  record_type text not null check (record_type in ('library','plans','inspections','kv','audit')),
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key(workspace_id,record_type,record_id)
);
create index if not exists aql_cloud_records_ws_type_idx on public.aql_cloud_records(workspace_id,record_type);

alter table public.aql_workspaces enable row level security;
alter table public.aql_workspace_members enable row level security;
alter table public.aql_cloud_records enable row level security;

-- SECURITY DEFINER helper avoids recursive RLS policies on membership lookups.
create or replace function public.aql_is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.aql_workspace_members m where m.workspace_id=p_workspace_id and m.user_id=auth.uid()); $$;
revoke all on function public.aql_is_workspace_member(uuid) from public;
grant execute on function public.aql_is_workspace_member(uuid) to authenticated;

drop policy if exists "workspace members can read workspace" on public.aql_workspaces;
create policy "workspace members can read workspace" on public.aql_workspaces for select to authenticated
using (public.aql_is_workspace_member(id));
drop policy if exists "members can read membership list" on public.aql_workspace_members;
create policy "members can read membership list" on public.aql_workspace_members for select to authenticated
using (public.aql_is_workspace_member(workspace_id));
drop policy if exists "workspace members can read records" on public.aql_cloud_records;
create policy "workspace members can read records" on public.aql_cloud_records for select to authenticated
using (public.aql_is_workspace_member(workspace_id));
drop policy if exists "workspace members can insert records" on public.aql_cloud_records;
create policy "workspace members can insert records" on public.aql_cloud_records for insert to authenticated
with check (public.aql_is_workspace_member(workspace_id));
drop policy if exists "workspace members can update records" on public.aql_cloud_records;
create policy "workspace members can update records" on public.aql_cloud_records for update to authenticated
using (public.aql_is_workspace_member(workspace_id))
with check (public.aql_is_workspace_member(workspace_id));
drop policy if exists "workspace members can delete records" on public.aql_cloud_records;
create policy "workspace members can delete records" on public.aql_cloud_records for delete to authenticated
using (public.aql_is_workspace_member(workspace_id));

create or replace function public.aql_create_workspace(p_name text)
returns table(workspace_id uuid, join_code text)
language plpgsql security definer set search_path=public
as $$
declare wid uuid; code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Workspace name is required'; end if;
  insert into public.aql_workspaces(name,created_by) values(trim(p_name),auth.uid()) returning id, aql_workspaces.join_code into wid, code;
  insert into public.aql_workspace_members(workspace_id,user_id,role) values(wid,auth.uid(),'owner');
  return query select wid, code;
end; $$;
revoke all on function public.aql_create_workspace(text) from public;
grant execute on function public.aql_create_workspace(text) to authenticated;

create or replace function public.aql_join_workspace(p_code text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare wid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into wid from public.aql_workspaces where join_code=upper(trim(p_code));
  if wid is null then raise exception 'Invalid join code'; end if;
  insert into public.aql_workspace_members(workspace_id,user_id,role) values(wid,auth.uid(),'inspector') on conflict do nothing;
  return wid;
end; $$;
revoke all on function public.aql_join_workspace(text) from public;
grant execute on function public.aql_join_workspace(text) to authenticated;

-- Grant only the needed table access; RLS still checks workspace membership.
grant select on public.aql_workspaces to authenticated;
grant select on public.aql_workspace_members to authenticated;
grant select,insert,update,delete on public.aql_cloud_records to authenticated;


-- Private object storage for photos referenced by cloud-sync payloads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aql-photos', 'aql-photos', false, 12582912, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false, file_size_limit=12582912,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "AQL workspace members read photos" on storage.objects;
create policy "AQL workspace members read photos" on storage.objects for select to authenticated
using (bucket_id='aql-photos' and public.aql_is_workspace_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "AQL workspace members upload photos" on storage.objects;
create policy "AQL workspace members upload photos" on storage.objects for insert to authenticated
with check (bucket_id='aql-photos' and public.aql_is_workspace_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "AQL workspace members update photos" on storage.objects;
create policy "AQL workspace members update photos" on storage.objects for update to authenticated
using (bucket_id='aql-photos' and public.aql_is_workspace_member(((storage.foldername(name))[1])::uuid))
with check (bucket_id='aql-photos' and public.aql_is_workspace_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "AQL workspace members delete photos" on storage.objects;
create policy "AQL workspace members delete photos" on storage.objects for delete to authenticated
using (bucket_id='aql-photos' and public.aql_is_workspace_member(((storage.foldername(name))[1])::uuid));
