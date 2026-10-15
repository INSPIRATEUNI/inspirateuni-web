create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.position_assignments pa
    join public.organizational_roles r on r.id = pa.role_id
    join public.management_periods mp on mp.id = pa.period_id
    where pa.profile_id = (select auth.uid())
      and pa.status = 'active'
      and mp.status = 'active'
      and r.access_level = 'admin'
  );
$$;

create function public.is_board()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.position_assignments pa
    join public.organizational_roles r on r.id = pa.role_id
    join public.management_periods mp on mp.id = pa.period_id
    where pa.profile_id = (select auth.uid())
      and pa.status = 'active'
      and mp.status = 'active'
      and r.access_level in ('admin', 'board')
  );
$$;

-- Administrador, presidente y vice
create function public.is_global()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.position_assignments pa
    join public.organizational_roles r on r.id = pa.role_id
    join public.management_periods mp on mp.id = pa.period_id
    where pa.profile_id = (select auth.uid())
      and pa.status = 'active'
      and mp.status = 'active'
      and (r.is_global or r.access_level = 'admin')
  );
$$;

-- Verdadero si el usuario gestiona tareas del área: global, o director de esa área
create function public.can_manage_area(target_area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_global()
    or exists (
      select 1
      from public.position_assignments pa
      join public.organizational_roles r on r.id = pa.role_id
      join public.management_periods mp on mp.id = pa.period_id
      where pa.profile_id = (select auth.uid())
        and pa.status = 'active'
        and mp.status = 'active'
        and r.access_level = 'board'
        and pa.area_id = target_area_id
    );
$$;

-- Verdadero si la asignación de cargo pertenece al usuario (de cualquier período)
create function public.owns_assignment(target_position_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.position_assignments pa
    where pa.id = target_position_assignment_id
      and pa.profile_id = (select auth.uid())
  );
$$;

create function public.task_area_id(target_task_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.area_id from public.tasks t where t.id = target_task_id;
$$;

create function public.assignment_area_id(target_task_assignment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.area_id
  from public.task_assignments ta
  join public.tasks t on t.id = ta.task_id
  where ta.id = target_task_assignment_id;
$$;

create function public.assignment_owner_id(target_task_assignment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pa.profile_id
  from public.task_assignments ta
  join public.position_assignments pa on pa.id = ta.position_assignment_id
  where ta.id = target_task_assignment_id;
$$;

create function public.submission_task_assignment_id(target_submission_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ts.task_assignment_id from public.task_submissions ts where ts.id = target_submission_id;
$$;

create function public.submission_status_of(target_submission_id uuid)
returns public.submission_status
language sql
stable
security definer
set search_path = ''
as $$
  select ts.status from public.task_submissions ts where ts.id = target_submission_id;
$$;

revoke execute on function
  public.is_admin(),
  public.is_board(),
  public.is_global(),
  public.can_manage_area(uuid),
  public.owns_assignment(uuid),
  public.task_area_id(uuid),
  public.assignment_area_id(uuid),
  public.assignment_owner_id(uuid),
  public.submission_task_assignment_id(uuid),
  public.submission_status_of(uuid)
from public, anon;

grant execute on function
  public.is_admin(),
  public.is_board(),
  public.is_global(),
  public.can_manage_area(uuid),
  public.owns_assignment(uuid),
  public.task_area_id(uuid),
  public.assignment_area_id(uuid),
  public.assignment_owner_id(uuid),
  public.submission_task_assignment_id(uuid),
  public.submission_status_of(uuid)
to authenticated;

-- RLS no restringe columnas, así que este trigger aplica las reglas del flujo (Política 3)
-- y copia el peso al aprobar. Sin usuario (service role o migraciones) solo copia el peso.
create function public.guard_task_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_area_id uuid;
  v_owner_id uuid;
  v_weight numeric;
  v_is_owner boolean;
  v_can_review boolean;
begin
  select t.area_id, pa.profile_id, at.weight
    into v_area_id, v_owner_id, v_weight
  from public.task_assignments ta
  join public.tasks t on t.id = ta.task_id
  join public.activity_types at on at.id = t.activity_type_id
  join public.position_assignments pa on pa.id = ta.position_assignment_id
  where ta.id = new.task_assignment_id;

  if tg_op = 'UPDATE' then
    if old.status in ('approved', 'rejected') then
      raise exception 'La entrega % ya fue revisada y no se puede modificar', old.id
        using errcode = 'check_violation';
    end if;
    if new.task_assignment_id is distinct from old.task_assignment_id then
      raise exception 'No se puede cambiar la asignación de una entrega'
        using errcode = 'check_violation';
    end if;
  end if;

  if v_uid is not null then
    v_is_owner := v_owner_id = v_uid;
    -- Un director no revisa sus propias entregas
    v_can_review := not v_is_owner and public.can_manage_area(v_area_id);

    if v_is_owner then
      if new.status not in ('assigned', 'submitted')
        or (tg_op = 'UPDATE' and old.status = 'submitted' and new.status = 'assigned') then
        raise exception 'El voluntario solo puede dejar la entrega en assigned o enviarla (submitted)'
          using errcode = 'insufficient_privilege';
      end if;
      if new.review_comment is not null
        or (tg_op = 'UPDATE' and (
          new.approved_hours is distinct from old.approved_hours
          or new.weight_applied is distinct from old.weight_applied
          or new.reviewed_by is distinct from old.reviewed_by
          or new.reviewed_at is distinct from old.reviewed_at
        )) then
        raise exception 'Solo un director del área puede revisar la entrega'
          using errcode = 'insufficient_privilege';
      end if;
    elsif v_can_review then
      if tg_op = 'INSERT' or old.status <> 'submitted' or new.status not in ('approved', 'rejected') then
        raise exception 'Un director solo puede aprobar o rechazar una entrega en estado submitted'
          using errcode = 'insufficient_privilege';
      end if;
      if new.reported_hours is distinct from old.reported_hours
        or new.work_date is distinct from old.work_date
        or new.notes is distinct from old.notes then
        raise exception 'Un director no puede modificar el reporte del voluntario'
          using errcode = 'insufficient_privilege';
      end if;
      new.reviewed_by := v_uid;
    else
      raise exception 'No tienes permiso sobre esta entrega'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    new.submitted_at := now();
  end if;

  if new.status in ('approved', 'rejected') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.reviewed_at := now();
  end if;

  if new.status = 'approved' then
    new.weight_applied := v_weight;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_task_submission() from public, anon, authenticated;

create trigger task_submissions_guard
before insert or update on public.task_submissions
for each row execute function public.guard_task_submission();

-- Núcleo: catálogos legibles por autenticados; los escribe solo el administrador

create policy "programs: lectura autenticados" on public.programs
  for select to authenticated using (true);
create policy "programs: admin escribe" on public.programs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "areas: lectura autenticados" on public.areas
  for select to authenticated using (true);
create policy "areas: admin escribe" on public.areas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "management_periods: lectura autenticados" on public.management_periods
  for select to authenticated using (true);
create policy "management_periods: admin escribe" on public.management_periods
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "organizational_roles: lectura autenticados" on public.organizational_roles
  for select to authenticated using (true);
create policy "organizational_roles: admin escribe" on public.organizational_roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "profiles: ver el propio o directiva" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_board());
create policy "profiles: editar el propio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: admin edita" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "position_assignments: ver propias o de su área" on public.position_assignments
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_manage_area(area_id));
create policy "position_assignments: global escribe" on public.position_assignments
  for all to authenticated using (public.is_global()) with check (public.is_global());

-- Tareas y horas

create policy "activity_types: lectura autenticados" on public.activity_types
  for select to authenticated using (true);
create policy "activity_types: global escribe" on public.activity_types
  for all to authenticated using (public.is_global()) with check (public.is_global());

-- Política 2: la directiva gestiona tareas de su área; global, las de todas
create policy "tasks: directiva gestiona su área" on public.tasks
  for all to authenticated
  using (public.can_manage_area(area_id))
  with check (public.can_manage_area(area_id) and created_by = (select auth.uid()));

create policy "tasks: voluntario ve las suyas" on public.tasks
  for select to authenticated
  using (exists (
    select 1
    from public.task_assignments ta
    where ta.task_id = tasks.id and public.owns_assignment(ta.position_assignment_id)
  ));

-- Política 1: el voluntario ve sus asignaciones
create policy "task_assignments: voluntario ve las suyas" on public.task_assignments
  for select to authenticated using (public.owns_assignment(position_assignment_id));

create policy "task_assignments: directiva gestiona su área" on public.task_assignments
  for all to authenticated
  using (public.can_manage_area(public.task_area_id(task_id)))
  with check (public.can_manage_area(public.task_area_id(task_id)));

-- Política 1: el voluntario ve, crea y edita sus entregas mientras no estén revisadas
create policy "task_submissions: voluntario ve las suyas" on public.task_submissions
  for select to authenticated
  using (public.assignment_owner_id(task_assignment_id) = (select auth.uid()));

create policy "task_submissions: voluntario crea las suyas" on public.task_submissions
  for insert to authenticated
  with check (
    public.assignment_owner_id(task_assignment_id) = (select auth.uid())
    and status in ('assigned', 'submitted')
  );

create policy "task_submissions: voluntario edita las suyas" on public.task_submissions
  for update to authenticated
  using (
    public.assignment_owner_id(task_assignment_id) = (select auth.uid())
    and status in ('assigned', 'submitted')
  )
  with check (
    public.assignment_owner_id(task_assignment_id) = (select auth.uid())
    and status in ('assigned', 'submitted')
  );

-- Política 3: solo la directiva con permiso sobre el área revisa (el trigger valida las columnas)
create policy "task_submissions: directiva ve su área" on public.task_submissions
  for select to authenticated
  using (public.can_manage_area(public.assignment_area_id(task_assignment_id)));

create policy "task_submissions: directiva revisa su área" on public.task_submissions
  for update to authenticated
  using (public.can_manage_area(public.assignment_area_id(task_assignment_id)))
  with check (public.can_manage_area(public.assignment_area_id(task_assignment_id)));

create policy "submission_evidences: voluntario ve las suyas" on public.submission_evidences
  for select to authenticated
  using (
    public.assignment_owner_id(public.submission_task_assignment_id(submission_id)) = (select auth.uid())
  );

create policy "submission_evidences: voluntario agrega las suyas" on public.submission_evidences
  for insert to authenticated
  with check (
    public.assignment_owner_id(public.submission_task_assignment_id(submission_id)) = (select auth.uid())
    and public.submission_status_of(submission_id) in ('assigned', 'submitted')
  );

create policy "submission_evidences: voluntario quita las suyas" on public.submission_evidences
  for delete to authenticated
  using (
    public.assignment_owner_id(public.submission_task_assignment_id(submission_id)) = (select auth.uid())
    and public.submission_status_of(submission_id) in ('assigned', 'submitted')
  );

create policy "submission_evidences: directiva ve su área" on public.submission_evidences
  for select to authenticated
  using (
    public.can_manage_area(public.assignment_area_id(public.submission_task_assignment_id(submission_id)))
  );
