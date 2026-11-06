create type public.doc_type as enum ('dni', 'ce', 'passport', 'other');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  district text,
  ugel text,
  contact_email extensions.citext,
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  doc_type public.doc_type not null,
  doc_number text not null check (length(trim(doc_number)) > 0),
  first_name text not null,
  last_name text not null,
  birth_date date not null check (birth_date <= current_date),
  grade text,
  email extensions.citext unique,
  phone text,
  school_id uuid references public.schools (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (doc_type, doc_number),
  check (doc_type <> 'dni' or doc_number ~ '^[0-9]{8}$')
);

create index participants_school_id_idx on public.participants (school_id);

create table public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  guardian_name text not null,
  guardian_dni text not null check (guardian_dni ~ '^[0-9]{8}$'),
  guardian_contact text not null,
  document_path text not null,
  accepted_at timestamptz not null default now(),
  valid_until timestamptz not null,
  check (valid_until > accepted_at)
);

create index guardian_consents_participant_id_idx on public.guardian_consents (participant_id);

comment on table public.participants is 'Escolares y externos sin cuenta. Se identifican por (doc_type, doc_number); email único cuando existe.';
comment on column public.participants.grade is 'Grado del escolar (texto libre).';
comment on table public.guardian_consents is 'Autorización de apoderado de OVPGES (documento en Supabase Storage). En el Open Day la autorización es el documento de la inscripción.';

alter table public.schools enable row level security;
alter table public.participants enable row level security;
alter table public.guardian_consents enable row level security;

-- Datos personales: no son públicos. El acceso de la web pasa por RPC; la directiva solo lee
create policy "schools: directiva lee" on public.schools
  for select to authenticated using (public.is_board());
create policy "schools: admin escribe" on public.schools
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "participants: directiva lee" on public.participants
  for select to authenticated using (public.is_board());
create policy "participants: admin escribe" on public.participants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "guardian_consents: directiva lee" on public.guardian_consents
  for select to authenticated using (public.is_board());
create policy "guardian_consents: admin escribe" on public.guardian_consents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
