-- AQL Inspection Platform — Supabase cloud foundation (Stage 2 - roles, safe sync)
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

-- ===== Role helpers (owner / manager / inspector) =====
create or replace function public.aql_my_role(p_workspace uuid)
returns text language sql stable security definer set search_path=public
as $$ select role from public.aql_workspace_members where workspace_id=p_workspace and user_id=auth.uid(); $$;
revoke all on function public.aql_my_role(uuid) from public;
grant execute on function public.aql_my_role(uuid) to authenticated;

create or replace function public.aql_is_workspace_manager(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.aql_workspace_members m where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.role in ('owner','manager')); $$;
revoke all on function public.aql_is_workspace_manager(uuid) from public;
grant execute on function public.aql_is_workspace_manager(uuid) to authenticated;

-- Inspectors may write only inspections and audit entries; managers/owners may write everything.
create or replace function public.aql_can_write_record(p_workspace_id uuid, p_type text)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.aql_workspace_members m where m.workspace_id=p_workspace_id and m.user_id=auth.uid()
  and (m.role in ('owner','manager') or p_type in ('inspections','audit'))); $$;
revoke all on function public.aql_can_write_record(uuid,text) from public;
grant execute on function public.aql_can_write_record(uuid,text) to authenticated;

-- ===== Table policies =====
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
drop policy if exists "role based insert records" on public.aql_cloud_records;
create policy "role based insert records" on public.aql_cloud_records for insert to authenticated
with check (public.aql_can_write_record(workspace_id,record_type));
drop policy if exists "workspace members can update records" on public.aql_cloud_records;
drop policy if exists "role based update records" on public.aql_cloud_records;
create policy "role based update records" on public.aql_cloud_records for update to authenticated
using (public.aql_can_write_record(workspace_id,record_type))
with check (public.aql_can_write_record(workspace_id,record_type));
drop policy if exists "workspace members can delete records" on public.aql_cloud_records;
drop policy if exists "managers can delete records" on public.aql_cloud_records;
create policy "managers can delete records" on public.aql_cloud_records for delete to authenticated
using (public.aql_is_workspace_manager(workspace_id));

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


-- ===== Member management (owner/manager only) =====
create or replace function public.aql_list_members(p_workspace uuid)
returns table(user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.aql_is_workspace_manager(p_workspace) then raise exception 'Managers only'; end if;
  return query select m.user_id, u.email::text, m.role, m.joined_at
    from public.aql_workspace_members m join auth.users u on u.id=m.user_id
    where m.workspace_id=p_workspace order by m.joined_at;
end; $$;
revoke all on function public.aql_list_members(uuid) from public;
grant execute on function public.aql_list_members(uuid) to authenticated;

create or replace function public.aql_set_member_role(p_workspace uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if coalesce(public.aql_my_role(p_workspace),'')<>'owner' then raise exception 'Owner only'; end if;
  if p_role not in ('manager','inspector') then raise exception 'Invalid role'; end if;
  update public.aql_workspace_members set role=p_role where workspace_id=p_workspace and user_id=p_user and role<>'owner';
end; $$;
revoke all on function public.aql_set_member_role(uuid,uuid,text) from public;
grant execute on function public.aql_set_member_role(uuid,uuid,text) to authenticated;

create or replace function public.aql_remove_member(p_workspace uuid, p_user uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if coalesce(public.aql_my_role(p_workspace),'')<>'owner' then raise exception 'Owner only'; end if;
  delete from public.aql_workspace_members where workspace_id=p_workspace and user_id=p_user and role<>'owner';
end; $$;
revoke all on function public.aql_remove_member(uuid,uuid) from public;
grant execute on function public.aql_remove_member(uuid,uuid) to authenticated;

create or replace function public.aql_rotate_join_code(p_workspace uuid)
returns text language plpgsql security definer set search_path=public
as $$
declare code text;
begin
  if not public.aql_is_workspace_manager(p_workspace) then raise exception 'Managers only'; end if;
  code:=upper(substr(encode(gen_random_bytes(12),'hex'),1,12));
  update public.aql_workspaces set join_code=code where id=p_workspace;
  return code;
end; $$;
revoke all on function public.aql_rotate_join_code(uuid) from public;
grant execute on function public.aql_rotate_join_code(uuid) to authenticated;

-- Hide the join code from plain SELECT: it is only returned by create/rotate (managers).
revoke select on public.aql_workspaces from authenticated;
grant select(id,name,created_by,created_at) on public.aql_workspaces to authenticated;
grant select on public.aql_workspace_members to authenticated;
grant select,insert,update,delete on public.aql_cloud_records to authenticated;

-- ===== Private photo storage =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aql-photos', 'aql-photos', false, 12582912, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false, file_size_limit=12582912,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "AQL workspace members read photos" on storage.objects;
create policy "AQL workspace members read photos" on storage.objects for select to authenticated
using (bucket_id='aql-photos' and public.aql_is_workspace_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "AQL workspace members upload photos" on storage.objects;
drop policy if exists "AQL role based upload photos" on storage.objects;
create policy "AQL role based upload photos" on storage.objects for insert to authenticated
with check (bucket_id='aql-photos' and public.aql_can_write_record(((storage.foldername(name))[1])::uuid,(storage.foldername(name))[2]));
drop policy if exists "AQL workspace members update photos" on storage.objects;
drop policy if exists "AQL role based update photos" on storage.objects;
create policy "AQL role based update photos" on storage.objects for update to authenticated
using (bucket_id='aql-photos' and public.aql_can_write_record(((storage.foldername(name))[1])::uuid,(storage.foldername(name))[2]))
with check (bucket_id='aql-photos' and public.aql_can_write_record(((storage.foldername(name))[1])::uuid,(storage.foldername(name))[2]));
drop policy if exists "AQL workspace members delete photos" on storage.objects;
drop policy if exists "AQL managers delete photos" on storage.objects;
create policy "AQL managers delete photos" on storage.objects for delete to authenticated
using (bucket_id='aql-photos' and public.aql_is_workspace_manager(((storage.foldername(name))[1])::uuid));
