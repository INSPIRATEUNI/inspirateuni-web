create type public.access_level as enum ('board', 'volunteer');
create type public.period_status as enum ('planned', 'active', 'closed');
create type public.assignment_status as enum ('active', 'finished');

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete restrict,
  name text not null,
  unique (program_id, name)
);

create index areas_program_id_idx on public.areas (program_id);

create table public.management_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date not null,
  status public.period_status not null default 'planned',
  check (end_date > start_date)
);

create unique index management_periods_single_active_idx on public.management_periods (status) where status = 'active';

create table public.organizational_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  access_level public.access_level not null default 'volunteer',
  is_global boolean not null default false,
  check (not is_global or access_level = 'board')
);

comment on column public.organizational_roles.is_global is 'Presidente y vice: pueden asignar y revisar tareas en todas las áreas.';

create table public.position_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  area_id uuid references public.areas (id) on delete restrict,
  role_id uuid not null references public.organizational_roles (id) on delete restrict,
  period_id uuid not null references public.management_periods (id) on delete restrict,
  start_date date,
  end_date date,
  status public.assignment_status not null default 'active',
  check (end_date is null or start_date is null or end_date >= start_date),
  unique nulls not distinct (profile_id, period_id, area_id, role_id)
);

create index position_assignments_profile_id_idx on public.position_assignments (profile_id);
create index position_assignments_area_id_idx on public.position_assignments (area_id);
create index position_assignments_role_id_idx on public.position_assignments (role_id);
create index position_assignments_period_id_idx on public.position_assignments (period_id);

alter table public.programs enable row level security;
alter table public.areas enable row level security;
alter table public.management_periods enable row level security;
alter table public.organizational_roles enable row level security;
alter table public.position_assignments enable row level security;
