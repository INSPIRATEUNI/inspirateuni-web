create type public.submission_status as enum ('assigned', 'submitted', 'approved', 'rejected');

create table public.activity_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  weight numeric(4, 2) not null default 1 check (weight > 0),
  is_active boolean not null default true
);

comment on column public.activity_types.weight is 'Multiplicador de horas; casi siempre 1.';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas (id) on delete restrict,
  activity_type_id uuid not null references public.activity_types (id) on delete restrict,
  title text not null,
  description text,
  estimated_hours numeric(5, 2) check (estimated_hours > 0),
  due_date date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tasks_area_id_idx on public.tasks (area_id);
create index tasks_activity_type_id_idx on public.tasks (activity_type_id);
create index tasks_created_by_idx on public.tasks (created_by);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  position_assignment_id uuid not null references public.position_assignments (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique (task_id, position_assignment_id)
);

create index task_assignments_position_assignment_id_idx on public.task_assignments (position_assignment_id);

create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_assignment_id uuid not null references public.task_assignments (id) on delete cascade,
  status public.submission_status not null default 'assigned',
  work_date date,
  notes text,
  reported_hours numeric(5, 2) check (reported_hours > 0),
  approved_hours numeric(5, 2) check (approved_hours > 0),
  weight_applied numeric(4, 2) check (weight_applied > 0),
  counted_hours numeric(6, 2) generated always as (round(approved_hours * weight_applied, 2)) stored,
  review_comment text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  -- Solo 'assigned' puede estar sin reporte
  check (status = 'assigned' or (reported_hours is not null and submitted_at is not null)),
  -- Las horas aprobadas y el peso existen solo en entregas aprobadas
  check (
    (status = 'approved' and approved_hours is not null and weight_applied is not null)
    or (status <> 'approved' and approved_hours is null and weight_applied is null)
  ),
  -- La revisión existe solo en entregas aprobadas o rechazadas
  check (
    (status in ('approved', 'rejected') and reviewed_at is not null)
    or (status in ('assigned', 'submitted') and reviewed_by is null and reviewed_at is null)
  )
);

comment on column public.task_submissions.weight_applied is 'Copia de activity_types.weight al aprobar; cambiar el peso después no altera horas ya aprobadas.';
comment on column public.task_submissions.counted_hours is 'approved_hours × weight_applied; es lo que entra al reporte.';

create unique index task_submissions_one_open_idx on public.task_submissions (task_assignment_id) where status in ('assigned', 'submitted');
create index task_submissions_task_assignment_id_idx on public.task_submissions (task_assignment_id);
create index task_submissions_reviewed_by_idx on public.task_submissions (reviewed_by);
create index task_submissions_status_idx on public.task_submissions (status);

create table public.submission_evidences (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.task_submissions (id) on delete cascade,
  drive_file_id text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes > 0),
  uploaded_at timestamptz not null default now(),
  unique (submission_id, drive_file_id)
);

comment on table public.submission_evidences is 'Evidencias de una entrega; el archivo está en Drive y se identifica por drive_file_id.';

create index submission_evidences_submission_id_idx on public.submission_evidences (submission_id);

create view public.extracurricular_hours
with (security_invoker = true)
as
select
  pa.profile_id,
  pa.period_id,
  sum(ts.counted_hours) as total_hours,
  count(*) as approved_submissions
from public.task_submissions ts
join public.task_assignments ta on ta.id = ts.task_assignment_id
join public.position_assignments pa on pa.id = ta.position_assignment_id
where ts.status = 'approved'
group by pa.profile_id, pa.period_id;

comment on view public.extracurricular_hours is 'Horas extracurriculares aprobadas por voluntario y período. Es una vista, no una tabla.';

alter table public.activity_types enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_submissions enable row level security;
alter table public.submission_evidences enable row level security;
