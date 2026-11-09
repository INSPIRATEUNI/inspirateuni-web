-- Buckets de Supabase Storage. Idempotente: se puede aplicar sobre una BD que ya los tenga.

-- Evidencias de horas (Issue 1.4.4). La ruta es {user_id}/{uuid}/{nombre} y se guarda en
-- submission_evidences.drive_file_id. Existía en local creado a mano; aquí queda versionado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidences', 'evidences', false, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "evidences: dueño sube" on storage.objects;
create policy "evidences: dueño sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidences' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "evidences: dueño ve" on storage.objects;
create policy "evidences: dueño ve" on storage.objects
  for select to authenticated
  using (bucket_id = 'evidences' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "evidences: dueño borra" on storage.objects;
create policy "evidences: dueño borra" on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidences' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "evidences: directiva ve su área" on storage.objects;
create policy "evidences: directiva ve su área" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidences'
    and exists (
      select 1
      from public.submission_evidences e
      where e.drive_file_id = objects.name
        and public.can_manage_area(public.assignment_area_id(public.submission_task_assignment_id(e.submission_id)))
    )
  );

-- Documentos del Open Day cuando DOCUMENT_STORAGE=supabase (respaldo local de la Edge Function
-- drive-upload). Sin políticas para anon ni authenticated: solo entra el service role. El navegador
-- sube con un token firmado de un solo uso que emite la función.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('openday-documents', 'openday-documents', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;
