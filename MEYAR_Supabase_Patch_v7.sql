-- MEYAR — تحديث صغير (v7): المفتش يشوف الفحوصات المُرسَلة له من المدير (توزيع التقارير المستوردة).
-- شغّله مرة واحدة في SQL Editor (بعد ملف FULL v6 اللي شغّلته قبل كده). آمن لو اتشغّل أكتر من مرة.

drop policy if exists "role based read records" on public.aql_cloud_records;
create policy "role based read records" on public.aql_cloud_records for select to authenticated
using (
  public.aql_can_read_record(workspace_id, record_type, owner_id)
  or (record_type in ('files','inspections') and payload->>'assignedTo' = auth.uid()::text and public.aql_is_workspace_member(workspace_id))
);

drop policy if exists "role based update records" on public.aql_cloud_records;
create policy "role based update records" on public.aql_cloud_records for update to authenticated
using (
  (public.aql_can_write_record(workspace_id, record_type)
    and (public.aql_is_workspace_manager(workspace_id) or owner_id = auth.uid() or owner_id is null
         or record_type = 'library'
         or (record_type in ('files','inspections') and payload->>'assignedTo' = auth.uid()::text)))
  or (record_type = 'kv' and left(record_id, 8) = 'inspset_' and public.aql_is_workspace_member(workspace_id))
)
with check (
  public.aql_can_write_record(workspace_id, record_type)
  or (record_type = 'kv' and left(record_id, 8) = 'inspset_' and public.aql_is_workspace_member(workspace_id))
);
