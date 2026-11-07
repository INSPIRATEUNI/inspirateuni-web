create table public.faculties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.careers (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties (id) on delete restrict,
  name text not null,
  unique (faculty_id, name)
);

create index careers_faculty_id_idx on public.careers (faculty_id);

comment on table public.faculties is 'Catálogo de facultades de la universidad; lo comparten OVPGES y Open Day.';
comment on table public.careers is 'Carreras de cada facultad.';

alter table public.faculties enable row level security;
alter table public.careers enable row level security;

-- Catálogo público (el formulario de inscripción lo lee sin sesión); solo el administrador lo escribe
create policy "faculties: lectura pública" on public.faculties
  for select to anon, authenticated using (true);
create policy "faculties: admin escribe" on public.faculties
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "careers: lectura pública" on public.careers
  for select to anon, authenticated using (true);
create policy "careers: admin escribe" on public.careers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
