-- MEYAR: السماح للمدير بإسناد ملفات (تقارير PDF) لمفتش معين.
-- شغّله مرة واحدة في Supabase → SQL Editor (آمن لو اتشغّل أكتر من مرة).
-- الملف المُسنَد يحمل payload.assignedTo = user id بتاع المفتش.

-- 1) المفتش يقرأ الملفات اللي رفعها هو + الملفات المُسندة له
drop policy if exists "role based read records" on public.aql_cloud_records;
create policy "role based read records" on public.aql_cloud_records for select to authenticated
using (
  public.aql_can_read_record(workspace_id, record_type, owner_id)
  or (record_type = 'files' and payload->>'assignedTo' = auth.uid()::text and public.aql_is_workspace_member(workspace_id))
);

-- 2) المفتش المُسنَد له الملف يقدر يحدّث بياناته (مثل ربطه بفحص)
drop policy if exists "role based update records" on public.aql_cloud_records;
create policy "role based update records" on public.aql_cloud_records for update to authenticated
using (public.aql_can_write_record(workspace_id, record_type)
       and (public.aql_is_workspace_manager(workspace_id) or owner_id = auth.uid() or owner_id is null
            or (record_type = 'files' and payload->>'assignedTo' = auth.uid()::text)))
with check (public.aql_can_write_record(workspace_id, record_type));

-- 3) المفتش يحمّل ملف PDF المُسنَد له من التخزين
drop policy if exists "AQL files read" on storage.objects;
create policy "AQL files read" on storage.objects for select to authenticated
using (bucket_id = 'aql-files'
  and public.aql_is_workspace_member(((storage.foldername(name))[1])::uuid)
  and (public.aql_is_workspace_manager(((storage.foldername(name))[1])::uuid)
       or (storage.foldername(name))[2] = auth.uid()::text
       or exists (select 1 from public.aql_cloud_records r
                  where r.workspace_id = ((storage.foldername(storage.objects.name))[1])::uuid
                    and r.record_type = 'files'
                    and r.payload->>'path' = storage.objects.name
                    and r.payload->>'assignedTo' = auth.uid()::text)));
