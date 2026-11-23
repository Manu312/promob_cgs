-- MueblesApp · Fase 8 S3: imágenes y modelos de los proyectos en Storage.
-- Ejecutar una vez en Supabase → SQL Editor (después de 001_proyectos.sql). Se puede repetir.
--
-- Bucket privado "assets": solo los usuarios con sesión (el equipo invitado) leen y escriben.

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

drop policy if exists "equipo: leer archivos" on storage.objects;
drop policy if exists "equipo: subir archivos" on storage.objects;
drop policy if exists "equipo: modificar archivos" on storage.objects;
drop policy if exists "equipo: borrar archivos" on storage.objects;
create policy "equipo: leer archivos" on storage.objects for select to authenticated using (bucket_id = 'assets');
create policy "equipo: subir archivos" on storage.objects for insert to authenticated with check (bucket_id = 'assets');
create policy "equipo: modificar archivos" on storage.objects for update to authenticated using (bucket_id = 'assets') with check (bucket_id = 'assets');
create policy "equipo: borrar archivos" on storage.objects for delete to authenticated using (bucket_id = 'assets');
