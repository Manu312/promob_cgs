-- MueblesApp · Fase 8: proyectos en la nube.
-- Ejecutar una vez en Supabase → SQL Editor. Se puede volver a ejecutar sin problema.
--
-- Acceso: solo usuarios autenticados. Como el registro está cerrado y los usuarios los invita el
-- administrador, "autenticado" = alguien del equipo (2–3 personas que ven los mismos proyectos).

create table if not exists public.projects (
  id          text primary key,
  name        text not null default 'Proyecto sin nombre',
  client      text not null default '',
  type        text not null default 'Cocina',
  status      text not null default 'Abierto',
  stage       text not null default 'Diseño',
  close_by    date,
  delivery    date,
  notes       text not null default '',
  tags        text[] not null default '{}',
  data        jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text not null default ''
);

create index if not exists projects_updated_at_idx on public.projects (updated_at desc);

alter table public.projects enable row level security;

-- Nadie sin sesión puede leer ni escribir.
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;

drop policy if exists "equipo: leer" on public.projects;
drop policy if exists "equipo: crear" on public.projects;
drop policy if exists "equipo: modificar" on public.projects;
drop policy if exists "equipo: borrar" on public.projects;
create policy "equipo: leer" on public.projects for select to authenticated using (true);
create policy "equipo: crear" on public.projects for insert to authenticated with check (true);
create policy "equipo: modificar" on public.projects for update to authenticated using (true) with check (true);
create policy "equipo: borrar" on public.projects for delete to authenticated using (true);
